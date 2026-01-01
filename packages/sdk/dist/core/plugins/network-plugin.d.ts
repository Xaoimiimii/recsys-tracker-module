import { BasePlugin } from './base-plugin';
/**
 * NetworkPlugin: Plugin chịu trách nhiệm intercept network requests (XHR & Fetch).
 * It caches network data so PayloadBuilder extractors (NetworkExtractor, RequestUrlExtractor) can use it.
 * Does NOT automatically track events - only tracking plugins (click, rating, etc.) trigger tracking.
 */
export declare class NetworkPlugin extends BasePlugin {
    readonly name = "NetworkPlugin";
    private originalXmlOpen;
    private originalXmlSend;
    private originalFetch;
    constructor();
    /**
     * Khởi động plugin.
     * Bắt đầu ghi đè (hook) XHR và Fetch để lắng nghe request.
     */
    start(): void;
    /**
     * Dừng plugin.
     * Khôi phục (restore) lại XHR và Fetch gốc của trình duyệt.
     */
    stop(): void;
    /**
     * Ghi đè XMLHttpRequest để theo dõi request cũ.
     */
    private hookXhr;
    /**
     * Khôi phục XMLHttpRequest về nguyên bản.
     */
    private restoreXhr;
    /**
     * Ghi đè window.fetch để theo dõi request hiện đại.
     */
    private hookFetch;
    /**
     * Khôi phục window.fetch về nguyên bản.
     */
    private restoreFetch;
    /**
     * Xử lý thông tin request đã chặn được.
     * Only caches network data for PayloadBuilder extractors to use.
     * Does NOT automatically track events.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    private handleRequest;
}
//# sourceMappingURL=network-plugin.d.ts.map