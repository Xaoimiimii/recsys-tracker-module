import { BasePlugin } from './base-plugin';
import { getCachedUserInfo, getOrCreateAnonymousId } from './utils/plugin-utils';
export class SearchKeywordPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'SearchKeywordPlugin';
        this.inputElements = new Map();
        this.mutationObserver = null;
        this.searchKeywordConfigs = [];
        this.reattachDebounceTimer = null;
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
                //console.log('[SearchKeywordPlugin] No search keyword configs found');
                return;
            }
            //console.log('[SearchKeywordPlugin] Starting with configs:', searchKeywordConfigs);
            // Lưu configs để dùng lại khi DOM thay đổi
            this.searchKeywordConfigs = searchKeywordConfigs;
            // Attach listeners cho tất cả configs
            searchKeywordConfigs.forEach(skConfig => {
                this.attachListeners(skConfig);
            });
            // Setup MutationObserver để theo dõi DOM changes
            this.setupMutationObserver();
            this.active = true;
        }, 'SearchKeywordPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            this.removeListeners();
            // Disconnect MutationObserver
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
            // Clear debounce timer
            if (this.reattachDebounceTimer) {
                clearTimeout(this.reattachDebounceTimer);
                this.reattachDebounceTimer = null;
            }
            super.stop();
        }, 'SearchKeywordPlugin.stop');
    }
    /**
     * Attach event listeners to input element
     */
    attachListeners(config, retryCount = 0) {
        // Tìm input element
        const inputElement = this.findInputElement(config.InputSelector);
        if (!inputElement) {
            const maxRetries = 5; // Tăng số lần retry lên 5
            if (retryCount < maxRetries) {
                const delay = 1000 * (retryCount + 1); // Tăng dần delay: 1s, 2s, 3s, 4s, 5s
                //console.log(`[SearchKeywordPlugin] Input element not found for selector: ${config.InputSelector}, retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
                setTimeout(() => {
                    this.attachListeners(config, retryCount + 1);
                }, delay);
            }
            else {
                //console.log('[SearchKeywordPlugin] Input element not found after all retries:', config.InputSelector);
            }
            return;
        }
        //console.log('[SearchKeywordPlugin] Input element found for selector:', config.InputSelector);
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
            //console.log('[SearchKeywordPlugin] Removing old listener for:', key);
            this.removeListener(key);
        }
        // Tạo bound handler riêng cho từng input
        const handleKeyPress = (event) => {
            this.handleKeyPress(event);
        };
        // Listen for keypress events (khi user nhấn Enter)
        element.addEventListener('keypress', handleKeyPress);
        //console.log('[SearchKeywordPlugin] Event listener attached for:', key);
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
                //console.log('[SearchKeywordPlugin] Search keyword (Enter pressed):', searchKeyword);
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
        const cached = getCachedUserInfo();
        const userId = cached && cached.userValue ? cached.userValue : null;
        const anonymousId = getOrCreateAnonymousId();
        // const userId = userInfo ? userInfo.value : null;
        // console.log('[SearchKeywordPlugin] Triggering push keyword:', {
        //   userId,
        //   anonymousId,
        //   domainKey: config.domainKey,
        //   keyword
        // });
        await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
        // const userId = userInfo.value || '';
        // const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();
        // await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
    }
    /**
     * Setup MutationObserver để theo dõi DOM changes
     * Re-attach listeners khi DOM thay đổi (ví dụ: sau khi login, DOM có thể re-render)
     */
    setupMutationObserver() {
        // Cleanup existing observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        this.mutationObserver = new MutationObserver(() => {
            // Kiểm tra xem có input elements nào bị mất không
            let needsReattach = false;
            this.inputElements.forEach((data) => {
                // Kiểm tra xem element còn trong DOM không
                if (!document.body.contains(data.element)) {
                    //console.log('[SearchKeywordPlugin] Detected DOM change - element removed');
                    needsReattach = true;
                }
            });
            // Nếu có element bị mất, debounce re-attach để chờ DOM settle
            if (needsReattach) {
                // Clear timeout cũ nếu có
                if (this.reattachDebounceTimer) {
                    clearTimeout(this.reattachDebounceTimer);
                }
                // Chờ 500ms để DOM render xong trước khi re-attach
                this.reattachDebounceTimer = window.setTimeout(() => {
                    //console.log('[SearchKeywordPlugin] Re-attaching listeners due to DOM changes');
                    this.removeListeners();
                    this.searchKeywordConfigs.forEach(config => {
                        this.attachListeners(config);
                    });
                    this.reattachDebounceTimer = null;
                }, 500);
            }
        });
        // Observe toàn bộ body để bắt mọi thay đổi DOM
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        //console.log('[SearchKeywordPlugin] MutationObserver setup complete');
    }
    /**
     * Call API POST recommendation/push-keyword
     */
    async pushKeywordToServer(userId, anonymousId, domainKey, keyword) {
        // const baseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
        const baseUrl = process.env.MODULE_API_URL;
        const url = `${baseUrl}/recommendation/push-keyword`;
        const payload = {
            UserId: userId,
            AnonymousId: anonymousId,
            DomainKey: domainKey,
            Keyword: keyword
        };
        try {
            //console.log('[SearchKeywordPlugin] MeomeoPushing keyword to server:', payload);
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