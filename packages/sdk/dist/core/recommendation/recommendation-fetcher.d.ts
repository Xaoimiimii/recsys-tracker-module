import { RecommendationItem, RecommendationOptions, UserField } from './types';
export declare class RecommendationFetcher {
    private domainKey;
    private apiBaseUrl;
    private cache;
    private readonly CACHE_TTL;
    private readonly AUTO_REFRESH_INTERVAL;
    private autoRefreshTimers;
    private refreshCallbacks;
    constructor(domainKey: string, apiBaseUrl: string);
    fetchRecommendations(userValue: string, userField?: UserField, _options?: RecommendationOptions): Promise<RecommendationItem[]>;
    /**
     * Enable auto-refresh for recommendations
     * Tự động fetch recommendations mới mỗi 1 phút
     */
    enableAutoRefresh(userValue: string, userField: UserField | undefined, callback: (items: RecommendationItem[]) => void, options?: RecommendationOptions): () => void;
    private stopAutoRefresh;
    /**
     * Stop all auto-refresh timers
     */
    stopAllAutoRefresh(): void;
    /**
     * Get recommendations cho anonymous user (auto-detect)
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    fetchForAnonymousUser(options?: RecommendationOptions): Promise<RecommendationItem[]>;
    /**
     * Get recommendations cho logged-in user by ID
     * @param userId - User ID
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    fetchForUserId(userId: string, options?: RecommendationOptions): Promise<RecommendationItem[]>;
    /**
     * Get recommendations cho logged-in user by Username
     * @param username - Username
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    fetchForUsername(username: string, options?: RecommendationOptions): Promise<RecommendationItem[]>;
    /**
     * Enable auto-refresh cho anonymous user
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForAnonymousUser(callback: (items: RecommendationItem[]) => void, options?: RecommendationOptions): () => void;
    /**
     * Enable auto-refresh cho logged-in user by ID
     * @param userId - User ID
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForUserId(userId: string, callback: (items: RecommendationItem[]) => void, options?: RecommendationOptions): () => void;
    /**
     * Enable auto-refresh cho logged-in user by Username
     * @param username - Username
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForUsername(username: string, callback: (items: RecommendationItem[]) => void, options?: RecommendationOptions): () => void;
    /**
     * Transform API response sang RecommendationItem format
     * @param data - Response từ API
     * @returns RecommendationItem[]
     */
    private transformResponse;
    /**
     * Get cached user ID from localStorage
     * @returns Cached user ID or null
     */
    private getCachedUserId;
    /**
     * Get or create anonymous ID cho user
     * @returns Anonymous ID string
     */
    private getOrCreateAnonymousId;
    /**
     * Generate random string cho anonymous ID
     * @param length - Length của string
     * @returns Random string
     */
    private generateRandomString;
    /**
     * Generate cache key
     * @param userValue - User value
     * @param userField - User field type
     * @returns Cache key string
     */
    private getCacheKey;
    /**
     * Get items from cache if not expired
     * @param key - Cache key
     * @returns Cached items or null
     */
    private getFromCache;
    /**
     * Save items to cache
     * @param key - Cache key
     * @param items - Items to cache
     */
    private saveToCache;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Update API base URL
     * @param url - New API base URL
     */
    setApiBaseUrl(url: string): void;
}
//# sourceMappingURL=recommendation-fetcher.d.ts.map