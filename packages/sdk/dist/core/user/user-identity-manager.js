/**
 * UserIdentityManager - Quản lý User Identity riêng biệt
 *
 * TRÁCH NHIỆM:
 * 1. Load UserIdentity config từ API
 * 2. Extract user info từ các nguồn khác nhau (request_body, request_url, localStorage, etc.)
 * 3. Cache user info vào localStorage
 * 4. Provide user info khi cần gửi event
 */
import { saveCachedUserInfo, getCachedUserInfo, getOrCreateAnonymousId } from '../plugins/utils/plugin-utils';
import { PathMatcher } from '../utils/path-matcher';
import { extractFromCookie, extractFromLocalStorage, extractFromSessionStorage, parseBody, extractByPath, extractFromUrl } from '../utils/data-extractors';
export class UserIdentityManager {
    constructor() {
        this.userIdentityConfig = null;
        this.isInitialized = false;
    }
    /**
     * Initialize với user identity config từ TrackerConfig
     * @param config - User identity config đã được load từ API
     */
    initialize(config) {
        if (this.isInitialized) {
            return;
        }
        this.userIdentityConfig = config || null;
        if (this.userIdentityConfig) {
            // Nếu source là network (request_body/request_url), đăng ký với NetworkObserver
            if (this.isNetworkSource(this.userIdentityConfig.source)) {
                console.log('[UserIdentityManager] Network source detected, will be handled by NetworkObserver');
            }
            else {
                // Nếu source là static (localStorage, cookie, etc.), extract ngay
                this.extractAndCacheUserInfo();
            }
        }
        this.isInitialized = true;
    }
    /**
     * Extract và cache user info từ static sources (localStorage, cookie, etc.)
     */
    extractAndCacheUserInfo() {
        if (!this.userIdentityConfig) {
            return;
        }
        const { source, value, field } = this.userIdentityConfig;
        let extractedValue = null;
        try {
            switch (source) {
                case 'local_storage':
                    extractedValue = extractFromLocalStorage(value || '');
                    break;
                case 'session_storage':
                    extractedValue = extractFromSessionStorage(value || '');
                    break;
                case 'cookie':
                    extractedValue = extractFromCookie(value || '');
                    break;
                case 'element':
                    // Extract từ element trên page (ít dùng cho user identity)
                    if (value) {
                        const element = document.querySelector(value);
                        extractedValue = (element === null || element === void 0 ? void 0 : element.textContent) || null;
                    }
                    break;
                default:
                    return;
            }
            if (extractedValue) {
                saveCachedUserInfo(field, extractedValue);
            }
        }
        catch (error) {
            console.error('[UserIdentityManager] Error extracting user info:', error);
        }
    }
    /**
     * Check if source is network-based
     */
    isNetworkSource(source) {
        return source === 'request_body' || source === 'request_url';
    }
    /**
     * Check if a network request matches the user identity config
     * Called by NetworkObserver
     */
    matchesUserIdentityRequest(url, method) {
        if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
            return false;
        }
        const { RequestUrlPattern, RequestMethod } = this.userIdentityConfig.requestConfig;
        if (RequestMethod.toUpperCase() !== method.toUpperCase()) {
            return false;
        }
        const matches = PathMatcher.match(url, RequestUrlPattern);
        return matches;
    }
    /**
     * Extract user info từ network request
     * Called by NetworkObserver khi match được request
     */
    extractFromNetworkRequest(url, method, requestBody, responseBody) {
        if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
            return;
        }
        const { source, field, requestConfig } = this.userIdentityConfig;
        const { Value, ExtractType } = requestConfig;
        let extractedValue = null;
        try {
            if (source === 'request_body') {
                // Extract từ response body (for GET) or request body (for POST/PUT)
                const body = method.toUpperCase() === 'GET' ? responseBody : requestBody;
                extractedValue = extractByPath(parseBody(body), Value);
            }
            else if (source === 'request_url') {
                // Extract từ URL
                extractedValue = extractFromUrl(url, Value, ExtractType, requestConfig.RequestUrlPattern);
            }
            if (extractedValue) {
                saveCachedUserInfo(field, String(extractedValue));
            }
        }
        catch (error) {
            console.error('[UserIdentityManager] Error extracting from network:', error);
        }
    }
    /**
     * Get current user info để gửi với event
     * Trả về cached user info hoặc AnonymousId
     */
    getUserInfo() {
        const cached = getCachedUserInfo();
        if (cached && cached.userValue) {
            return {
                field: cached.userField,
                value: cached.userValue
            };
        }
        // Fallback to AnonymousId
        return {
            field: 'AnonymousId',
            value: getOrCreateAnonymousId()
        };
    }
    /**
     * Get user identity config (for debugging)
     */
    getConfig() {
        return this.userIdentityConfig;
    }
}
//# sourceMappingURL=user-identity-manager.js.map