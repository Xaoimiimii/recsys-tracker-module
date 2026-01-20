import { BasePlugin } from './base-plugin';
import { getOrCreateAnonymousId } from './utils/plugin-utils';
export class SearchKeywordPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'SearchKeywordPlugin';
        this.inputElement = null;
        this.handleInputBound = this.handleInput.bind(this);
        this.handleKeyPressBound = this.handleKeyPress.bind(this);
        this.debounceTimer = null;
        this.debounceDelay = 400; // 400ms debounce
        this.searchKeywordConfigId = null;
        this.STORAGE_KEY_PREFIX = 'recsys_search_keyword_';
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log('[SearchKeywordPlugin] Initialized');
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
            // Lưu searchKeywordConfigId
            this.searchKeywordConfigId = searchKeywordConfig.Id;
            // Attach listeners
            this.attachListeners(searchKeywordConfig.InputSelector);
            this.active = true;
        }, 'SearchKeywordPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            // Clear debounce timer
            if (this.debounceTimer !== null) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
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
        // Listen for input events (khi user nhập)
        this.inputElement.addEventListener('input', this.handleInputBound);
        // Listen for keypress events (khi user nhấn Enter)
        this.inputElement.addEventListener('keypress', this.handleKeyPressBound);
    }
    /**
     * Remove event listeners
     */
    removeListeners() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('input', this.handleInputBound);
            this.inputElement.removeEventListener('keypress', this.handleKeyPressBound);
            this.inputElement = null;
        }
    }
    /**
     * Handle input event - log với debounce 400ms
     */
    handleInput(event) {
        // Clear existing timer
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }
        const target = event.target;
        const searchKeyword = target.value.trim();
        // Set new timer
        this.debounceTimer = window.setTimeout(() => {
            if (searchKeyword) {
                console.log('[SearchKeywordPlugin] Search keyword (input):', searchKeyword);
                this.saveKeyword(searchKeyword);
            }
            this.debounceTimer = null;
        }, this.debounceDelay);
    }
    /**
     * Handle keypress event - log khi user nhấn Enter (không debounce)
     */
    handleKeyPress(event) {
        if (event.key === 'Enter') {
            // Clear debounce timer khi nhấn Enter
            if (this.debounceTimer !== null) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            const target = event.target;
            const searchKeyword = target.value.trim();
            if (searchKeyword) {
                console.log('[SearchKeywordPlugin] Search keyword (Enter pressed):', searchKeyword);
                this.saveKeyword(searchKeyword);
                // Trigger push keyword API ngay lập tức
                this.triggerPushKeyword(searchKeyword);
            }
        }
    }
    /**
     * Lưu keyword vào localStorage với SearchKeywordConfigID
     */
    saveKeyword(keyword) {
        if (this.searchKeywordConfigId === null)
            return;
        const storageKey = `${this.STORAGE_KEY_PREFIX}${this.searchKeywordConfigId}`;
        localStorage.setItem(storageKey, keyword);
    }
    /**
     * Lấy keyword đã lưu cho SearchKeywordConfigID
     */
    getKeyword(configId) {
        const storageKey = `${this.STORAGE_KEY_PREFIX}${configId}`;
        try {
            return localStorage.getItem(storageKey);
        }
        catch (error) {
            return null;
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
            console.log('[SearchKeywordPlugin] Pushing keyword to server:', payload);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log('[SearchKeywordPlugin] Keyword pushed successfully');
            }
            else {
                console.error('[SearchKeywordPlugin] Failed to push keyword:', response.statusText);
            }
        }
        catch (error) {
            console.error('[SearchKeywordPlugin] Error pushing keyword:', error);
        }
    }
}
//# sourceMappingURL=search-keyword-plugin.js.map