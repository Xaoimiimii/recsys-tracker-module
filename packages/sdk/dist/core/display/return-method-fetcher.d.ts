import { ReturnMethod } from '../../types';
export interface ReturnMethodOptions {
    forceRefresh?: boolean;
}
export declare class ReturnMethodFetcher {
    private domainKey;
    private apiBaseUrl;
    private cache;
    private readonly CACHE_TTL;
    constructor(domainKey: string, apiBaseUrl?: string);
    /**
     * Lấy danh sách Return Method theo Domain Key
     * @param options - Tùy chọn (ví dụ: forceRefresh)
     * @returns Promise<ReturnMethod[]>
     */
    fetchReturnMethods(options?: ReturnMethodOptions): Promise<ReturnMethod[]>;
    /**
     * Chuẩn hóa dữ liệu từ API để đảm bảo Frontend không bị lỗi
     * ĐẶC BIỆT: Xử lý mapping CustomizingFields từ Array -> Object
     */
    private transformResponse;
    /**
     * Lấy dữ liệu từ cache
     */
    private getFromCache;
    /**
     * Lưu dữ liệu vào cache
     */
    private saveToCache;
    /**
     * Xóa cache (dùng khi muốn reload cấu hình ngay lập tức)
     */
    clearCache(): void;
}
//# sourceMappingURL=return-method-fetcher.d.ts.map