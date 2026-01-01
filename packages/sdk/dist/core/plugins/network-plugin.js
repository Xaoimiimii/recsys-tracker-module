import { BasePlugin } from './base-plugin';
/**
 * NetworkPlugin: Plugin chịu trách nhiệm intercept network requests (XHR & Fetch).
 * It caches network data so PayloadBuilder extractors (NetworkExtractor, RequestUrlExtractor) can use it.
 * Does NOT automatically track events - only tracking plugins (click, rating, etc.) trigger tracking.
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
        console.log(`[NetworkPlugin] initialized.`);
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
     * Only caches network data for PayloadBuilder extractors to use.
     * Does NOT automatically track events.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    handleRequest(url, method, _reqBody, _resBody) {
        this.errorBoundary.execute(() => {
            // NetworkPlugin no longer auto-tracks events
            // It only intercepts requests so NetworkExtractor and RequestUrlExtractor can cache data
            // The cached data will be extracted by PayloadBuilder when tracking plugins call buildAndTrack
            console.log('[NetworkPlugin] Request intercepted:', method, url);
        }, 'NetworkPlugin.handleRequest');
    }
}
//# sourceMappingURL=network-plugin.js.map