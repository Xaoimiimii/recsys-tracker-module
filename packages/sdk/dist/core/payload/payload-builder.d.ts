export interface IPayloadMapping {
    field: string;
    source: string;
    value: string;
}
export declare class PayloadBuilder {
    private originalXmlOpen;
    private originalXmlSend;
    private originalFetch;
    private isNetworkTrackingActive;
    private trackerConfig;
    private readonly COMMON_CONTAINERS;
    /**
     * Hàm build đa năng: Hỗ trợ cả 2 kiểu gọi (Legacy & Mapping)
     * Để đơn giản hóa trong context này, ta tập trung vào logic Mapping.
     * Trong thực tế cần implement cả logic Legacy nếu các plugin cũ vẫn dùng.
     */
    build(arg1: any, arg2?: any, arg3?: any): any;
    private buildFromMappings;
    private buildLegacy;
    /**
     * [NEW] Lấy dữ liệu từ DOM Element (CSS Selector)
     * Selector được tìm trong phạm vi contextElement (Form) trước, nếu không thấy thì tìm toàn document
     */
    private extractFromElement;
    private extractFromUrl;
    private extractFromStorage;
    private lookupPath;
    private extractFromCookie;
    private getNestedValue;
    private isValidValue;
    /**
     * [NEW] Extract info from Network Request/Response
     * Context: { reqBody: any, resBody: any, method: string }
     * Path format: "request.field" or "response.field" or just "field" (infer)
     */
    private extractFromNetwork;
    /**
     * [NEW] Helper to traverse generic object (for Network Plugin)
     */
    private traverseObject;
    setConfig(config: any): void;
    private checkAndEnableNetworkTracking;
    enableNetworkTracking(config: any): void;
    disableNetworkTracking(): void;
    private hookXhr;
    private restoreXhr;
    private hookFetch;
    private restoreFetch;
    private handleNetworkRequest;
}
//# sourceMappingURL=payload-builder.d.ts.map