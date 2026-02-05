import { ReturnMethod, PopupConfig, InlineConfig } from '../../types';
import { PopupDisplay } from './popup-display';
import { InlineDisplay } from './inline-display';
import { RecommendationFetcher, RecommendationResponse } from '../recommendation';

const ANON_USER_ID_KEY = 'recsys_anon_id';

export class DisplayManager {
  private popupDisplays: Map<string, PopupDisplay> = new Map();
  private inlineDisplays: Map<string, InlineDisplay> = new Map();
  private domainKey: string;
  private apiBaseUrl: string;
  private recommendationFetcher: RecommendationFetcher;
  private cachedRecommendations: RecommendationResponse | null = null;
  private fetchPromise: Promise<RecommendationResponse> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(domainKey: string, apiBaseUrl: string) {
    this.domainKey = domainKey;
    this.apiBaseUrl = apiBaseUrl;
    this.recommendationFetcher = new RecommendationFetcher(domainKey, apiBaseUrl);
  }

  // Khởi tạo display methods dựa trên danh sách config
  public async initialize(returnMethods: ReturnMethod[]): Promise<void> {
    this.destroy();

    if (!returnMethods || !Array.isArray(returnMethods) || returnMethods.length === 0) {
      return;
    }

    // Fetch recommendations once for all display methods
    try {
      await this.fetchRecommendationsOnce();
    } catch (error) {
      // //console.error('[DisplayManager] Failed to fetch recommendations.');
    }

    // Process each return method
    for (const method of returnMethods) {      
      this.activateDisplayMethod(method);
    }
  }

  public notifyActionTriggered(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    // Chống spam API bằng Debounce (đợi 500ms sau hành động cuối cùng)
    this.refreshTimer = setTimeout(async () => {
      await this.refreshAllDisplays();
    }, 500);
  }

  private async refreshAllDisplays(): Promise<void> {
    this.recommendationFetcher.clearCache();
    const newItems = await this.getRecommendations(50);

    //console.log(newItems);
    
    // const oldId = (this.cachedRecommendations as any)?.item?.[0]?.id;
    // const newId = (newItems as any)?.item?.[0]?.id;

    this.cachedRecommendations = newItems;
    this.popupDisplays.forEach(popup => {
      (popup as any).updateContent?.(newItems);
      (popup as any).forceShow?.(); 
    });
    this.inlineDisplays.forEach(inline => (inline as any).updateContent?.(newItems));
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

  private initializePopup(key: string, config: PopupConfig): void {
    try {
      if (this.popupDisplays.has(key)) {
        this.popupDisplays.get(key)?.stop();
        this.popupDisplays.delete(key);
      }
      const popupDisplay = new PopupDisplay(
        this.domainKey,
        key,
        this.apiBaseUrl,
        config, 
        (limit: number) => {
          //console.log('[DisplayManager] recommendationGetter called with limit:', limit);
          // Fetch directly from recommendationFetcher instead of using cache
          return this.recommendationFetcher.fetchForAnonymousUser({ 
            numberItems: limit,
            autoRefresh: false
          });
        }
      );
      
      this.popupDisplays.set(key, popupDisplay);
      popupDisplay.start();
    } catch (error) {
      // //console.error('[DisplayManager] Error initializing popup:', error);
    }
  }

  // Khởi tạo Inline Display với Config đầy đủ
  private initializeInline(key: string, config: InlineConfig): void {
    try {
      if (this.inlineDisplays.has(key)) {
        this.inlineDisplays.get(key)?.stop();
        this.inlineDisplays.delete(key);
      }
      if (!config.selector) return;

      const inlineDisplay = new InlineDisplay(
        this.domainKey,
        key,
        config.selector,
        this.apiBaseUrl,
        config, // Truyền object config
        () => {
          return this.recommendationFetcher.fetchForAnonymousUser({ 
            autoRefresh: false
          });
        }
      );
      
      this.inlineDisplays.set(key, inlineDisplay);
      inlineDisplay.start();
    } catch (error) {
      // //console.error('[DisplayManager] Error initializing inline:', error);
    }
  }

  // --- LOGIC FETCH RECOMMENDATION (GIỮ NGUYÊN) ---
  private async fetchRecommendationsOnce(limit: number = 50): Promise<RecommendationResponse> {
    if (this.cachedRecommendations) return this.cachedRecommendations;
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = this.fetchRecommendationsInternal(limit);
    try {
      this.cachedRecommendations = await this.fetchPromise;
      return this.cachedRecommendations;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchRecommendationsInternal(limit: number): Promise<RecommendationResponse> {
    try {
      const anonymousId = this.getAnonymousId();
      if (!anonymousId) return {item: [], keyword: '', lastItem: ''};
      // Chỉ fetch 1 lần, không enable autoRefresh ở đây để tránh vòng lặp
      const response = await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', { 
        numberItems: limit,
        autoRefresh: false
      });
      return response; 
    } catch (error) { return {item: [], keyword: '', lastItem: ''}; }
  }

  private getAnonymousId(): string | null {
    try {
      return localStorage.getItem(ANON_USER_ID_KEY) || null;
    } catch {
      return null;
    }
  }

  async getRecommendations(limit: number = 50): Promise<RecommendationResponse> {
    if (limit) {
        return this.fetchRecommendationsInternal(limit);
    }
    return this.fetchRecommendationsOnce();
  }

  destroy(): void {
    this.popupDisplays.forEach(popup => popup.stop());
    this.popupDisplays.clear();

    this.inlineDisplays.forEach(inline => inline.stop());
    this.inlineDisplays.clear();
  }
}