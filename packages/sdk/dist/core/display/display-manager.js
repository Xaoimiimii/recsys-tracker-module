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
            console.log('[DisplayManager] No return methods configured');
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
            const anonymousId = this.getAnonymousId();
            if (!anonymousId) {
                console.warn('[DisplayManager] No anonymous ID found');
                return [];
            }
            console.log(`[DisplayManager] Fetching recommendations for anonymous ID: ${anonymousId}`);
            const items = await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', { numberItems: 10 });
            console.log(`[DisplayManager] Fetched ${items.length} recommendations`);
            return items;
        }
        catch (error) {
            console.error('[DisplayManager] Error fetching recommendations:', error);
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
            console.warn('[DisplayManager] recsys_anon_id not found in localStorage');
            return null;
        }
        catch (error) {
            console.error('[DisplayManager] Error reading localStorage:', error);
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
            case 'INLINE-INJECTION': // Inline
                this.initializeInline(configurationName, value);
                break;
            default:
                console.warn(`[DisplayManager] Unknown returnType: ${returnType}`);
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
            console.log(`[DisplayManager] Popup initialized for slot: ${slotName}`);
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display
    initializeInline(slotName, selector) {
        try {
            if (!selector) {
                console.warn('[DisplayManager] Inline display requires a selector');
                return;
            }
            this.inlineDisplay = new InlineDisplay(this.domainKey, slotName, selector, this.apiBaseUrl, {}, () => this.getRecommendations() // Provide getter function
            );
            this.inlineDisplay.start();
            console.log(`[DisplayManager] Inline initialized for slot: ${slotName}, selector: ${selector}`);
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