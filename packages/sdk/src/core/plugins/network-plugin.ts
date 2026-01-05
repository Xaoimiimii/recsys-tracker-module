import { BasePlugin } from './base-plugin';
import { PathMatcher } from '../utils/path-matcher';

// Hàm tiện ích: Parse JSON an toàn
function safeParse(data: any) {
    try {
        if (typeof data === 'string') return JSON.parse(data);
        return data;
    } catch (e) {
        return data;
    }
}

/**
 * NetworkPlugin: Plugin chịu trách nhiệm intercept network requests (XHR & Fetch).
 * - Nó parse request/response body.
 * - Nó so khớp với Tracking Rules.
 * - NÓ CÓ BỘ LỌC THÔNG MINH (SMART FILTER) để tránh trùng lặp sự kiện với các plugin UI.
 */
export class NetworkPlugin extends BasePlugin {
    public readonly name = 'NetworkPlugin';

    private originalXmlOpen: any;
    private originalXmlSend: any;
    private originalFetch: any;

    constructor() {
        super();
    }

    /**
     * Khởi động plugin.
     */
    public start(): void {
        if (this.active) return;
        this.hookXhr();
        this.hookFetch();
        this.active = true;
        console.log(`[NetworkPlugin] initialized with Smart Filter.`);
    }

    /**
     * Dừng plugin.
     */
    public stop(): void {
        if (!this.active) return;
        this.restoreXhr();
        this.restoreFetch();
        this.active = false;
    }

    /**
     * Ghi đè XMLHTTPRequest
     */
    private hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const plugin = this;

        XMLHttpRequest.prototype.open = function (method: string, url: string) {
            (this as any)._networkTrackInfo = { method, url, startTime: Date.now() };
            return plugin.originalXmlOpen.apply(this, arguments as any);
        };

        XMLHttpRequest.prototype.send = function (body: any) {
            const info = (this as any)._networkTrackInfo;
            if (info) {
                this.addEventListener('load', () => {
                    plugin.handleRequest(info.url, info.method, body, this.response);
                });
            }
            return plugin.originalXmlSend.apply(this, arguments as any);
        };
    }

    private restoreXhr() {
        if (this.originalXmlOpen) XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend) XMLHttpRequest.prototype.send = this.originalXmlSend;
    }

    /**
     * Ghi đè Fetch
     */
    private hookFetch() {
        this.originalFetch = window.fetch;
        const plugin = this;

        window.fetch = async function (...args: any[]) {
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : (resource as Request).url;
            const method = config?.method?.toUpperCase() || 'GET';
            const body = config?.body;

            const response = await plugin.originalFetch.apply(this, args);
            const clone = response.clone();
            clone.text().then((text: string) => {
                plugin.handleRequest(url, method, body, text);
            }).catch(() => { });

            return response;
        };
    }

    private restoreFetch() {
        if (this.originalFetch) window.fetch = this.originalFetch;
    }

    /**
     * Xử lý request đã chặn được
     */
    private handleRequest(url: string, method: string, reqBody: any, resBody: any) {
        this.errorBoundary.execute(() => {
            if (!this.tracker) return;
            const config = this.tracker.getConfig();
            if (!config || !config.trackingRules) return;

            const reqData = safeParse(reqBody);
            const resData = safeParse(resBody);

            const networkContext = {
                reqBody: reqData,
                resBody: resData,
                method: method,
                url: url
            };

            for (const rule of config.trackingRules) {
                if (!rule.payloadMappings || rule.payloadMappings.length === 0) continue;

                /* 
                 * SMART FILTER: DUPLICATE PREVENTION
                 * Kiểm tra xem rule này có phải là rule UI không. 
                 * Nếu EventTypeId thuộc nhóm UI (Click, Rating, etc.), ta BỎ QUA.
                 * Tránh trường hợp: Click Button -> Trigger API -> NetworkPlugin thấy API khớp -> Gửi event thứ 2.
                 * 
                 * Danh sách UI Event IDs (giả định theo hệ thống RecSys):
                 * 1: Click
                 * 2: Rating
                 * 3: Review
                 * 5: Input 
                 * 6: Scroll
                 * (Bạn có thể điều chỉnh list này tùy theo config thực tế của DB)
                 */
                /* 
                 * SMART FILTER: DUPLICATE PREVENTION & CORRELATION
                 * Check 1: Is this a UI-related rule? (Click, Rate, etc.)
                 * Check 2: Does it require network data?
                 * Check 3: Did the UI Plugin signal that it's waiting for this event?
                 */
                const uiEventIds = [1, 2, 3, 5, 6];
                const isUiEvent = uiEventIds.includes(rule.eventTypeId);

                let requiresNetworkData = false;
                if (rule.payloadMappings) {
                    requiresNetworkData = rule.payloadMappings.some((m: any) => {
                        const s = (m.source || '').toLowerCase();
                        return [
                            'requestbody',
                            'responsebody',
                            'request_body',
                            'response_body',
                            'requesturl',
                            'request_url'
                        ].includes(s);
                    });
                }

                // If it's a UI event that DOES NOT require network data -> SKIP (ClickPlugin handled it)
                if (isUiEvent && !requiresNetworkData) {
                    continue;
                }

                // If it's a UI event that DOES require network data -> CHECK SIGNAL
                // We only proceed if ClickPlugin signaled strict correlation
                if (isUiEvent && requiresNetworkData) {
                    if (this.tracker && typeof this.tracker.checkAndConsumePendingNetworkRule === 'function') {
                        const hasPendingSignal = this.tracker.checkAndConsumePendingNetworkRule(rule.id);
                        if (!hasPendingSignal) {
                            // console.log('[NetworkPlugin] Ignoring unrelated network request for rule:', rule.name);
                            continue;
                        }
                        console.log('[NetworkPlugin] Correlation matched! Tracking pending event for rule:', rule.name);
                    } else {
                        console.warn('[NetworkPlugin] Tracker does not support checkAndConsumePendingNetworkRule');
                    }
                }

                // Check Matching
                let isNetworkMatch = false;
                let hasRequestSourceMapping = false;

                for (const m of rule.payloadMappings) {
                    if (m.source === 'RequestBody' || m.source === 'RequestUrl') {
                        hasRequestSourceMapping = true;
                    }
                    if (m.requestUrlPattern) {
                        const targetMethod = m.requestMethod?.toUpperCase();
                        if (targetMethod && targetMethod !== method) continue;
                        if (PathMatcher.match(url, m.requestUrlPattern)) {
                            isNetworkMatch = true;
                            break;
                        }
                    }
                }

                if (isNetworkMatch) {
                    // Loop guard
                    if (hasRequestSourceMapping) {
                        const shouldBlock = this.tracker.loopGuard.checkAndRecord(url, method, rule.id);
                        if (shouldBlock) continue;
                    }

                    // Extract Data
                    const extractedData = this.tracker.payloadBuilder.build(networkContext, rule);

                    // Track if valid
                    if (Object.keys(extractedData).length > 0) {
                        // console.log('[NetworkPlugin] Sending filtered event:', rule.name);
                        this.buildAndTrack(networkContext, rule, rule.eventTypeId);
                    }
                }
            }
        }, 'NetworkPlugin.handleRequest');
    }
}