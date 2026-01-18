/**
 * UserIdentityManager - Quản lý User Identity riêng biệt
 *
 * TRÁCH NHIỆM:
 * 1. Load UserIdentity config từ API
 * 2. Extract user info từ các nguồn khác nhau (request_body, request_url, localStorage, etc.)
 * 3. Cache user info vào localStorage
 * 4. Provide user info khi cần gửi event
 */
import { UserIdentityConfig } from '../../types';
export declare class UserIdentityManager {
    private userIdentityConfig;
    private isInitialized;
    /**
     * Initialize và load user identity config
     * @param domainKey - Domain key để load config
     */
    initialize(domainKey: string): Promise<void>;
    /**
     * Load user identity config từ API (mock for now)
     * TODO: Replace with real API call when available
     */
    private loadUserIdentityConfig;
    /**
     * Extract và cache user info từ static sources (localStorage, cookie, etc.)
     */
    private extractAndCacheUserInfo;
    /**
     * Check if source is network-based
     */
    private isNetworkSource;
    /**
     * Check if a network request matches the user identity config
     * Called by NetworkObserver
     */
    matchesUserIdentityRequest(url: string, method: string): boolean;
    /**
     * Extract user info từ network request
     * Called by NetworkObserver khi match được request
     */
    extractFromNetworkRequest(url: string, method: string, requestBody?: any, responseBody?: any): void;
    /**
     * Get current user info để gửi với event
     * Trả về cached user info hoặc AnonymousId
     */
    getUserInfo(): {
        field: string;
        value: string;
    };
    /**
     * Get user identity config (for debugging)
     */
    getConfig(): UserIdentityConfig | null;
}
//# sourceMappingURL=user-identity-manager.d.ts.map