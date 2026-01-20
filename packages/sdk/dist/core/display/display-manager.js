import { PopupDisplay } from './popup-display';
import { InlineDisplay } from './inline-display';
import { RecommendationFetcher } from '../recommendation';
const ANON_USER_ID_KEY = 'recsys_anon_id';
export class DisplayManager {
    constructor(domainKey, apiBaseUrl = 'https://recsys-tracker-module.onrender.com') {
        this.popupDisplay = null;
        this.inlineDisplay = null;
        this.cachedRecommendations = null;
        this.fetchPromise = null;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
        this.recommendationFetcher = new RecommendationFetcher(domainKey, apiBaseUrl);
    }
    // Khởi tạo display methods dựa trên danh sách config
    async initialize(returnMethods) {
        this.destroy();
        if (!returnMethods || !Array.isArray(returnMethods) || returnMethods.length === 0) {
            console.warn('[DisplayManager] No return methods provided for initialization.');
            return;
        }
        try {
            await this.fetchRecommendationsOnce();
        }
        catch (error) {
            console.error('[DisplayManager] Failed to fetch recommendations.');
        }
        returnMethods.forEach(method => {
            this.activateDisplayMethod(method);
        });
        console.log('[DisplayManager] Initialized with return methods:', returnMethods);
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
    // Khởi tạo Popup Display với Config đầy đủ
    // private initializePopup(slotName: string, config: PopupConfig): void {
    //   try {
    //     this.popupDisplay = new PopupDisplay(
    //       this.domainKey,
    //       slotName,
    //       this.apiBaseUrl,
    //       config, 
    //       () => this.getRecommendations()
    //     );
    //     this.popupDisplay.start();
    //   } catch (error) {
    //     console.error('[DisplayManager] Error initializing popup:', error);
    //   }
    // }
    initializePopup(slotName, config) {
        try {
            if (this.popupDisplay) {
                this.popupDisplay.stop();
                this.popupDisplay = null;
            }
            this.popupDisplay = new PopupDisplay(this.domainKey, slotName, this.apiBaseUrl, config);
            this.popupDisplay.start();
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display với Config đầy đủ
    initializeInline(slotName, config) {
        try {
            if (this.inlineDisplay) {
                this.inlineDisplay.stop();
                this.inlineDisplay = null;
            }
            if (!config.selector)
                return;
            this.inlineDisplay = new InlineDisplay(this.domainKey, slotName, config.selector, this.apiBaseUrl, config, // Truyền object config
            () => this.getRecommendations());
            this.inlineDisplay.start();
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing inline:', error);
        }
    }
    // --- LOGIC FETCH RECOMMENDATION (GIỮ NGUYÊN) ---
    async fetchRecommendationsOnce() {
        if (this.cachedRecommendations)
            return this.cachedRecommendations;
        if (this.fetchPromise)
            return this.fetchPromise;
        this.fetchPromise = this.fetchRecommendationsInternal();
        try {
            this.cachedRecommendations = await this.fetchPromise;
            return this.cachedRecommendations;
        }
        finally {
            this.fetchPromise = null;
        }
    }
    async fetchRecommendationsInternal() {
        try {
            const anonymousId = this.getAnonymousId();
            if (!anonymousId)
                return [];
            return await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', { numberItems: 6 });
        }
        catch (error) {
            return [];
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
    async getRecommendations() {
        return this.fetchRecommendationsOnce();
    }
    destroy() {
        if (this.popupDisplay) {
            this.popupDisplay.stop();
            this.popupDisplay = null;
        }
        if (this.inlineDisplay) {
            this.inlineDisplay.stop();
            this.inlineDisplay = null;
        }
    }
}
//# sourceMappingURL=display-manager.js.map