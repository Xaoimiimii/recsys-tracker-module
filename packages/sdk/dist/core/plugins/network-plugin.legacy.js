import { BasePlugin } from './base-plugin';
import { PathMatcher } from '../utils/path-matcher';
// Hàm tiện ích: Parse JSON an toàn
function safeParse(data) {
    try {
        if (typeof data === 'string')
            return JSON.parse(data);
        return data;
    }
    catch (e) {
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
    constructor() {
        super();
        this.name = 'NetworkPlugin';
    }
    /**
     * Khởi động plugin.
     */
    start() {
        if (this.active)
            return;
        this.hookXhr();
        this.hookFetch();
        this.active = true;
        console.log(`[NetworkPlugin] initialized with Smart Filter.`);
    }
    /**
     * Dừng plugin.
     */
    stop() {
        if (!this.active)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.active = false;
    }
    /**
     * Ghi đè XMLHTTPRequest
     */
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const plugin = this;
        XMLHttpRequest.prototype.open = function (method, url) {
            this._networkTrackInfo = { method, url, startTime: Date.now() };
            return plugin.originalXmlOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkTrackInfo;
            if (info) {
                this.addEventListener('load', () => {
                    plugin.handleRequest(info.url, info.method, body, this.response);
                });
            }
            return plugin.originalXmlSend.apply(this, arguments);
        };
    }
    restoreXhr() {
        if (this.originalXmlOpen)
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend)
            XMLHttpRequest.prototype.send = this.originalXmlSend;
    }
    /**
     * Ghi đè Fetch
     */
    hookFetch() {
        this.originalFetch = window.fetch;
        const plugin = this;
        window.fetch = async function (...args) {
            var _a;
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
            const method = ((_a = config === null || config === void 0 ? void 0 : config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            const body = config === null || config === void 0 ? void 0 : config.body;
            const response = await plugin.originalFetch.apply(this, args);
            const clone = response.clone();
            clone.text().then((text) => {
                plugin.handleRequest(url, method, body, text);
            }).catch(() => { });
            return response;
        };
    }
    restoreFetch() {
        if (this.originalFetch)
            window.fetch = this.originalFetch;
    }
    /**
     * Xử lý request đã chặn được
     */
    handleRequest(url, method, reqBody, resBody) {
        this.errorBoundary.execute(() => {
            var _a;
            if (!this.tracker)
                return;
            const config = this.tracker.getConfig();
            if (!config || !config.trackingRules)
                return;
            const reqData = safeParse(reqBody);
            const resData = safeParse(resBody);
            const networkContext = {
                reqBody: reqData,
                resBody: resData,
                method: method,
                url: url
            };
            for (const rule of config.trackingRules) {
                if (!rule.payloadMappings || rule.payloadMappings.length === 0)
                    continue;
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
                    requiresNetworkData = rule.payloadMappings.some((m) => {
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
                    if (this.tracker && typeof this.tracker.checkPendingNetworkRule === 'function') {
                        // FIX: Use checkPendingNetworkRule (PEEK) first
                        // Do NOT consume it yet. Wait until we confirm the URL matches.
                        const hasPendingSignal = this.tracker.checkPendingNetworkRule(rule.id);
                        if (!hasPendingSignal) {
                            // console.log('[NetworkPlugin] Ignoring unrelated network request for rule:', rule.name);
                            continue;
                        }
                    }
                    else if (this.tracker && typeof this.tracker.checkAndConsumePendingNetworkRule === 'function') {
                        console.warn('[NetworkPlugin] Tracker does not support checkPendingNetworkRule (peek), falling back to consume pattern which may cause race conditions');
                        const hasPendingSignal = this.tracker.checkAndConsumePendingNetworkRule(rule.id);
                        if (!hasPendingSignal)
                            continue;
                    }
                    else {
                        console.warn('[NetworkPlugin] Tracker does not support pending network rules');
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
                        const targetMethod = (_a = m.requestMethod) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                        if (targetMethod && targetMethod !== method)
                            continue;
                        if (PathMatcher.match(url, m.requestUrlPattern)) {
                            isNetworkMatch = true;
                            break;
                        }
                    }
                }
                if (isNetworkMatch) {
                    // FIX: Consume the signal HERE, only if we have a match
                    if (isUiEvent && requiresNetworkData && this.tracker && typeof this.tracker.checkAndConsumePendingNetworkRule === 'function') {
                        const consumed = this.tracker.checkAndConsumePendingNetworkRule(rule.id);
                        if (!consumed) {
                            // This might happen if another request just consumed it (rare race)
                            // or if we only peeked and it expired (also rare)
                            console.log('[NetworkPlugin] Signal lost or consumed by another request for rule:', rule.name);
                            // Decide strictness: continue or break? 
                            // If strict, we might want to skip. But let's assume if it was pending a moment ago, it's ours.
                            // ideally checkAndConsume returns true if it successfully consumed.
                        }
                        else {
                            console.log('[NetworkPlugin] Correlation matched and consumed! Tracking pending event for rule:', rule.name);
                        }
                    }
                    // Loop guard
                    if (hasRequestSourceMapping) {
                        const shouldBlock = this.tracker.loopGuard.checkAndRecord(url, method, rule.id);
                        if (shouldBlock)
                            continue;
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
//# sourceMappingURL=network-plugin.legacy.js.map