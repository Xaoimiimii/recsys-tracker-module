import { ReturnMethod, PopupConfig, InlineConfig } from '../../types';
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

  // Khởi tạo display methods dựa trên danh sách config
  public async initialize(returnMethods: ReturnMethod[]): Promise<void> {
    this.destroy();

    console.log("return", returnMethods);

    if (!returnMethods || !Array.isArray(returnMethods) || returnMethods.length === 0) {
      console.warn('[DisplayManager] No return methods provided for initialization.');
      return;
    }

    // Fetch recommendations once for all display methods
    try {
      await this.fetchRecommendationsOnce();
    } catch (error) {
      console.error('[DisplayManager] Failed to fetch recommendations.');
    }

    // Process each return method
    for (const method of returnMethods) {
      // Check if this method has SearchKeywordConfigID
      if (method.SearchKeywordConfigId && this.searchKeywordPlugin) {
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
    if (!method.SearchKeywordConfigId || !this.searchKeywordPlugin) return;

    // Get saved keyword for this config ID
    const keyword = this.searchKeywordPlugin.getKeyword(method.SearchKeywordConfigId);
    
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

  // Phân loại và kích hoạt display method tương ứng
  private activateDisplayMethod(method: ReturnMethod): void {
    const { ReturnType, ConfigurationName, Value, OperatorId } = method;

    // Chuẩn bị cấu hình chung (Giao diện, Style, Fields)
    const commonConfig = {
        layoutJson: method.LayoutJson,
        styleJson: method.StyleJson,
        customizingFields: method.CustomizingFields
    };

    // Kiểm tra loại hiển thị (Lưu ý: Backend thường trả về chữ hoa)
    const type = ReturnType?.toUpperCase();

    if (type === 'POPUP') {
      const duration = (method.DelayDuration ?? 0) * 1000;
      const popupConfig: PopupConfig = {
          ...commonConfig,
          delay: duration,
          autoCloseDelay: 0,
          triggerConfig: {
              targetValue: Value,      
              operatorId: OperatorId
          }
      };
      this.initializePopup(ConfigurationName, popupConfig);
    }
    else if (type === 'INLINE-INJECTION' || type === 'INLINE_INJECTION') {
      const inlineConfig: InlineConfig = {
          ...commonConfig,
          selector: Value 
      };
      this.initializeInline(ConfigurationName, inlineConfig);
    }
  }

  // Khởi tạo Popup Display với Config đầy đủ
  // private initializePopup(slotName: string, config: PopupConfig): void {
  //   try {
  //     this.popupDisplay = new PopupDisplay(
  //       this.domainKey,
  //       slotName,
  //       this.apiBaseUrl,
  //       config, 
  //       () => this.getRecommendations()
  //     );
      
  //     this.popupDisplay.start();
  //   } catch (error) {
  //     console.error('[DisplayManager] Error initializing popup:', error);
  //   }
  // }

  private initializePopup(slotName: string, config: PopupConfig): void {
    try {
      if (this.popupDisplay) {
        this.popupDisplay.stop();
        this.popupDisplay = null;
      }
      this.popupDisplay = new PopupDisplay(
        this.domainKey,
        slotName,
        this.apiBaseUrl,
        config, 
        //() => this.getRecommendations()
      );
      
      this.popupDisplay.start();
    } catch (error) {
      console.error('[DisplayManager] Error initializing popup:', error);
    }
  }

  // Khởi tạo Inline Display với Config đầy đủ
  private initializeInline(slotName: string, config: InlineConfig): void {
    try {
      if (this.inlineDisplay) {
        this.inlineDisplay.stop();
        this.inlineDisplay = null;
      }
      if (!config.selector) return;

      this.inlineDisplay = new InlineDisplay(
        this.domainKey,
        slotName,
        config.selector,
        this.apiBaseUrl,
        config, // Truyền object config
        //() => this.getRecommendations()
      );
      
      this.inlineDisplay.start();
    } catch (error) {
      console.error('[DisplayManager] Error initializing inline:', error);
    }
  }

  // --- LOGIC FETCH RECOMMENDATION (GIỮ NGUYÊN) ---

  private async fetchRecommendationsOnce(): Promise<RecommendationItem[]> {
    if (this.cachedRecommendations) return this.cachedRecommendations;
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = this.fetchRecommendationsInternal();
    try {
      this.cachedRecommendations = await this.fetchPromise;
      return this.cachedRecommendations;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchRecommendationsInternal(): Promise<RecommendationItem[]> {
    try {
      const anonymousId = this.getAnonymousId();
      if (!anonymousId) return [];

      return await this.recommendationFetcher.fetchRecommendations(
        anonymousId,
        'AnonymousId',
        { numberItems: 6 }
      );
    } catch (error) {
      return [];
    }
  }

  private getAnonymousId(): string | null {
    try {
      return localStorage.getItem(ANON_USER_ID_KEY) || null;
    } catch {
      return null;
    }
  }

  async getRecommendations(): Promise<RecommendationItem[]> {
    return this.fetchRecommendationsOnce();
  }

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