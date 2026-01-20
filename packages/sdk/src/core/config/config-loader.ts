import { TrackerConfig, TrackingRule, ReturnMethod, PayloadMapping } from '../../types';
import { OriginVerifier } from '../utils/origin-verifier';
import { DEFAULT_API_URL } from '../constants';

// Luồng hoạt động
// 1. SDK khởi tạo
// 2. Gọi loadFromWindow() để lấy domainKey từ window
// 3. Tạo config mặc định với các endpoint dựa trên domainKey
// 4. Gọi fetchRemoteConfig() để lấy cấu hình chi tiết từ server
// 5. Merge cấu hình remote với cấu hình local
// 6. Sử dụng cấu hình đã load để thiết lập tracker

// Class để load và quản lý cấu hình tracker
export class ConfigLoader {
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
        trackingRules: [],
        returnMethods: [],
        options: {
          maxRetries: 3,
          batchSize: 10,
          batchDelay: 2000,
          offlineStorage: true,
        },
      };

      return this.config;
    } catch (error) {
      return null;
    }
  }

  // Lấy cấu hình từ server (remote)
  async fetchRemoteConfig(): Promise<TrackerConfig | null> {
    if (!this.domainKey) {
      return this.config;
    }

    const baseUrl = process.env.API_URL || DEFAULT_API_URL;

    try {
      // Bước 1: Gọi các API song song để lấy domain, return methods, event types và search keyword config
      const [domainResponse, rulesListResponse, returnMethodsResponse, eventTypesResponse, searchKeywordResponse] = await Promise.all([
        fetch(`${baseUrl}/domain/${this.domainKey}`),
        fetch(`${baseUrl}/rule/domain/${this.domainKey}`),
        fetch(`${baseUrl}/return-method/${this.domainKey}`),
        fetch(`${baseUrl}/rule/event-type`),
        fetch(`${baseUrl}/search-keyword-config?domainKey=${this.domainKey}`)
      ]);

      // Kiểm tra response
      if (!domainResponse.ok) {
        return this.config;
      }

      // Parse responses
      const domainData = domainResponse.ok ? await domainResponse.json() : null;
      const rulesListData = rulesListResponse.ok ? await rulesListResponse.json() : [];
      const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];
      const eventTypesData = eventTypesResponse.ok ? await eventTypesResponse.json() : [];
      const searchKeywordData = searchKeywordResponse.ok ? await searchKeywordResponse.json() : [];

      // Cập nhật config với data từ server
      if (this.config) {
        this.config = {
          ...this.config,
          domainUrl: domainData?.Url || this.config.domainUrl,
          domainType: domainData?.Type || this.config.domainType,
          trackingRules: this.transformRules(rulesListData),
          returnMethods: this.transformReturnMethods(returnMethodsData),
          eventTypes: this.transformEventTypes(eventTypesData),
          searchKeywordConfig: searchKeywordData && searchKeywordData.length > 0 ? searchKeywordData[0] : undefined,
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
      actionType: rule.ActionType || rule.actionType || null,
      payloadMappings: this.transformPayloadMappings(rule.PayloadMapping || rule.PayloadMappings || rule.payloadMappings || []),
      trackingTarget: this.transformTrackingTargetToString(rule.TrackingTarget || rule.trackingTarget),
    }));
  }

  // Transform payload mappings từ server format sang SDK format
  private transformPayloadMappings(payloadData: any[]): PayloadMapping[] {
    if (!Array.isArray(payloadData)) return [];

    return payloadData.map(payload => ({
      id: payload.Id || payload.id,
      field: payload.Field || payload.field,
      source: payload.Source || payload.source,
      config: payload.Config || payload.config || {},
      trackingRuleId: payload.TrackingRuleId || payload.trackingRuleId,
    }));
  }

  // Transform tracking target từ server format sang SDK format (trả về string)
  private transformTrackingTargetToString(targetData: any): string {
    if (!targetData) {
      return '';
    }

    // Nếu targetData là string (CSS selector), trả về trực tiếp
    if (typeof targetData === 'string') {
      return targetData;
    }

    // Nếu targetData là object, lấy value
    return targetData.Value || targetData.value || '';
  }

  // Transform return methods từ server format sang SDK format
  private transformReturnMethods(returnMethodsData: any): ReturnMethod[] {
    if (!returnMethodsData || !Array.isArray(returnMethodsData)) return [];

    return returnMethodsData.map(method => ({
      id: method.Id || method.id,
      domainId: method.DomainID || method.domainId,
      searchKeywordConfigId: method.SearchKeywordConfigID || method.searchKeywordConfigId || null,
      returnType: method.ReturnType || method.returnType,
      value: method.Value || method.value || '',
      configurationName: method.ConfigurationName || method.configurationName,
    }));
  }

  // Transform event types từ server format sang SDK format
  private transformEventTypes(eventTypesData: any): any[] {
    if (!eventTypesData || !Array.isArray(eventTypesData)) return [];

    return eventTypesData.map(type => ({
      id: type.Id || type.id,
      name: type.Name || type.name,
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
}