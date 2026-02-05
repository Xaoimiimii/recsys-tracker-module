import {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationItem,
  RecommendationOptions,
  UserField
} from './types';
import { PlaceholderImage } from './placeholder-image';

export class RecommendationFetcher {
  private domainKey: string;
  private apiBaseUrl: string;
  private cache: Map<string, { items: RecommendationItem[], timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly AUTO_REFRESH_INTERVAL = 60 * 1000; // 1 minute auto-refresh
  private autoRefreshTimers: Map<string, NodeJS.Timeout | number>;
  private refreshCallbacks: Map<string, (items: RecommendationItem[]) => void>;

  constructor(domainKey: string, apiBaseUrl: string = 'https://recsys-tracker-module.onrender.com') {
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

  async fetchRecommendations(
    userValue: string,
    userField: UserField = 'AnonymousId',
    _options: RecommendationOptions = {}
  ): Promise<RecommendationItem[]> {
    try {
      // Check cache first
      const limit = _options.numberItems || 50;
      const cacheKey = this.getCacheKey(userValue, userField);
      const cached = this.getFromCache(cacheKey);
      if (cached && cached.length >= limit) {
        return cached.slice(0, limit);
      }

      // Prepare request payload
      const requestBody: RecommendationRequest = {
        AnonymousId: this.getOrCreateAnonymousId(),
        DomainKey: this.domainKey,
        NumberItems: limit,
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

      const data: RecommendationResponse[] = await response.json();

      // Transform response to RecommendationItem
      const items = this.transformResponse(data);

      // Cache results
      this.saveToCache(cacheKey, items);

      // Enable auto-refresh if option is set
      if (_options.autoRefresh && _options.onRefresh) {
        // Check if auto-refresh already enabled for this key
        if (!this.autoRefreshTimers.has(cacheKey)) {
          this.enableAutoRefresh(userValue, userField, _options.onRefresh, _options);
        }
      }

      return items;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Enable auto-refresh for recommendations
   * Tự động fetch recommendations mới mỗi 1 phút
   */
  enableAutoRefresh(
    userValue: string,
    userField: UserField = 'AnonymousId',
    callback: (items: RecommendationItem[]) => void,
    options: RecommendationOptions = {}
  ): () => void {
    const cacheKey = this.getCacheKey(userValue, userField);

    // Stop existing auto-refresh if any
    this.stopAutoRefresh(cacheKey);

    // Store callback
    this.refreshCallbacks.set(cacheKey, callback);

    // Fetch immediately
    this.fetchRecommendations(userValue, userField, options)
      .then(items => {
        callback(items);
      })

    // Set up auto-refresh timer
    const timerId = setInterval(async () => {
      try {
        // Force fresh fetch by clearing cache for this key
        this.cache.delete(cacheKey);
        
        const items = await this.fetchRecommendations(userValue, userField, options);
        
        const cb = this.refreshCallbacks.get(cacheKey);
        if (cb) {
          cb(items);
        }
      } catch (error) {
        // console.error('[RecSysTracker] Auto-refresh failed:', error);
      }
    }, this.AUTO_REFRESH_INTERVAL);

    this.autoRefreshTimers.set(cacheKey, timerId);

    // Return function to stop auto-refresh
    return () => this.stopAutoRefresh(cacheKey);
  }

  // Stop auto-refresh for a specific cache key
  private stopAutoRefresh(cacheKey: string): void {
    const timerId = this.autoRefreshTimers.get(cacheKey);
    if (timerId) {
      clearInterval(timerId as NodeJS.Timeout);
      this.autoRefreshTimers.delete(cacheKey);
      this.refreshCallbacks.delete(cacheKey);
    }
  }

  /**
   * Stop all auto-refresh timers
   */
  stopAllAutoRefresh(): void {
    this.autoRefreshTimers.forEach((timerId) => {
      clearInterval(timerId as NodeJS.Timeout);
    });
    this.autoRefreshTimers.clear();
    this.refreshCallbacks.clear();
  }

  /**
   * Get recommendations cho anonymous user (auto-detect)
   * @param options - Optional configuration
   * @returns Promise<RecommendationItem[]>
   */
  async fetchForAnonymousUser(options: RecommendationOptions = {}): Promise<RecommendationItem[]> {
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
  async fetchForUserId(userId: string, options: RecommendationOptions = {}): Promise<RecommendationItem[]> {
    return this.fetchRecommendations(userId, 'UserId', options);
  }

  /**
   * Get recommendations cho logged-in user by Username
   * @param username - Username
   * @param options - Optional configuration
   * @returns Promise<RecommendationItem[]>
   */
  async fetchForUsername(username: string, options: RecommendationOptions = {}): Promise<RecommendationItem[]> {
    return this.fetchRecommendations(username, 'Username', options);
  }

  /**
   * Enable auto-refresh cho anonymous user
   * @param callback - Callback function được gọi khi có data mới
   * @param options - Optional configuration
   * @returns Function to stop auto-refresh
   */
  enableAutoRefreshForAnonymousUser(
    callback: (items: RecommendationItem[]) => void,
    options: RecommendationOptions = {}
  ): () => void {
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
  enableAutoRefreshForUserId(
    userId: string,
    callback: (items: RecommendationItem[]) => void,
    options: RecommendationOptions = {}
  ): () => void {
    return this.enableAutoRefresh(userId, 'UserId', callback, options);
  }

  /**
   * Enable auto-refresh cho logged-in user by Username
   * @param username - Username
   * @param callback - Callback function được gọi khi có data mới
   * @param options - Optional configuration
   * @returns Function to stop auto-refresh
   */
  enableAutoRefreshForUsername(
    username: string,
    callback: (items: RecommendationItem[]) => void,
    options: RecommendationOptions = {}
  ): () => void {
    return this.enableAutoRefresh(username, 'Username', callback, options);
  }

  /**
   * Transform API response sang RecommendationItem format
   * @param data - Response từ API
   * @returns RecommendationItem[]
   */
  private transformResponse(data: RecommendationResponse[]): RecommendationItem[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => {
      const result: RecommendationItem = { ...item };
      result.id = item.DomainItemId;
      const rawImg = item.ImageUrl || item.imageUrl || item.Image || item.img;
      result.img = rawImg || PlaceholderImage.getDefaultRecommendation();
      result.title = item.title || item.Title || item.Name || item.name;
      return result;
    });
  }

  /**
   * Get cached user ID from localStorage
   * @returns Cached user ID or null
   */
  private getCachedUserId(): string | null {
    try {
      const cachedUserInfo = localStorage.getItem('recsys_cached_user_info');
      if (cachedUserInfo) {
        const userInfo = JSON.parse(cachedUserInfo);
        return userInfo.userValue || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get or create anonymous ID cho user
   * @returns Anonymous ID string
   */
  private getOrCreateAnonymousId(): string {
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
    } catch (error) {
      // Fallback if localStorage not available
      return `anon_${Date.now()}_${this.generateRandomString(8)}`;
    }
  }

  /**
   * Generate random string cho anonymous ID
   * @param length - Length của string
   * @returns Random string
   */
  private generateRandomString(length: number): string {
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
  private getCacheKey(userValue: string, userField: UserField): string {
    return `${userField}:${userValue}`;
  }

  /**
   * Get items from cache if not expired
   * @param key - Cache key
   * @returns Cached items or null
   */
  private getFromCache(key: string): RecommendationItem[] | null {
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
  private saveToCache(key: string, items: RecommendationItem[]): void {
    this.cache.set(key, {
      items,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update API base URL
   * @param url - New API base URL
   */
  setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
    this.clearCache(); // Clear cache when API URL changes
  }
}
