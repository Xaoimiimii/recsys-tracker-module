import { ReturnMethod } from '../../types';
import { PopupDisplay } from './popup-display';
import { InlineDisplay } from './inline-display';
import { RecommendationFetcher, RecommendationItem } from '../recommendation';

const ANON_USER_ID_KEY = 'recsys_anon_id';

export class DisplayManager {
  private popupDisplay: PopupDisplay | null = null;
  private inlineDisplay: InlineDisplay | null = null;
  private domainKey: string;
  private apiBaseUrl: string;
  private recommendationFetcher: RecommendationFetcher;
  private cachedRecommendations: RecommendationItem[] | null = null;
  private fetchPromise: Promise<RecommendationItem[]> | null = null;
  private searchKeywordPlugin: any = null;

  constructor(domainKey: string, apiBaseUrl: string = 'https://recsys-tracker-module.onrender.com') {
    this.domainKey = domainKey;
    this.apiBaseUrl = apiBaseUrl;
    this.recommendationFetcher = new RecommendationFetcher(domainKey, apiBaseUrl);
  }

  // Khởi tạo display methods dựa trên config
  async initialize(returnMethods: ReturnMethod[]): Promise<void> {
    if (!returnMethods || returnMethods.length === 0) {
      return;
    }

    // Fetch recommendations 1 lần duy nhất cho tất cả display methods
    await this.fetchRecommendationsOnce();

    // Process each return method
    for (const method of returnMethods) {
      // Check if this method has SearchKeywordConfigID
      if (method.searchKeywordConfigId && this.searchKeywordPlugin) {
        await this.handleSearchKeywordReturnMethod(method);
      }
      
      this.activateDisplayMethod(method);
    }
  }

  /**
   * Set SearchKeywordPlugin reference (called from RecSysTracker)
   */
  public setSearchKeywordPlugin(plugin: any): void {
    this.searchKeywordPlugin = plugin;
  }

  /**
   * Handle return method with SearchKeywordConfigID
   */
  private async handleSearchKeywordReturnMethod(method: ReturnMethod): Promise<void> {
    if (!method.searchKeywordConfigId || !this.searchKeywordPlugin) return;

    // Get saved keyword for this config ID
    const keyword = this.searchKeywordPlugin.getKeyword(method.searchKeywordConfigId);
    
    if (keyword) {
      // Get user info
      const userInfo = (window as any).RecSysTracker?.userIdentityManager?.getUserInfo?.() || {};
      const userId = userInfo.value || '';
      const anonymousId = userInfo.anonymousId || '';

      // Push keyword to server
      await this.searchKeywordPlugin.pushKeywordToServer(
        userId,
        anonymousId,
        this.domainKey,
        keyword
      );
    }
  }

  // Fetch recommendations 1 lần duy nhất và cache kết quả
  private async fetchRecommendationsOnce(): Promise<RecommendationItem[]> {
    // Nếu đã có cache, return ngay
    if (this.cachedRecommendations) {
      return this.cachedRecommendations;
    }

    // Nếu đang fetch, đợi kết quả
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Fetch mới
    this.fetchPromise = this.fetchRecommendationsInternal();
    try {
      this.cachedRecommendations = await this.fetchPromise;
      return this.cachedRecommendations;
    } finally {
      this.fetchPromise = null;
    }
  }

  // Internal fetch method
  private async fetchRecommendationsInternal(): Promise<RecommendationItem[]> {
    try {
      // MOCK: Temporarily using UserId="1" for testing
      // TODO: Uncomment below code when enough data is available
      
      const anonymousId = this.getAnonymousId();
      if (!anonymousId) {
        return [];
      }

      const items = await this.recommendationFetcher.fetchRecommendations(
        anonymousId,
        'AnonymousId',
        { numberItems: 6 }
      );

      return items;
    } catch (error) {
      return [];
    }
  }

  // Lấy anonymous ID từ localStorage (recsys_anon_id)
  private getAnonymousId(): string | null {
    try {
      const anonId = localStorage.getItem(ANON_USER_ID_KEY);
      if (anonId) {
        return anonId;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Get cached recommendations
  async getRecommendations(): Promise<RecommendationItem[]> {
    return this.fetchRecommendationsOnce();
  }

  // Kích hoạt display method tương ứng
  private activateDisplayMethod(method: ReturnMethod): void {
    const { returnType, configurationName, value } = method;

    switch (returnType) {
      case 'POPUP': // Popup
        this.initializePopup(configurationName, value);
        break;
      
      case 'INLINE-INJECTION': // Inline (with hyphen)
      case 'INLINE_INJECTION': // Inline (with underscore)
        this.initializeInline(configurationName, value);
        break;
      
      default:
        // do nothing
        break;
    }
  }

  // Khởi tạo Popup Display
  private initializePopup(slotName: string, config: string): void {
    try {
      // Parse config nếu là JSON string, nếu không thì dùng default
      let popupConfig: any = {};
      if (config) {
        try {
          popupConfig = JSON.parse(config);
        } catch {
          popupConfig = {};
        }
      }

      this.popupDisplay = new PopupDisplay(
        this.domainKey,
        slotName,
        this.apiBaseUrl,
        popupConfig,
        () => this.getRecommendations() // Provide getter function
      );
      
      this.popupDisplay.start();
    } catch (error) {
      // console.error('[DisplayManager] Error initializing popup:', error);
    }
  }

  // Khởi tạo Inline Display
  private initializeInline(slotName: string, selector: string): void {
    try {
      if (!selector) {
        return;
      }

      this.inlineDisplay = new InlineDisplay(
        this.domainKey,
        slotName,
        selector,
        this.apiBaseUrl,
        {},
        () => this.getRecommendations() // Provide getter function
      );
      
      this.inlineDisplay.start();
    } catch (error) {
      console.error('[DisplayManager] Error initializing inline:', error);
    }
  }

  // Dừng tất cả display methods
  destroy(): void {
    if (this.popupDisplay) {
      this.popupDisplay.stop();
      this.popupDisplay = null;
    }

    if (this.inlineDisplay) {
      this.inlineDisplay.stop();
      this.inlineDisplay = null;
    }
  }
}
