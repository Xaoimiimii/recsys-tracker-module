import { TrackerConfig, WindowConfig } from '../../types';

// Luồng hoạt động
// 1. SDK khởi tạo
// 2. Gọi loadFromWindow() để lấy domainKey từ window
// 3. Tạo config mặc định với các endpoint dựa trên domainKey
// 4. Gọi fetchRemoteConfig() để lấy cấu hình chi tiết từ server
// 5. Merge cấu hình remote với cấu hình local
// 6. Sử dụng cấu hình đã load để thiết lập tracker

// Class để load và quản lý cấu hình tracker
export class ConfigLoader {
  private readonly BASE_API_URL = process.env.API_URL || 'http://localhost:3000';
  
  private config: TrackerConfig | null = null;
  private domainKey: string | null = null;

  // Load config từ window.RecSysTrackerConfig
  loadFromWindow(): TrackerConfig | null {
    try {
      if (typeof window === 'undefined' || !window.RecSysTrackerConfig) {
        console.warn('[RecSysTracker] No window.RecSysTrackerConfig found');
        return null;
      }

      const windowConfig = window.RecSysTrackerConfig;
      
      // Kiểm tra tính hợp lệ của cấu hình từ window
      if (!this.validateWindowConfig(windowConfig)) {
        console.error('[RecSysTracker] Invalid window configuration');
        return null;
      }

      // Lưu domainKey để fetch data
      this.domainKey = windowConfig.domainKey;

      // Default config
      this.config = {
        domainKey: windowConfig.domainKey,
        trackEndpoint: `${this.BASE_API_URL}/track`,
        configEndpoint: `${this.BASE_API_URL}/domain/${windowConfig.domainKey}`,
        trackingRules: [],
        returnMethods: [],
        options: {
          debug: windowConfig.debug || false,
          maxRetries: 3,
          batchSize: 10,
          batchDelay: 2000,
          offlineStorage: true,
        },
      };

      return this.config;
    } catch (error) {
      console.error('[RecSysTracker] Error loading window config:', error);
      return null;
    }
  }

  // Lấy cấu hình từ server (remote)
  async fetchRemoteConfig(): Promise<TrackerConfig | null> {
    if (!this.domainKey) {
      console.warn('[RecSysTracker] No domain key set');
      return this.config;
    }

    try {
      // Gọi 3 API song song
      const [domainResponse, rulesResponse, returnMethodsResponse] = await Promise.all([
        fetch(`${this.BASE_API_URL}/domain/${this.domainKey}`),
        fetch(`${this.BASE_API_URL}/rule/domain/${this.domainKey}`),
        fetch(`${this.BASE_API_URL}/domain/return-method/${this.domainKey}`)
      ]);

      // Kiểm tra response
      if (!domainResponse.ok) {
        console.warn(`[RecSysTracker] Failed to fetch domain config: ${domainResponse.status}`);
        return this.config;
      }

      // Parse responses
      await domainResponse.json(); // Parse domain data (for future use)
      const rulesData = rulesResponse.ok ? await rulesResponse.json() : [];
      const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];

      // Cập nhật config với data từ server
      if (this.config) {
        this.config = {
          ...this.config,
          trackingRules: this.transformRules(rulesData),
          returnMethods: this.transformReturnMethods(returnMethodsData),
        };
      }

      return this.config;
    } catch (error) {
      console.warn('[RecSysTracker] Error fetching remote config:', error);
      return this.config; // Return local config as fallback
    }
  }

  // Transform rules từ server format sang SDK format
  private transformRules(rulesData: any[]): any[] {
    if (!Array.isArray(rulesData)) return [];
    
    return rulesData.map(rule => ({
      id: rule.Id?.toString() || rule.id,
      name: rule.Name || rule.name,
      domainId: rule.DomainID || rule.domainId,
      triggerEventId: rule.TriggerEventID || rule.triggerEventId,
      targetEventPatternId: rule.TargetElement?.EventPatternID || rule.targetEventPatternId,
      targetOperatorId: rule.TargetElement?.OperatorID || rule.targetOperatorId,
      targetElementValue: rule.TargetElement?.Value || rule.targetElementValue,
      conditions: rule.Conditions || rule.conditions || [],
      payload: rule.PayloadConfigs || rule.payload || [],
    }));
  }

  // Transform return methods từ server format sang SDK format
  private transformReturnMethods(returnMethodsData: any): any[] {
    if (!returnMethodsData || !Array.isArray(returnMethodsData)) return [];
    
    return returnMethodsData.map(method => ({
      key: this.domainKey || '',
      slotName: method.SlotName || method.slotName,
      returnMethodId: method.ReturnMethodID || method.returnMethodId,
      value: method.Value || method.value || '',
    }));
  }

  // Kiểm tra tính hợp lệ của cấu hình từ window
  private validateWindowConfig(config: any): config is WindowConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    if (!config.domainKey || typeof config.domainKey !== 'string') {
      console.error('[RecSysTracker] Missing or invalid domainKey');
      return false;
    }

    return true;
  }

  // Lấy cấu hình hiện tại
  getConfig(): TrackerConfig | null {
    return this.config;
  }

  // Cập nhật cấu hình thủ công
  // updateConfig(updates: Partial<TrackerConfig>): void {
  //   if (this.config) {
  //     this.config = { ...this.config, ...updates };
  //   }
  // }
}