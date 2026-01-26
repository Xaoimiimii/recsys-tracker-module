import { BasePlugin } from './base-plugin';
import { getOrCreateAnonymousId } from './utils/plugin-utils';
export class SearchKeywordPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'SearchKeywordPlugin';
        this.inputElement = null;
        this.handleSubmitBound = this.handleSubmit.bind(this);
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
            const searchKeywordConfig = config === null || config === void 0 ? void 0 : config.searchKeywordConfig;
            if (!searchKeywordConfig) {
                return;
            }
            // Attach listeners
            this.attachListeners(searchKeywordConfig.InputSelector);
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
    attachListeners(selector) {
        // Tìm input element
        this.inputElement = this.findInputElement(selector);
        if (!this.inputElement) {
            // Retry sau một khoảng thời gian (DOM có thể chưa load xong)
            setTimeout(() => {
                this.inputElement = this.findInputElement(selector);
                if (this.inputElement) {
                    this.addEventListeners();
                }
            }, 1000);
            return;
        }
        this.addEventListeners();
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
    addEventListeners() {
        if (!this.inputElement)
            return;
        // Listen for keypress events (when user presses Enter to submit)
        this.inputElement.addEventListener('keypress', this.handleSubmitBound);
    }
    /**
     * Remove event listeners
     */
    removeListeners() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('keypress', this.handleSubmitBound);
            this.inputElement = null;
        }
    }
    /**
     * Handle submit event - call API when user presses Enter
     */
    async handleSubmit(event) {
        if (event.key === 'Enter') {
            const target = event.target;
            const searchKeyword = target.value.trim();
            if (searchKeyword && this.tracker) {
                const config = this.tracker.getConfig();
                if (!config)
                    return;
                const userInfo = this.tracker.userIdentityManager.getUserInfo();
                const userId = userInfo.value || '';
                const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();
                await this.pushKeywordToServer(userId, anonymousId, config.domainKey, searchKeyword);
            }
        }
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
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                console.error('[SearchKeywordPlugin] Failed to push keyword:', response.statusText);
            }
        }
        catch (error) {
            console.error('[SearchKeywordPlugin] Error pushing keyword:', error);
        }
    }
}
//# sourceMappingURL=search-keyword-plugin.js.map