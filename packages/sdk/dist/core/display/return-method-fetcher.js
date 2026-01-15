export class ReturnMethodFetcher {
    constructor(domainKey, apiBaseUrl = 'https://recsys-tracker-module.onrender.com') {
        // Cache config lâu hơn recommendation vì cấu hình ít thay đổi (10 phút)
        this.CACHE_TTL = 10 * 60 * 1000;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
        this.cache = new Map();
    }
    /**
     * Lấy danh sách Return Method theo Domain Key
     * @param options - Tùy chọn (ví dụ: forceRefresh)
     * @returns Promise<ReturnMethod[]>
     */
    async fetchReturnMethods(options = {}) {
        try {
            const cacheKey = `config_${this.domainKey}`;
            // 1. Kiểm tra Cache (nếu không force refresh)
            if (!options.forceRefresh) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            // 2. Gọi API
            const url = `${this.apiBaseUrl}/domain/return-method/${this.domainKey}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                // Nếu 404 (không tìm thấy config cho domain này) thì trả về mảng rỗng thay vì throw lỗi
                if (response.status === 404)
                    return [];
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // 3. Transform dữ liệu (Parse JSON string nếu cần và Map về Type chuẩn)
            const rawList = Array.isArray(data) ? data : (data.data || []);
            const methods = this.transformResponse(rawList);
            // 4. Lưu Cache
            this.saveToCache(cacheKey, methods);
            return methods;
        }
        catch (error) {
            console.error('[ReturnMethodFetcher] Fetch error:', error);
            return [];
        }
    }
    /**
     * Chuẩn hóa dữ liệu từ API để đảm bảo Frontend không bị lỗi
     * ĐẶC BIỆT: Xử lý mapping CustomizingFields từ Array -> Object
     */
    transformResponse(data) {
        if (!Array.isArray(data))
            return [];
        return data.map(item => {
            // --- 1. Xử lý LayoutJson ---
            let layoutJson = {};
            try {
                const rawLayout = item.LayoutJson;
                layoutJson = (typeof rawLayout === 'string' ? JSON.parse(rawLayout) : rawLayout) || {};
            }
            catch (e) {
                console.warn('Error parsing LayoutJson:', item.ConfigurationName);
            }
            // --- 2. Xử lý StyleJson ---
            let styleJson = {};
            try {
                const rawStyle = item.StyleJson;
                styleJson = (typeof rawStyle === 'string' ? JSON.parse(rawStyle) : rawStyle) || {};
            }
            catch (e) {
                console.warn('Error parsing StyleJson:', item.ConfigurationName);
            }
            // --- 3. Xử lý CustomizingFields (QUAN TRỌNG) ---
            // Backend trả về Mảng -> Frontend cần Object { fields: Mảng }
            let customFieldsArray = [];
            try {
                const rawFields = item.CustomizingFields;
                if (typeof rawFields === 'string') {
                    customFieldsArray = JSON.parse(rawFields);
                }
                else if (Array.isArray(rawFields)) {
                    customFieldsArray = rawFields;
                }
            }
            catch (e) {
                console.warn('Error parsing CustomizingFields:', item.ConfigurationName);
                customFieldsArray = [];
            }
            // Wrap vào object cho đúng interface CustomizingFields trong types.ts
            const customizingFieldsData = {
                fields: Array.isArray(customFieldsArray) ? customFieldsArray : []
            };
            // --- 4. Map về ReturnMethod Object ---
            return {
                // Map các trường cơ bản từ DB (Backend thường trả về PascalCase)
                Key: item.Key || item.DomainID,
                ConfigurationName: item.ConfigurationName,
                ReturnType: item.ReturnType,
                Value: item.Value,
                OperatorId: item.OperatorId,
                // Map các trường JSON đã xử lý an toàn
                LayoutJson: layoutJson,
                StyleJson: styleJson,
                CustomizingFields: customizingFieldsData, // <-- Đã đúng chuẩn types.ts
                // Đảm bảo Duration là số
                DelayDuration: Number(item.DelayDuration || 0),
            };
            // Dùng 'as unknown as ReturnMethod' để đảm bảo TypeScript không báo lỗi
            // nếu interface ReturnMethod của bạn có tên trường hơi khác một chút (ví dụ camelCase vs PascalCase)
        });
    }
    /**
     * Lấy dữ liệu từ cache
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    /**
     * Lưu dữ liệu vào cache
     */
    saveToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }
    /**
     * Xóa cache (dùng khi muốn reload cấu hình ngay lập tức)
     */
    clearCache() {
        this.cache.clear();
    }
}
//# sourceMappingURL=return-method-fetcher.js.map