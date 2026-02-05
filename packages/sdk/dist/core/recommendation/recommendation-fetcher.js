export class RecommendationFetcher {
    constructor(domainKey, apiBaseUrl) {
        this.CACHE_TTL = 5 * 60 * 1000;
        this.AUTO_REFRESH_INTERVAL = 60 * 1000;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
        this.cache = new Map();
        this.autoRefreshTimers = new Map();
        this.refreshCallbacks = new Map();
    }
    async fetchRecommendations(userValue, userField = 'AnonymousId', _options = {}) {
        try {
            const limit = _options.numberItems || 50;
            const cacheKey = this.getCacheKey(userValue, userField);
            const cached = this.getFromCache(cacheKey);
            if (cached && cached.item.length >= limit) {
                return cached;
            }
            const requestBody = {
                AnonymousId: this.getOrCreateAnonymousId(),
                DomainKey: this.domainKey,
                NumberItems: limit,
            };
            const cachedUserId = this.getCachedUserId();
            if (cachedUserId) {
                requestBody.UserId = cachedUserId;
            }
            const response = await fetch(`${this.apiBaseUrl}/recommendation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            const data = await response.json();
            console.log('>>> RAW DATA FROM API:', data);
            const transformedItems = this.transformResponse(data.item || data.items || []);
            const finalResponse = {
                item: transformedItems,
                keyword: data.keyword || data.search || '',
                lastItem: data.lastItem || ''
            };
            console.log("FINAL RESPONSE: ", finalResponse);
            this.saveToCache(cacheKey, finalResponse);
            // Giữ nguyên logic đăng ký auto-refresh của bạn
            if (_options.autoRefresh && _options.onRefresh) {
                if (!this.autoRefreshTimers.has(cacheKey)) {
                    this.enableAutoRefresh(userValue, userField, _options.onRefresh, _options);
                }
            }
            return finalResponse;
        }
        catch (error) {
            return { item: [], keyword: '', lastItem: '' };
        }
    }
    enableAutoRefresh(userValue, userField = 'AnonymousId', callback, options = {}) {
        const cacheKey = this.getCacheKey(userValue, userField);
        this.stopAutoRefresh(cacheKey);
        this.refreshCallbacks.set(cacheKey, callback);
        this.fetchRecommendations(userValue, userField, options)
            .then(data => callback(data));
        const timerId = setInterval(async () => {
            try {
                this.cache.delete(cacheKey);
                const data = await this.fetchRecommendations(userValue, userField, {
                    ...options,
                    autoRefresh: false
                });
                const cb = this.refreshCallbacks.get(cacheKey);
                if (cb)
                    cb(data);
            }
            catch (error) { }
        }, this.AUTO_REFRESH_INTERVAL);
        this.autoRefreshTimers.set(cacheKey, timerId);
        return () => this.stopAutoRefresh(cacheKey);
    }
    stopAutoRefresh(cacheKey) {
        const timerId = this.autoRefreshTimers.get(cacheKey);
        if (timerId) {
            clearInterval(timerId);
            this.autoRefreshTimers.delete(cacheKey);
            this.refreshCallbacks.delete(cacheKey);
        }
    }
    stopAllAutoRefresh() {
        this.autoRefreshTimers.forEach((timerId) => clearInterval(timerId));
        this.autoRefreshTimers.clear();
        this.refreshCallbacks.clear();
    }
    async fetchForAnonymousUser(options = {}) {
        const anonymousId = this.getOrCreateAnonymousId();
        return this.fetchRecommendations(anonymousId, 'AnonymousId', options);
    }
    async fetchForUserId(userId, options = {}) {
        return this.fetchRecommendations(userId, 'UserId', options);
    }
    async fetchForUsername(username, options = {}) {
        return this.fetchRecommendations(username, 'Username', options);
    }
    // Giữ nguyên 100% logic transform ban đầu của bạn
    transformResponse(data) {
        const rawItems = Array.isArray(data) ? data : (data.item || []);
        return rawItems.map((item) => {
            return {
                ...item,
                displayTitle: item.Title || item.Name || item.Subject || 'No Title',
                displayImage: item.ImageUrl || item.Thumbnail || item.Image || '',
                displayId: item.DomainItemId || item.Id || Math.random().toString(),
                id: item.Id
            };
        });
    }
    getOrCreateAnonymousId() {
        const storageKey = 'recsys_anon_id';
        try {
            let anonymousId = localStorage.getItem(storageKey);
            if (!anonymousId) {
                anonymousId = `anon_${Date.now()}_${this.generateRandomString(8)}`;
                localStorage.setItem(storageKey, anonymousId);
            }
            return anonymousId;
        }
        catch {
            return `anon_${Date.now()}_${this.generateRandomString(8)}`;
        }
    }
    generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++)
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
    getCachedUserId() {
        try {
            const cachedUserInfo = localStorage.getItem('recsys_cached_user_info');
            return cachedUserInfo ? JSON.parse(cachedUserInfo).userValue : null;
        }
        catch {
            return null;
        }
    }
    getCacheKey(userValue, userField) {
        return `${userField}:${userValue}`;
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    saveToCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    clearCache() { this.cache.clear(); }
    setApiBaseUrl(url) { this.apiBaseUrl = url; this.clearCache(); }
}
//# sourceMappingURL=recommendation-fetcher.js.map