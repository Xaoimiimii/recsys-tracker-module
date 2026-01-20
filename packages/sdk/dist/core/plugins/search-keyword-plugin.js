/**
 * SearchKeywordPlugin - Search Keyword Tracking
 *
 * 1. Lấy search keyword configuration từ tracker config
 * 2. Theo dõi input events trên input selector
 * 3. Log search keyword khi người dùng nhập (với debounce)
 *
 * FLOW:
 * init → get config from tracker → attach listeners → log keywords
 */
import { BasePlugin } from './base-plugin';
export class SearchKeywordPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'SearchKeywordPlugin';
        this.inputElement = null;
        this.handleInputBound = this.handleInput.bind(this);
        this.handleKeyPressBound = this.handleKeyPress.bind(this);
        this.debounceTimer = null;
        this.debounceDelay = 400; // 400ms debounce
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
            }
        }
    }
}
//# sourceMappingURL=search-keyword-plugin.js.map