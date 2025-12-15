export declare class OriginVerifier {
    /**
     * Kiểm tra xem origin hiện tại có khớp với domainUrl đã đăng ký không
     * Thứ tự ưu tiên: 1. origin, 2. referrer
     * @param domainUrl - URL domain đã đăng ký (từ config)
     * @returns true nếu origin hoặc referrer khớp, false nếu không khớp
     */
    static verify(domainUrl: string): boolean;
    private static verifyByOrigin;
    private static verifyByReferrer;
    private static normalizeUrl;
    /**
     * Kiểm tra xem có đang ở môi trường development không
     * (localhost, 127.0.0.1, etc.)
     */
    static isDevelopment(): boolean;
}
//# sourceMappingURL=origin-verifier.d.ts.map