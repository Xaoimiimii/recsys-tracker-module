import {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationItem,
  RecommendationOptions,
  UserField
} from './types';

export class RecommendationFetcher {
  private domainKey: string;
  private apiBaseUrl: string;
  private cache: Map<string, { data: RecommendationItem[], timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; 
  private readonly AUTO_REFRESH_INTERVAL = 60 * 1000; 
  private autoRefreshTimers: Map<string, NodeJS.Timeout | number>;
  private refreshCallbacks: Map<string, (data: RecommendationResponse) => void>;

  constructor(domainKey: string, apiBaseUrl: string) {
    this.domainKey = domainKey;
    this.apiBaseUrl = apiBaseUrl;
    this.cache = new Map();
    this.autoRefreshTimers = new Map();
    this.refreshCallbacks = new Map();
  }

  async fetchRecommendations(
    userValue: string,
    userField: UserField = 'AnonymousId',
    _options: RecommendationOptions = {}
  ): Promise<RecommendationResponse> {
    try {
      const limit = _options.numberItems || 50;
      const cacheKey = this.getCacheKey(userValue, userField);

      const cached = this.getFromCache(cacheKey);
      if (cached && cached.length >= limit) {
        return {
          item: cached,
          keyword: '', 
          lastItem: ''
        };
      }

      const requestBody: RecommendationRequest = {
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
      const data: RecommendationResponse = await response.json();
      // Flexible: check 'item' first, then fallback to 'items'
      const rawItems = (data.item && data.item.length > 0) ? data.item : (data.items || []);
      const transformedItems = this.transformResponse(rawItems);
      
      const finalResponse: RecommendationResponse = {
        item: transformedItems,
        keyword: data.keyword || '',
        lastItem: data.lastItem || ''
      };
      this.saveToCache(cacheKey, transformedItems);

      // Giữ nguyên logic đăng ký auto-refresh của bạn
      if (_options.autoRefresh && _options.onRefresh) {
        if (!this.autoRefreshTimers.has(cacheKey)) {
          this.enableAutoRefresh(userValue, userField, _options.onRefresh as any, _options);
        }
      }

      return finalResponse;
    } catch (error) {
      return { item: [], keyword: '', lastItem: '' };
    }
  }

  enableAutoRefresh(
    userValue: string,
    userField: UserField = 'AnonymousId',
    callback: (data: RecommendationResponse) => void,
    options: RecommendationOptions = {}
  ): () => void {
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
        if (cb) cb(data);
      } catch (error) {}
    }, this.AUTO_REFRESH_INTERVAL);

    this.autoRefreshTimers.set(cacheKey, timerId);
    return () => this.stopAutoRefresh(cacheKey);
  }

  private stopAutoRefresh(cacheKey: string): void {
    const timerId = this.autoRefreshTimers.get(cacheKey);
    if (timerId) {
      clearInterval(timerId as NodeJS.Timeout);
      this.autoRefreshTimers.delete(cacheKey);
      this.refreshCallbacks.delete(cacheKey);
    }
  }

  public stopAllAutoRefresh(): void {
    this.autoRefreshTimers.forEach((timerId) => clearInterval(timerId as NodeJS.Timeout));
    this.autoRefreshTimers.clear();
    this.refreshCallbacks.clear();
  }

  async fetchForAnonymousUser(options: RecommendationOptions = {}): Promise<RecommendationResponse> {
    const anonymousId = this.getOrCreateAnonymousId();
    return this.fetchRecommendations(anonymousId, 'AnonymousId', options);
  }

  async fetchForUserId(userId: string, options: RecommendationOptions = {}): Promise<RecommendationResponse> {
    return this.fetchRecommendations(userId, 'UserId', options);
  }

  async fetchForUsername(username: string, options: RecommendationOptions = {}): Promise<RecommendationResponse> {
    return this.fetchRecommendations(username, 'Username', options);
  }

  // Giữ nguyên 100% logic transform ban đầu của bạn
  private transformResponse(data: any): RecommendationItem[] {
    const rawItems = Array.isArray(data) ? data : (data.item || []);
    return rawItems.map((item: any) => {
      return {
        ...item,
        displayTitle: item.Title || item.Name || item.Subject || 'No Title',
        displayImage: item.ImageUrl || item.Thumbnail || item.Image || '',
        displayId: item.DomainItemId || item.Id || Math.random().toString(),
        id: item.Id
      };
    });
  }

  private getOrCreateAnonymousId(): string {
    const storageKey = 'recsys_anon_id';
    try {
      let anonymousId = localStorage.getItem(storageKey);
      if (!anonymousId) {
        anonymousId = `anon_${Date.now()}_${this.generateRandomString(8)}`;
        localStorage.setItem(storageKey, anonymousId);
      }
      return anonymousId;
    } catch { return `anon_${Date.now()}_${this.generateRandomString(8)}`; }
  }

  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  }

  private getCachedUserId(): string | null {
    try {
      const cachedUserInfo = localStorage.getItem('recsys_cached_user_info');
      return cachedUserInfo ? JSON.parse(cachedUserInfo).userValue : null;
    } catch { return null; }
  }

  private getCacheKey(userValue: string, userField: UserField): string {
    return `${userField}:${userValue}`;
  }

  private getFromCache(key: string): RecommendationItem[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  private saveToCache(key: string, data: RecommendationItem[]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clearCache(): void { this.cache.clear(); }
  public setApiBaseUrl(url: string): void { this.apiBaseUrl = url; this.clearCache(); }
}