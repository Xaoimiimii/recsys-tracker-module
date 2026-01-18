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
     * Initialize và load user identity config
     * @param domainKey - Domain key để load config
     */
    async initialize(domainKey) {
        if (this.isInitialized) {
            return;
        }
        console.log('[UserIdentityManager] Initializing for domain:', domainKey);
        // Load user identity config
        this.userIdentityConfig = await this.loadUserIdentityConfig(domainKey);
        if (this.userIdentityConfig) {
            console.log('[UserIdentityManager] Config loaded:', this.userIdentityConfig);
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
     * Load user identity config từ API (mock for now)
     * TODO: Replace with real API call when available
     */
    async loadUserIdentityConfig(_domainKey) {
        console.log('[UserIdentityManager] Loading user identity config (MOCK)');
        // MOCK DATA
        const mockConfig = {
            id: 1,
            source: 'request_body',
            domainId: 11,
            requestConfig: {
                RequestUrlPattern: '/api/auth/me',
                RequestMethod: 'GET',
                Value: 'username'
            },
            field: 'UserId'
        };
        return mockConfig;
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
                    console.warn('[UserIdentityManager] Unsupported static source:', source);
                    return;
            }
            if (extractedValue) {
                console.log('[UserIdentityManager] Extracted user info from', source, ':', extractedValue);
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
        return PathMatcher.match(url, RequestUrlPattern);
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
                console.log('[UserIdentityManager] Extracted user info from network:', extractedValue);
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