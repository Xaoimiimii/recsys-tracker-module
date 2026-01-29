import { BasePlugin } from './base-plugin';
import { getOrCreateAnonymousId } from './utils/plugin-utils';
export class SearchKeywordPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'SearchKeywordPlugin';
        this.inputElements = new Map();
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
        }, 'SearchKeywordPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            const config = this.tracker.getConfig();
            const searchKeywordConfigs = config === null || config === void 0 ? void 0 : config.searchKeywordConfigs;
            if (!searchKeywordConfigs || searchKeywordConfigs.length === 0) {
                return;
            }
            // Attach listeners cho tất cả configs
            searchKeywordConfigs.forEach(skConfig => {
                this.attachListeners(skConfig);
            });
            this.active = true;
        }, 'SearchKeywordPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            this.removeListeners();
            super.stop();
        }, 'SearchKeywordPlugin.stop');
    }
    /**
     * Attach event listeners to input element
     */
    attachListeners(config) {
        // Tìm input element
        const inputElement = this.findInputElement(config.InputSelector);
        if (!inputElement) {
            // Retry sau một khoảng thời gian (DOM có thể chưa load xong)
            setTimeout(() => {
                const retryElement = this.findInputElement(config.InputSelector);
                if (retryElement) {
                    this.addEventListeners(retryElement, config);
                }
            }, 1000);
            return;
        }
        this.addEventListeners(inputElement, config);
    }
    /**
     * Find input element with fallback strategies
     * 1. Direct querySelector
     * 2. Find element with class containing selector, then find input inside
     * 3. Find element with class containing selector, check if it's an input
     */
    findInputElement(selector) {
        // Strategy 1: Direct querySelector
        let element = document.querySelector(selector);
        if (element) {
            return element;
        }
        // Strategy 2 & 3: Contains match for class names
        // Remove leading dot if present (e.g., ".search-bar" -> "search-bar")
        const cleanSelector = selector.startsWith('.') ? selector.slice(1) : selector;
        // Find all elements with class containing the selector
        const allElements = Array.from(document.querySelectorAll('[class]'));
        for (const el of allElements) {
            const classList = el.className;
            if (typeof classList === 'string' && classList.includes(cleanSelector)) {
                // Check if this element itself is an input
                if (el.tagName === 'INPUT') {
                    return el;
                }
                // Try to find input inside this element
                const inputInside = el.querySelector('input');
                if (inputInside) {
                    return inputInside;
                }
            }
        }
        return null;
    }
    /**
     * Add event listeners to input element
     */
    addEventListeners(element, config) {
        // Tạo unique key cho mỗi config
        const key = `${config.Id}_${config.InputSelector}`;
        // Nếu đã tồn tại, remove listener cũ trước
        if (this.inputElements.has(key)) {
            this.removeListener(key);
        }
        // Tạo bound handler riêng cho từng input
        const handleKeyPress = (event) => {
            this.handleKeyPress(event);
        };
        // Listen for keypress events (khi user nhấn Enter)
        element.addEventListener('keypress', handleKeyPress);
        // Lưu vào map
        this.inputElements.set(key, {
            element,
            config,
            handleKeyPress
        });
    }
    /**
     * Remove event listeners
     */
    removeListeners() {
        this.inputElements.forEach((_, key) => {
            this.removeListener(key);
        });
        this.inputElements.clear();
    }
    /**
     * Remove listener cho một config cụ thể
     */
    removeListener(key) {
        const data = this.inputElements.get(key);
        if (data) {
            data.element.removeEventListener('keypress', data.handleKeyPress);
            this.inputElements.delete(key);
        }
    }
    /**
     * Handle keypress event - log khi user nhấn Enter (không debounce)
     */
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            const target = event.target;
            const searchKeyword = target.value.trim();
            if (searchKeyword) {
                // console.log('[SearchKeywordPlugin] Search keyword (Enter pressed):', searchKeyword, 'Config:', config.ConfigurationName);
                // this.saveKeyword(searchKeyword);
                // Trigger push keyword API ngay lập tức
                this.triggerPushKeyword(searchKeyword);
            }
        }
    }
    /**
     * Trigger push keyword API (được gọi khi nhấn Enter hoặc từ DisplayManager)
     */
    async triggerPushKeyword(keyword) {
        if (!this.tracker)
            return;
        const config = this.tracker.getConfig();
        if (!config)
            return;
        const userInfo = this.tracker.userIdentityManager.getUserInfo();
        const userId = userInfo.value || '';
        const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();
        await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
    }
    /**
     * Call API POST recommendation/push-keyword
     */
    async pushKeywordToServer(userId, anonymousId, domainKey, keyword) {
        const baseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
        const url = `${baseUrl}/recommendation/push-keyword`;
        const payload = {
            UserId: userId,
            AnonymousId: anonymousId,
            DomainKey: domainKey,
            Keyword: keyword
        };
        try {
            // console.log('[SearchKeywordPlugin] Pushing keyword to server:', payload);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                // console.log('[SearchKeywordPlugin] Keyword pushed successfully');
            }
            else {
                // console.error('[SearchKeywordPlugin] Failed to push keyword:', response.statusText);
            }
        }
        catch (error) {
            // console.error('[SearchKeywordPlugin] Error pushing keyword:', error);
        }
    }
}
//# sourceMappingURL=search-keyword-plugin.js.map