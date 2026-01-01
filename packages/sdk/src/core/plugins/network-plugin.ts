import { BasePlugin } from './base-plugin';

/**
 * NetworkPlugin: Plugin chịu trách nhiệm intercept network requests (XHR & Fetch).
 * It caches network data so PayloadBuilder extractors (NetworkExtractor, RequestUrlExtractor) can use it.
 * Does NOT automatically track events - only tracking plugins (click, rating, etc.) trigger tracking.
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
     * Only caches network data for PayloadBuilder extractors to use.
     * Does NOT automatically track events.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    private handleRequest(url: string, method: string, _reqBody: any, _resBody: any) {
        this.errorBoundary.execute(() => {
            // NetworkPlugin no longer auto-tracks events
            // It only intercepts requests so NetworkExtractor and RequestUrlExtractor can cache data
            // The cached data will be extracted by PayloadBuilder when tracking plugins call buildAndTrack
            console.log('[NetworkPlugin] Request intercepted:', method, url);
        }, 'NetworkPlugin.handleRequest');
    }
}