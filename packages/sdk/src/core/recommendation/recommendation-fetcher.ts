import { 
  RecommendationRequest, 
  RecommendationResponse, 
  RecommendationItem,
  RecommendationOptions,
  UserField
} from './types';
import { PlaceholderImage } from './placeholder-image';

/**
 * RecommendationFetcher - Class để fetch và quản lý recommendation data
 * Design pattern tương tự ConfigLoader
 */
export class RecommendationFetcher {
  private domainKey: string;
  private apiBaseUrl: string;
  private cache: Map<string, { items: RecommendationItem[], timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(domainKey: string, apiBaseUrl: string = 'https://recsys-tracker-module.onrender.com') {
    this.domainKey = domainKey;
    this.apiBaseUrl = apiBaseUrl;
    this.cache = new Map();
  }

  /**
   * Fetch recommendations cho user hiện tại
   * @param userValue - User ID/Username/AnonymousId
   * @param userField - Loại user field (UserId, Username, AnonymousId)
   * @param options - Optional configuration
   * @returns Promise<RecommendationItem[]>
   */
  async fetchRecommendations(
    userValue: string,
    userField: UserField = 'AnonymousId',
    options: RecommendationOptions = {}
  ): Promise<RecommendationItem[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(userValue, userField);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('[RecommendationFetcher] Returning cached results');
        return cached;
      }

      // Prepare request payload
      const requestBody: RecommendationRequest = {
        UserValue: userValue,
        UserField: userField,
        DomainKey: this.domainKey,
        NumberItems: options.numberItems || 10,
      };

      console.log('[RecommendationFetcher] Fetching recommendations:', requestBody);

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

      console.log(`[RecommendationFetcher] Fetched ${items.length} recommendations`);
      return items;

    } catch (error) {
      console.error('[RecommendationFetcher] Error fetching recommendations:', error);
      throw error;
    }
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
   * Transform API response sang RecommendationItem format
   * @param data - Response từ API
   * @returns RecommendationItem[]
   */
  private transformResponse(data: RecommendationResponse[]): RecommendationItem[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => ({
      id: item.Id,
      domainItemId: item.DomainItemId,
      title: item.Title,
      description: item.Description,
      img: PlaceholderImage.getDefaultRecommendation(), // Use placeholder
    }));
  }

  /**
   * Get or create anonymous ID cho user
   * @returns Anonymous ID string
   */
  private getOrCreateAnonymousId(): string {
    const storageKey = 'recsys_anonymous_id';
    
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
      console.warn('[RecommendationFetcher] localStorage not available, using session ID');
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
