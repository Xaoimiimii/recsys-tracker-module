import { BasePlugin } from './base-plugin';
/**
 * NetworkPlugin: Plugin chịu trách nhiệm theo dõi các yêu cầu mạng (XHR & Fetch).
 * Nó tự động chặn (intercept) các request, so sánh với Rules cấu hình,
 * và trích xuất dữ liệu nếu trùng khớp.
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
     * So khớp URL với các Rule trong Config và trích xuất dữ liệu.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    private handleRequest;
}
//# sourceMappingURL=network-plugin.d.ts.map