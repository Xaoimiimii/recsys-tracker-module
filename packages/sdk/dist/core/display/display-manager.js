import { PopupDisplay } from './popup-display';
import { InlineDisplay } from './inline-display';
import { RecommendationFetcher } from '../recommendation';
const ANON_USER_ID_KEY = 'recsys_anon_id';
export class DisplayManager {
    constructor(domainKey, apiBaseUrl) {
        this.popupDisplays = new Map();
        this.inlineDisplays = new Map();
        this.cachedRecommendations = null;
        this.fetchPromise = null;
        this.refreshTimer = null;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
        this.recommendationFetcher = new RecommendationFetcher(domainKey, apiBaseUrl);
    }
    // Khởi tạo display methods dựa trên danh sách config
    async initialize(returnMethods) {
        this.destroy();
        if (!returnMethods || !Array.isArray(returnMethods) || returnMethods.length === 0) {
            return;
        }
        // Fetch recommendations once for all display methods
        try {
            await this.fetchRecommendationsOnce();
        }
        catch (error) {
            // console.error('[DisplayManager] Failed to fetch recommendations.');
        }
        // Process each return method
        for (const method of returnMethods) {
            this.activateDisplayMethod(method);
        }
    }
    notifyActionTriggered() {
        if (this.refreshTimer)
            clearTimeout(this.refreshTimer);
        // Chống spam API bằng Debounce (đợi 500ms sau hành động cuối cùng)
        this.refreshTimer = setTimeout(async () => {
            await this.refreshAllDisplays();
        }, 500);
    }
    async refreshAllDisplays() {
        var _a, _b, _c;
        this.recommendationFetcher.clearCache();
        const newItems = await this.getRecommendations(50);
        const oldId = (_b = (_a = this.cachedRecommendations) === null || _a === void 0 ? void 0 : _a.items[0]) === null || _b === void 0 ? void 0 : _b.id;
        const newId = (_c = newItems === null || newItems === void 0 ? void 0 : newItems.items[0]) === null || _c === void 0 ? void 0 : _c.id;
        if (oldId === newId) {
            console.log("Dữ liệu từ server trả về giống hệt cũ, không cần render lại.");
            return;
        }
        this.popupDisplays.forEach(popup => { var _a, _b; return (_b = (_a = popup).updateContent) === null || _b === void 0 ? void 0 : _b.call(_a, newItems); });
        this.inlineDisplays.forEach(inline => { var _a, _b; return (_b = (_a = inline).updateContent) === null || _b === void 0 ? void 0 : _b.call(_a, newItems); });
    }
    // Phân loại và kích hoạt display method tương ứng
    activateDisplayMethod(method) {
        var _a;
        const { ReturnType, ConfigurationName, Value, OperatorId } = method;
        // Chuẩn bị cấu hình chung (Giao diện, Style, Fields)
        const commonConfig = {
            layoutJson: method.LayoutJson,
            styleJson: method.StyleJson,
            customizingFields: method.CustomizingFields
        };
        // Kiểm tra loại hiển thị (Lưu ý: Backend thường trả về chữ hoa)
        const type = ReturnType === null || ReturnType === void 0 ? void 0 : ReturnType.toUpperCase();
        if (type === 'POPUP') {
            const duration = ((_a = method.DelayDuration) !== null && _a !== void 0 ? _a : 0) * 1000;
            const popupConfig = {
                ...commonConfig,
                delay: duration,
                autoCloseDelay: 0,
                triggerConfig: {
                    targetValue: Value,
                    operatorId: OperatorId
                }
            };
            this.initializePopup(ConfigurationName, popupConfig);
        }
        else if (type === 'INLINE-INJECTION' || type === 'INLINE_INJECTION') {
            const inlineConfig = {
                ...commonConfig,
                selector: Value
            };
            this.initializeInline(ConfigurationName, inlineConfig);
        }
    }
    initializePopup(key, config) {
        var _a;
        try {
            if (this.popupDisplays.has(key)) {
                (_a = this.popupDisplays.get(key)) === null || _a === void 0 ? void 0 : _a.stop();
                this.popupDisplays.delete(key);
            }
            const popupDisplay = new PopupDisplay(this.domainKey, key, this.apiBaseUrl, config, (limit) => {
                console.log('[DisplayManager] recommendationGetter called with limit:', limit);
                // Fetch directly from recommendationFetcher instead of using cache
                return this.recommendationFetcher.fetchForAnonymousUser({
                    numberItems: limit,
                    autoRefresh: false
                });
            });
            this.popupDisplays.set(key, popupDisplay);
            popupDisplay.start();
        }
        catch (error) {
            // console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display với Config đầy đủ
    initializeInline(key, config) {
        var _a;
        try {
            if (this.inlineDisplays.has(key)) {
                (_a = this.inlineDisplays.get(key)) === null || _a === void 0 ? void 0 : _a.stop();
                this.inlineDisplays.delete(key);
            }
            if (!config.selector)
                return;
            const inlineDisplay = new InlineDisplay(this.domainKey, key, config.selector, this.apiBaseUrl, config, // Truyền object config
            () => {
                return this.recommendationFetcher.fetchForAnonymousUser({
                    autoRefresh: false
                });
            });
            this.inlineDisplays.set(key, inlineDisplay);
            inlineDisplay.start();
        }
        catch (error) {
            // console.error('[DisplayManager] Error initializing inline:', error);
        }
    }
    // --- LOGIC FETCH RECOMMENDATION (GIỮ NGUYÊN) ---
    async fetchRecommendationsOnce(limit = 50) {
        if (this.cachedRecommendations)
            return this.cachedRecommendations;
        if (this.fetchPromise)
            return this.fetchPromise;
        this.fetchPromise = this.fetchRecommendationsInternal(limit);
        try {
            this.cachedRecommendations = await this.fetchPromise;
            return this.cachedRecommendations;
        }
        finally {
            this.fetchPromise = null;
        }
    }
    async fetchRecommendationsInternal(limit) {
        try {
            const anonymousId = this.getAnonymousId();
            if (!anonymousId)
                return { items: [], keyword: '', lastItem: '' };
            // Chỉ fetch 1 lần, không enable autoRefresh ở đây để tránh vòng lặp
            const response = await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', {
                numberItems: limit,
                autoRefresh: false
            });
            return response;
        }
        catch (error) {
            return { items: [], keyword: '', lastItem: '' };
        }
    }
    getAnonymousId() {
        try {
            return localStorage.getItem(ANON_USER_ID_KEY) || null;
        }
        catch {
            return null;
        }
    }
    async getRecommendations(limit = 50) {
        if (limit) {
            return this.fetchRecommendationsInternal(limit);
        }
        return this.fetchRecommendationsOnce();
    }
    destroy() {
        this.popupDisplays.forEach(popup => popup.stop());
        this.popupDisplays.clear();
        this.inlineDisplays.forEach(inline => inline.stop());
        this.inlineDisplays.clear();
    }
}
//# sourceMappingURL=display-manager.js.map