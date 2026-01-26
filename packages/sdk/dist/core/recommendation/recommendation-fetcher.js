import { PlaceholderImage } from './placeholder-image';
export class RecommendationFetcher {
    constructor(domainKey, apiBaseUrl = 'https://recsys-tracker-module.onrender.com') {
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
        this.AUTO_REFRESH_INTERVAL = 60 * 1000; // 1 minute auto-refresh
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
        this.cache = new Map();
        this.autoRefreshTimers = new Map();
        this.refreshCallbacks = new Map();
    }
    // constructor(apiBaseUrl: string = 'http://localhost:3001') {
    //   this.apiBaseUrl = apiBaseUrl;
    //   this.cache = new Map();
    // }
    async fetchRecommendations(userValue, userField = 'AnonymousId', _options = {}) {
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(userValue, userField);
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            // Prepare request payload
            const requestBody = {
                AnonymousId: this.getOrCreateAnonymousId(),
                DomainKey: this.domainKey,
                NumberItems: 50,
            };
            // Check for cached user info in localStorage
            const cachedUserId = this.getCachedUserId();
            if (cachedUserId) {
                requestBody.UserId = cachedUserId;
            }
            // Call API
            const response = await fetch(`${this.apiBaseUrl}/recommendation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // Transform response to RecommendationItem
            const items = this.transformResponse(data);
            // Cache results
            this.saveToCache(cacheKey, items);
            // Enable auto-refresh if option is set
            if (_options.autoRefresh && _options.onRefresh) {
                // Check if auto-refresh already enabled for this key
                if (!this.autoRefreshTimers.has(cacheKey)) {
                    console.log(`[RecSysTracker] Auto-refresh enabled for ${cacheKey}`);
                    this.enableAutoRefresh(userValue, userField, _options.onRefresh, _options);
                }
            }
            return items;
        }
        catch (error) {
            console.error('[RecSysTracker] Failed to fetch recommendations:', error);
            throw error;
        }
    }
    /**
     * Enable auto-refresh for recommendations
     * Tự động fetch recommendations mới mỗi 1 phút
     */
    enableAutoRefresh(userValue, userField = 'AnonymousId', callback, options = {}) {
        const cacheKey = this.getCacheKey(userValue, userField);
        console.log(`[RecSysTracker] Starting auto-refresh for ${cacheKey}`);
        console.log(`[RecSysTracker] Refresh interval: ${this.AUTO_REFRESH_INTERVAL}ms (${this.AUTO_REFRESH_INTERVAL / 1000}s)`);
        // Stop existing auto-refresh if any
        this.stopAutoRefresh(cacheKey);
        // Store callback
        this.refreshCallbacks.set(cacheKey, callback);
        // Fetch immediately
        console.log('[RecSysTracker] Fetching initial recommendations...');
        this.fetchRecommendations(userValue, userField, options)
            .then(items => {
            console.log(`[RecSysTracker] Initial fetch successful, received ${items.length} items`);
            callback(items);
        })
            .catch(error => console.error('[RecSysTracker] Initial fetch failed:', error));
        // Set up auto-refresh timer
        const timerId = setInterval(async () => {
            console.log(`[RecSysTracker] Auto-refresh triggered at ${new Date().toLocaleTimeString()}`);
            try {
                // Force fresh fetch by clearing cache for this key
                this.cache.delete(cacheKey);
                console.log(`[RecSysTracker] Cache cleared for ${cacheKey}, fetching fresh data...`);
                const items = await this.fetchRecommendations(userValue, userField, options);
                console.log(`[RecSysTracker] Auto-refresh successful, received ${items.length} items`);
                const cb = this.refreshCallbacks.get(cacheKey);
                if (cb) {
                    console.log('[RecSysTracker] Calling callback with new data');
                    cb(items);
                }
                else {
                    console.warn('[RecSysTracker] Callback not found for', cacheKey);
                }
            }
            catch (error) {
                console.error('[RecSysTracker] Auto-refresh failed:', error);
            }
        }, this.AUTO_REFRESH_INTERVAL);
        this.autoRefreshTimers.set(cacheKey, timerId);
        console.log(`[RecSysTracker] Auto-refresh timer set, timer ID:`, timerId);
        // Return function to stop auto-refresh
        return () => this.stopAutoRefresh(cacheKey);
    }
    // Stop auto-refresh for a specific cache key
    stopAutoRefresh(cacheKey) {
        const timerId = this.autoRefreshTimers.get(cacheKey);
        if (timerId) {
            console.log(`[RecSysTracker] Stopping auto-refresh for ${cacheKey}`);
            clearInterval(timerId);
            this.autoRefreshTimers.delete(cacheKey);
            this.refreshCallbacks.delete(cacheKey);
        }
    }
    /**
     * Stop all auto-refresh timers
     */
    stopAllAutoRefresh() {
        this.autoRefreshTimers.forEach((timerId) => {
            clearInterval(timerId);
        });
        this.autoRefreshTimers.clear();
        this.refreshCallbacks.clear();
    }
    /**
     * Get recommendations cho anonymous user (auto-detect)
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    async fetchForAnonymousUser(options = {}) {
        // Get or generate anonymous ID
        const anonymousId = this.getOrCreateAnonymousId();
        return this.fetchRecommendations(anonymousId, 'AnonymousId', options);
    }
    /**
     * Get recommendations cho logged-in user by ID
     * @param userId - User ID
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    async fetchForUserId(userId, options = {}) {
        return this.fetchRecommendations(userId, 'UserId', options);
    }
    /**
     * Get recommendations cho logged-in user by Username
     * @param username - Username
     * @param options - Optional configuration
     * @returns Promise<RecommendationItem[]>
     */
    async fetchForUsername(username, options = {}) {
        return this.fetchRecommendations(username, 'Username', options);
    }
    /**
     * Enable auto-refresh cho anonymous user
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForAnonymousUser(callback, options = {}) {
        const anonymousId = this.getOrCreateAnonymousId();
        return this.enableAutoRefresh(anonymousId, 'AnonymousId', callback, options);
    }
    /**
     * Enable auto-refresh cho logged-in user by ID
     * @param userId - User ID
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForUserId(userId, callback, options = {}) {
        return this.enableAutoRefresh(userId, 'UserId', callback, options);
    }
    /**
     * Enable auto-refresh cho logged-in user by Username
     * @param username - Username
     * @param callback - Callback function được gọi khi có data mới
     * @param options - Optional configuration
     * @returns Function to stop auto-refresh
     */
    enableAutoRefreshForUsername(username, callback, options = {}) {
        return this.enableAutoRefresh(username, 'Username', callback, options);
    }
    /**
     * Transform API response sang RecommendationItem format
     * @param data - Response từ API
     * @returns RecommendationItem[]
     */
    transformResponse(data) {
        if (!Array.isArray(data)) {
            return [];
        }
        return data.map(item => ({
            id: item.Id,
            domainItemId: item.DomainItemId,
            title: item.Title,
            artist: item.Artist,
            description: item.Description,
            img: item.ImageUrl || PlaceholderImage.getDefaultRecommendation(),
        }));
    }
    /**
     * Get cached user ID from localStorage
     * @returns Cached user ID or null
     */
    getCachedUserId() {
        try {
            const cachedUserInfo = localStorage.getItem('recsys_cached_user_info');
            if (cachedUserInfo) {
                const userInfo = JSON.parse(cachedUserInfo);
                return userInfo.userValue || null;
            }
            return null;
        }
        catch (error) {
            console.warn('[RecSysTracker] Failed to get cached user info:', error);
            return null;
        }
    }
    /**
     * Get or create anonymous ID cho user
     * @returns Anonymous ID string
     */
    getOrCreateAnonymousId() {
        const storageKey = 'recsys_anon_id';
        try {
            // Try to get existing ID from localStorage
            let anonymousId = localStorage.getItem(storageKey);
            if (!anonymousId) {
                // Generate new anonymous ID
                anonymousId = `anon_${Date.now()}_${this.generateRandomString(8)}`;
                localStorage.setItem(storageKey, anonymousId);
            }
            return anonymousId;
        }
        catch (error) {
            // Fallback if localStorage not available
            return `anon_${Date.now()}_${this.generateRandomString(8)}`;
        }
    }
    /**
     * Generate random string cho anonymous ID
     * @param length - Length của string
     * @returns Random string
     */
    generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    /**
     * Generate cache key
     * @param userValue - User value
     * @param userField - User field type
     * @returns Cache key string
     */
    getCacheKey(userValue, userField) {
        return `${userField}:${userValue}`;
    }
    /**
     * Get items from cache if not expired
     * @param key - Cache key
     * @returns Cached items or null
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }
        // Check if cache expired
        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return cached.items;
    }
    /**
     * Save items to cache
     * @param key - Cache key
     * @param items - Items to cache
     */
    saveToCache(key, items) {
        this.cache.set(key, {
            items,
            timestamp: Date.now(),
        });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Update API base URL
     * @param url - New API base URL
     */
    setApiBaseUrl(url) {
        this.apiBaseUrl = url;
        this.clearCache(); // Clear cache when API URL changes
    }
}
//# sourceMappingURL=recommendation-fetcher.js.map