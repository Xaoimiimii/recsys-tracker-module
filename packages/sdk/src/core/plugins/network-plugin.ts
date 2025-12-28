
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
        console.log(`[${this.name}] Started - Intercepting Network Requests`);
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
        console.log(`[${this.name}] Stopped`);
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

            // Context để PayloadBuilder sử dụng trích xuất dữ liệu
            const networkContext = {
                reqBody: reqData,
                resBody: resData,
                method: method
            };

            for (const rule of config.trackingRules) {
                if (!rule.payloadMappings) continue;

                // Lọc các mapping phù hợp với URL hiện tại
                const applicableMappings = rule.payloadMappings.filter(mapping => {
                    if (!mapping.requestUrlPattern) return false;

                    if (mapping.requestMethod && mapping.requestMethod.toUpperCase() !== method.toUpperCase()) {
                        return false;
                    }

                    // Debug log
                    console.log(`[NetworkPlugin] Checking ${url} against ${mapping.requestUrlPattern}`);

                    if (!PathMatcher.matchStaticSegments(url, mapping.requestUrlPattern)) {
                        console.log(`[NetworkPlugin] Static segments mismatch`);
                        return false;
                    }
                    if (!PathMatcher.match(url, mapping.requestUrlPattern)) {
                        // Double check match failure
                        console.log(`[NetworkPlugin] PathMatcher failed for ${url} vs ${mapping.requestUrlPattern}`);
                        return false;
                    }
                    return true;
                });

                if (applicableMappings.length > 0) {
                    // Ép kiểu source thành 'network_request' để đảm bảo PayloadBuilder dùng logic trích xuất mạng
                    const mappingsForBuilder = applicableMappings.map(m => ({
                        ...m,
                        source: 'network_request',
                        value: m.value || m.requestBodyPath // Ensure value is set (PayloadBuilder relies on 'value')
                    }));

                    // Trích xuất dữ liệu thông qua PayloadBuilder
                    const extractedData = this.tracker.payloadBuilder.build(mappingsForBuilder, networkContext);
                    console.log(`[NetworkPlugin] Match found for ${rule.name}. Extracted:`, extractedData);

                    // Nếu có dữ liệu trích xuất được, tiến hành gửi tracking event
                    if (Object.keys(extractedData).length > 0) {
                        // *logic gửi dữ liệu gì gì đó*

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
