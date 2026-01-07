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
    // Khởi tạo display methods dựa trên config
    async initialize(returnMethods) {
        if (!returnMethods || returnMethods.length === 0) {
            return;
        }
        // Fetch recommendations 1 lần duy nhất cho tất cả display methods
        await this.fetchRecommendationsOnce();
        returnMethods.forEach(method => {
            this.activateDisplayMethod(method);
        });
    }
    // Fetch recommendations 1 lần duy nhất và cache kết quả
    async fetchRecommendationsOnce() {
        // Nếu đã có cache, return ngay
        if (this.cachedRecommendations) {
            return this.cachedRecommendations;
        }
        // Nếu đang fetch, đợi kết quả
        if (this.fetchPromise) {
            return this.fetchPromise;
        }
        // Fetch mới
        this.fetchPromise = this.fetchRecommendationsInternal();
        try {
            this.cachedRecommendations = await this.fetchPromise;
            return this.cachedRecommendations;
        }
        finally {
            this.fetchPromise = null;
        }
    }
    // Internal fetch method
    async fetchRecommendationsInternal() {
        try {
            // MOCK: Temporarily using UserId="1" for testing
            // TODO: Uncomment below code when enough data is available
            const anonymousId = this.getAnonymousId();
            if (!anonymousId) {
                return [];
            }
            const items = await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', { numberItems: 6 });
            return items;
        }
        catch (error) {
            return [];
        }
    }
    // Lấy anonymous ID từ localStorage (recsys_anon_id)
    getAnonymousId() {
        try {
            const anonId = localStorage.getItem(ANON_USER_ID_KEY);
            if (anonId) {
                return anonId;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    // Get cached recommendations
    async getRecommendations() {
        return this.fetchRecommendationsOnce();
    }
    // Kích hoạt display method tương ứng
    activateDisplayMethod(method) {
        const { returnType, configurationName, value } = method;
        switch (returnType) {
            case 'POPUP': // Popup
                this.initializePopup(configurationName, value);
                break;
            case 'INLINE-INJECTION': // Inline (with hyphen)
            case 'INLINE_INJECTION': // Inline (with underscore)
                this.initializeInline(configurationName, value);
                break;
            default:
                // do nothing
                break;
        }
    }
    // Khởi tạo Popup Display
    initializePopup(slotName, config) {
        try {
            // Parse config nếu là JSON string, nếu không thì dùng default
            let popupConfig = {};
            if (config) {
                try {
                    popupConfig = JSON.parse(config);
                }
                catch {
                    popupConfig = {};
                }
            }
            this.popupDisplay = new PopupDisplay(this.domainKey, slotName, this.apiBaseUrl, popupConfig, () => this.getRecommendations() // Provide getter function
            );
            this.popupDisplay.start();
        }
        catch (error) {
            // console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display
    initializeInline(slotName, selector) {
        try {
            if (!selector) {
                return;
            }
            this.inlineDisplay = new InlineDisplay(this.domainKey, slotName, selector, this.apiBaseUrl, {}, () => this.getRecommendations() // Provide getter function
            );
            this.inlineDisplay.start();
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing inline:', error);
        }
    }
    // Dừng tất cả display methods
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