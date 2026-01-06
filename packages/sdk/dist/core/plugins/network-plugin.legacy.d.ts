import { BasePlugin } from './base-plugin';
/**
 * NetworkPlugin: Plugin chịu trách nhiệm intercept network requests (XHR & Fetch).
 * - Nó parse request/response body.
 * - Nó so khớp với Tracking Rules.
 * - NÓ CÓ BỘ LỌC THÔNG MINH (SMART FILTER) để tránh trùng lặp sự kiện với các plugin UI.
 */
export declare class NetworkPlugin extends BasePlugin {
    readonly name = "NetworkPlugin";
    private originalXmlOpen;
    private originalXmlSend;
    private originalFetch;
    constructor();
    /**
     * Khởi động plugin.
     */
    start(): void;
    /**
     * Dừng plugin.
     */
    stop(): void;
    /**
     * Ghi đè XMLHTTPRequest
     */
    private hookXhr;
    private restoreXhr;
    /**
     * Ghi đè Fetch
     */
    private hookFetch;
    private restoreFetch;
    /**
     * Xử lý request đã chặn được
     */
    private handleRequest;
}
//# sourceMappingURL=network-plugin.legacy.d.ts.map