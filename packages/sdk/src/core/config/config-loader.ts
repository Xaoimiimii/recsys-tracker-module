import { TrackerConfig, TrackingRule, ReturnMethod, PayloadMapping, Condition, TrackingTarget } from '../../types';
import { OriginVerifier } from '../utils/origin-verifier';

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

  // Load config từ window.__RECSYS_DOMAIN_KEY__
  loadFromWindow(): TrackerConfig | null {
    try {
      if (typeof window === 'undefined' || !window.__RECSYS_DOMAIN_KEY__) {
        console.error('[RecSysTracker] window.__RECSYS_DOMAIN_KEY__ not found');
        return null;
      }

      const domainKey = window.__RECSYS_DOMAIN_KEY__;

      if (!domainKey || typeof domainKey !== 'string') {
        console.error('[RecSysTracker] Invalid domain key');
        return null;
      }

      this.domainKey = domainKey;

      // Default config
      this.config = {
        domainKey: domainKey,
        domainUrl: '',
        domainType: 0,
        trackEndpoint: `${this.BASE_API_URL}/event`,
        configEndpoint: `${this.BASE_API_URL}/domain/${domainKey}`,
        trackingRules: [],
        returnMethods: [],
        options: {
          maxRetries: 3,
          batchSize: 10,
          batchDelay: 2000,
          offlineStorage: true,
        },
      };

      const mockConfig = (window as any).RecSysTrackerConfig;
      if (mockConfig) {
        console.log("⚠️ [ConfigLoader] Detect Mock Config from Window. Overriding defaults...");
        this.config = {
          ...this.config,
          ...mockConfig,
          trackingRules: mockConfig.trackingRules || []
        };
      }

      // Adapt Legacy Config (__TRACKER_CONFIG__)
      const legacyRules = this.adaptLegacyConfig();
      if (legacyRules.length > 0 && this.config) {
        this.config.trackingRules = [...(this.config.trackingRules || []), ...legacyRules];

        // Also adapt collectorUrl if needed
        const legacyConfig = (window as any).__TRACKER_CONFIG__;
        if (legacyConfig?.collectorUrl && this.config.trackEndpoint === `${this.BASE_API_URL}/event`) {
          this.config.trackEndpoint = legacyConfig.collectorUrl;
        }
      }

      return this.config;
    } catch (error) {
      console.error('[RecSysTracker] Error loading config:', error);
      return null;
    }
  }

  // Lấy cấu hình từ server (remote)
  async fetchRemoteConfig(): Promise<TrackerConfig | null> {
    // if ((window as any).RecSysTrackerConfig || (window as any).__TRACKER_CONFIG__ || this.domainKey === 'TEST-DOMAIN-KEY') {
    //   console.log("⚠️ [ConfigLoader] Local Config / Mock Mode detected. Skipping Server Fetch.");
    //   return this.config;
    // }
    if (!this.domainKey) {
      return this.config;
    }

    try {
      // Bước 1: Gọi 3 API song song để lấy domain, list rules cơ bản, và return methods
      const [domainResponse, rulesListResponse, returnMethodsResponse] = await Promise.all([
        fetch(`${this.BASE_API_URL}/domain/${this.domainKey}`),
        fetch(`${this.BASE_API_URL}/rule/domain/${this.domainKey}`),
        fetch(`${this.BASE_API_URL}/domain/return-method/${this.domainKey}`)
      ]);

      // Kiểm tra response
      if (!domainResponse.ok) {
        return this.config;
      }

      // Parse responses
      const domainData = domainResponse.ok ? await domainResponse.json() : null;
      const rulesListData = rulesListResponse.ok ? await rulesListResponse.json() : [];
      const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];

      // Bước 2: Lấy chi tiết từng rule
      let rulesData: any[] = [];
      if (Array.isArray(rulesListData) && rulesListData.length > 0) {
        const ruleDetailsPromises = rulesListData.map(rule =>
          fetch(`${this.BASE_API_URL}/rule/${rule.id}`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        );
        const ruleDetails = await Promise.all(ruleDetailsPromises);
        rulesData = ruleDetails.filter(rule => rule !== null);
      }

      // Cập nhật config với data từ server
      if (this.config) {
        this.config = {
          ...this.config,
          domainUrl: domainData?.Url || this.config.domainUrl,
          domainType: domainData?.Type || this.config.domainType,
          trackingRules: this.transformRules(rulesData),
          returnMethods: this.transformReturnMethods(returnMethodsData),
        };

        // Verify origin sau khi có domainUrl từ server
        if (this.config.domainUrl) {
          const isOriginValid = OriginVerifier.verify(this.config.domainUrl);
          if (!isOriginValid) {
            console.error('[RecSysTracker] Origin verification failed. SDK will not function.');
            this.config = null;
            return null;
          }
        }
      }

      return this.config;
    } catch (error) {
      return this.config;
    }
  }

  // Transform rules từ server format sang SDK format
  private transformRules(rulesData: any[]): TrackingRule[] {
    if (!Array.isArray(rulesData)) return [];

    return rulesData.map(rule => ({
      id: rule.Id?.toString() || rule.id?.toString(),
      name: rule.Name || rule.name,
      domainId: rule.DomainID || rule.domainId,
      eventTypeId: rule.EventTypeID || rule.eventTypeId,
      trackingTargetId: rule.TrackingTargetId || rule.trackingTargetId,
      payloadMappings: this.transformPayloadMappings(rule.PayloadMappings || rule.payloadMappings || []),
      conditions: this.transformConditions(rule.Conditions || rule.conditions || []),
      trackingTarget: this.transformTrackingTarget(rule.TrackingTarget || rule.trackingTarget),
    }));
  }

  // Transform conditions từ server format sang SDK format
  private transformConditions(conditionsData: any[]): Condition[] {
    if (!Array.isArray(conditionsData)) return [];

    return conditionsData.map(condition => ({
      id: condition.Id || condition.id,
      value: condition.Value || condition.value,
      trackingRuleId: condition.TrackingRuleID || condition.trackingRuleId,
      patternId: condition.PatternId || condition.patternId,
      operatorId: condition.OperatorID || condition.operatorId,
    }));
  }

  // Transform payload mappings từ server format sang SDK format
  private transformPayloadMappings(payloadData: any[]): PayloadMapping[] {
    if (!Array.isArray(payloadData)) return [];

    return payloadData.map(payload => ({
      id: payload.Id || payload.id,
      field: payload.Field || payload.field,
      source: payload.Source || payload.source,
      value: payload.Value || payload.value,
      requestUrlPattern: payload.RequestUrlPattern || payload.requestUrlPattern || null,
      requestMethod: payload.RequestMethod || payload.requestMethod || null,
      requestBodyPath: payload.RequestBodyPath || payload.requestBodyPath || null,
      urlPart: payload.UrlPart || payload.urlPart || null,
      urlPartValue: payload.UrlPartValue || payload.urlPartValue || null,
      trackingRuleId: payload.TrackingRuleId || payload.trackingRuleId,
    }));
  }

  // Transform tracking target từ server format sang SDK format
  private transformTrackingTarget(targetData: any): TrackingTarget {
    if (!targetData) {
      return {
        id: 0,
        value: '',
        patternId: 0,
        operatorId: 0,
      };
    }

    return {
      id: targetData.Id || targetData.id || 0,
      value: targetData.Value || targetData.value || '',
      patternId: targetData.PatternId || targetData.patternId || 0,
      operatorId: targetData.OperatorId || targetData.operatorId || 0,
    };
  }

  // Transform return methods từ server format sang SDK format
  private transformReturnMethods(returnMethodsData: any): ReturnMethod[] {
    if (!returnMethodsData || !Array.isArray(returnMethodsData)) return [];

    return returnMethodsData.map(method => ({
      id: method.Id || method.id,
      domainId: method.DomainID || method.domainId,
      operatorId: method.OperatorID || method.operatorId,
      returnType: method.ReturnType || method.returnType,
      value: method.Value || method.value || '',
      configurationName: method.ConfigurationName || method.configurationName,
    }));
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
  // Helper to adapt legacy __TRACKER_CONFIG__ to SDK rules
  private adaptLegacyConfig(): TrackingRule[] {
    const legacyConfig = (window as any).__TRACKER_CONFIG__;
    if (!legacyConfig || !legacyConfig.rules || !Array.isArray(legacyConfig.rules)) {
      return [];
    }

    console.log("[RecSysTracker] Adapting legacy tracker configuration...");

    // Generate numeric IDs from timestamp + index to satisfy number type
    const baseId = Date.now();

    return legacyConfig.rules.map((rule: any, index: number) => ({
      id: baseId + index,
      name: rule.label || `Legacy Rule ${index}`,
      eventTypeId: 100, // Custom ID for Network Rules adapted from legacy
      domainId: 0,
      trackingTargetId: 0,
      conditions: [],
      trackingTarget: { id: 0, value: '', patternId: 0, operatorId: 0 },
      payloadMappings: [
        {
          id: baseId + index + 1000,
          field: 'auto_value',
          source: 'network_request', // Explicitly use network_request for PayloadBuilder
          requestUrlPattern: rule.apiUrl,
          requestMethod: rule.method,
          value: rule.bodyPath,
          trackingRuleId: baseId + index,
          requestBodyPath: null,
          urlPart: null,
          urlPartValue: null
        }
      ] as PayloadMapping[]
    }));
  }
}