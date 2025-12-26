import { BasePlugin } from './base-plugin';
import { PathMatcher } from '../utils/path-matcher';
// Hàm tiện ích: Parse JSON an toàn (tránh văng lỗi nếu chuỗi không hợp lệ)
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
 * NetworkPlugin: Plugin chịu trách nhiệm theo dõi các yêu cầu mạng (XHR & Fetch).
 * Nó tự động chặn (intercept) các request, so sánh với Rules cấu hình,
 * và trích xuất dữ liệu nếu trùng khớp.
 */
export class NetworkPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'NetworkPlugin';
    }
    /**
     * Khởi động plugin.
     * Bắt đầu ghi đè (hook) XHR và Fetch để lắng nghe request.
     */
    start() {
        if (this.active)
            return;
        this.hookXhr();
        this.hookFetch();
        this.active = true;
        console.log(`[${this.name}] Started - Intercepting Network Requests`);
    }
    /**
     * Dừng plugin.
     * Khôi phục (restore) lại XHR và Fetch gốc của trình duyệt.
     */
    stop() {
        if (!this.active)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.active = false;
        console.log(`[${this.name}] Stopped`);
    }
    /**
     * Ghi đè XMLHttpRequest để theo dõi request cũ.
     */
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const plugin = this;
        // Ghi đè phương thức open để lấy thông tin method và url
        XMLHttpRequest.prototype.open = function (method, url) {
            this._networkTrackInfo = { method, url, startTime: Date.now() };
            return plugin.originalXmlOpen.apply(this, arguments);
        };
        // Ghi đè phương thức send để lấy body gửi đi và body trả về
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkTrackInfo;
            if (info) {
                // Lắng nghe sự kiện load để bắt response
                this.addEventListener('load', () => {
                    plugin.handleRequest(info.url, info.method, body, this.response);
                });
            }
            return plugin.originalXmlSend.apply(this, arguments);
        };
    }
    /**
     * Khôi phục XMLHttpRequest về nguyên bản.
     */
    restoreXhr() {
        if (this.originalXmlOpen)
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend)
            XMLHttpRequest.prototype.send = this.originalXmlSend;
    }
    /**
     * Ghi đè window.fetch để theo dõi request hiện đại.
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
            // Gọi fetch gốc
            const response = await plugin.originalFetch.apply(this, args);
            // Clone response để đọc dữ liệu mà không làm hỏng luồng chính
            const clone = response.clone();
            clone.text().then((text) => {
                plugin.handleRequest(url, method, body, text);
            }).catch(() => { });
            return response;
        };
    }
    /**
     * Khôi phục window.fetch về nguyên bản.
     */
    restoreFetch() {
        if (this.originalFetch)
            window.fetch = this.originalFetch;
    }
    /**
     * Xử lý thông tin request đã chặn được.
     * So khớp URL với các Rule trong Config và trích xuất dữ liệu.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    handleRequest(url, method, reqBody, resBody) {
        this.errorBoundary.execute(() => {
            if (!this.tracker)
                return;
            const config = this.tracker.getConfig();
            if (!config || !config.trackingRules)
                return;
            const reqData = safeParse(reqBody);
            const resData = safeParse(resBody);
            // Context để PayloadBuilder sử dụng trích xuất dữ liệu
            const networkContext = {
                reqBody: reqData,
                resBody: resData,
                method: method
            };
            for (const rule of config.trackingRules) {
                if (!rule.payloadMappings)
                    continue;
                // Lọc các mapping phù hợp với URL hiện tại
                const applicableMappings = rule.payloadMappings.filter(mapping => {
                    if (!mapping.requestUrlPattern)
                        return false;
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
//# sourceMappingURL=network-plugin.js.map