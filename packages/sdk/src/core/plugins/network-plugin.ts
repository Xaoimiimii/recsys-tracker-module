import { BasePlugin } from './base-plugin';
import { PathMatcher } from '../utils/path-matcher';

// Hàm tiện ích: Parse JSON an toàn (tránh văng lỗi nếu chuỗi không hợp lệ)
function safeParse(data: any) {
    try {
        if (typeof data === 'string') return JSON.parse(data);
        return data;
    } catch (e) {
        return data;
    }
}

/**
 * NetworkPlugin: Plugin chịu trách nhiệm theo dõi các yêu cầu mạng (XHR & Fetch).
 * Nó tự động chặn (intercept) các request, so sánh với Rules cấu hình,
 * và trích xuất dữ liệu nếu trùng khớp.
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
     * Bắt đầu ghi đè (hook) XHR và Fetch để lắng nghe request.
     */
    public start(): void {
        if (this.active) return;

        this.hookXhr();
        this.hookFetch();

        this.active = true;
        console.log(`[NetworkPlugin] initialized.`);
    }

    /**
     * Dừng plugin.
     * Khôi phục (restore) lại XHR và Fetch gốc của trình duyệt.
     */
    public stop(): void {
        if (!this.active) return;

        this.restoreXhr();
        this.restoreFetch();

        this.active = false;
    }

    /**
     * Ghi đè XMLHttpRequest để theo dõi request cũ.
     */
    private hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;

        const plugin = this;

        // Ghi đè phương thức open để lấy thông tin method và url
        XMLHttpRequest.prototype.open = function (method: string, url: string) {
            (this as any)._networkTrackInfo = { method, url, startTime: Date.now() };
            return plugin.originalXmlOpen.apply(this, arguments as any);
        };

        // Ghi đè phương thức send để lấy body gửi đi và body trả về
        XMLHttpRequest.prototype.send = function (body: any) {
            const info = (this as any)._networkTrackInfo;
            if (info) {
                // Lắng nghe sự kiện load để bắt response
                this.addEventListener('load', () => {
                    plugin.handleRequest(
                        info.url,
                        info.method,
                        body,
                        this.response
                    );
                });
            }
            return plugin.originalXmlSend.apply(this, arguments as any);
        };
    }

    /**
     * Khôi phục XMLHttpRequest về nguyên bản.
     */
    private restoreXhr() {
        if (this.originalXmlOpen) XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend) XMLHttpRequest.prototype.send = this.originalXmlSend;
    }

    /**
     * Ghi đè window.fetch để theo dõi request hiện đại.
     */
    private hookFetch() {
        this.originalFetch = window.fetch;
        const plugin = this;

        window.fetch = async function (...args: any[]) {

            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : (resource as Request).url;
            const method = config?.method?.toUpperCase() || 'GET';
            const body = config?.body;

            // Gọi fetch gốc
            const response = await plugin.originalFetch.apply(this, args);

            // Clone response để đọc dữ liệu mà không làm hỏng luồng chính
            const clone = response.clone();
            clone.text().then((text: string) => {
                plugin.handleRequest(url, method, body, text);
            }).catch(() => { });

            return response;
        };
    }

    /**
     * Khôi phục window.fetch về nguyên bản.
     */
    private restoreFetch() {
        if (this.originalFetch) window.fetch = this.originalFetch;
    }

    /**
     * Xử lý thông tin request đã chặn được.
     * So khớp URL với các Rule trong Config và trích xuất dữ liệu.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
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

                // Check if this rule applies to the current network request
                let isNetworkMatch = false;
                let hasRequestSourceMapping = false;

                for (const m of rule.payloadMappings) {
                    // Check if this mapping uses RequestBody or RequestUrl source
                    if (m.source === 'RequestBody' || m.source === 'RequestUrl') {
                        hasRequestSourceMapping = true;
                    }

                    if (m.requestUrlPattern) {
                        // Check method
                        const targetMethod = m.requestMethod?.toUpperCase();
                        if (targetMethod && targetMethod !== method) continue;

                        // Check URL
                        if (PathMatcher.match(url, m.requestUrlPattern)) {
                            isNetworkMatch = true;
                            break;
                        }
                    }
                }

                if (isNetworkMatch) {
                    // Loop guard: only check if rule has RequestBody or RequestUrl source mappings
                    if (hasRequestSourceMapping) {
                        const shouldBlock = this.tracker.loopGuard.checkAndRecord(url, method, rule.id);
                        if (shouldBlock) {
                            continue; // Skip this rule temporarily
                        }
                    }

                    // Extract data using PayloadBuilder (which now handles Network/RequestUrl using the passed context)
                    const extractedData = this.tracker.payloadBuilder.build(networkContext, rule);

                    if (Object.keys(extractedData).length > 0) {
                        this.buildAndTrack(networkContext, rule, rule.eventTypeId);

                        console.groupCollapsed(`%c[TRACKER] Network Match: (${method} ${url})`, "color: orange");
                        console.log("Rule:", rule.name);
                        console.log("Extracted:", extractedData);
                        console.groupEnd();
                    }
                }
            }
        }, 'NetworkPlugin.handleRequest');
    }
}