import { TrackerConfig, TrackingRule, ReturnMethod } from '../../types';
import { OriginVerifier } from '../utils/origin-verifier';
import { DEFAULT_API_URL, DEFAULT_CONFIG_ENDPOINT_PATH } from '../constants';

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
      // Bước 1: Gọi 4 API song song để lấy domain, list rules cơ bản, return methods và event types
      const [domainResponse, rulesListResponse, returnMethodsResponse, eventTypesResponse] = await Promise.all([
        fetch(`${baseUrl}${DEFAULT_CONFIG_ENDPOINT_PATH}/${this.domainKey}`),
        fetch(`${baseUrl}/rule/domain/${this.domainKey}`),
        fetch(`${baseUrl}/return-method/${this.domainKey}`),
        fetch(`${baseUrl}/rule/event-type`)
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

      // Cập nhật config với data từ server
      if (this.config) {
        this.config = {
          ...this.config,
          domainUrl: domainData?.Url || this.config.domainUrl,
          domainType: domainData?.Type || this.config.domainType,
          trackingRules: this.transformRules(rulesListData),
          returnMethods: this.transformReturnMethods(returnMethodsData),
          eventTypes: this.transformEventTypes(eventTypesData),
          userIdentities: this.transformUserIdentities(domainData?.UserIdentities || []),
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
      trackingTarget: rule.TrackingTarget || rule.trackingTarget || null,
      itemIdentities: this.transformItemIdentities(rule.ItemIdentities || rule.itemIdentities || []),
    }));
  }

  // Transform item identities từ server format sang SDK format
  private transformItemIdentities(itemIdentitiesData: any[]): any[] {
    if (!Array.isArray(itemIdentitiesData)) return [];

    return itemIdentitiesData.map(identity => ({
      id: identity.Id || identity.id,
      source: identity.Source || identity.source,
      trackingRuleId: identity.TrackingRuleId || identity.trackingRuleId,
      requestConfig: identity.RequestConfig || identity.requestConfig || null,
    }));
  }

  // Transform return methods từ server format sang SDK format
  private transformReturnMethods(returnMethodsData: any): ReturnMethod[] {
    if (!returnMethodsData || !Array.isArray(returnMethodsData)) return [];

    return returnMethodsData.map(method => ({
      id: method.Id || method.id,
      domainId: method.DomainID || method.domainId,
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

  // Transform user identities từ server format sang SDK format
  private transformUserIdentities(userIdentitiesData: any[]): any[] {
    if (!Array.isArray(userIdentitiesData)) return [];

    return userIdentitiesData.map(identity => ({
      id: identity.Id || identity.id,
      source: identity.Source || identity.source,
      domainId: identity.DomainId || identity.domainId,
      requestConfig: identity.RequestConfig || identity.requestConfig || null,
      value: identity.Value || identity.value || null,
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