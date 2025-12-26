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
    constructor() {
        this.config = null;
        this.domainKey = null;
        // Cập nhật cấu hình thủ công
        // updateConfig(updates: Partial<TrackerConfig>): void {
        //   if (this.config) {
        //     this.config = { ...this.config, ...updates };
        //   }
        // }
    }
    // Load config từ window.__RECSYS_DOMAIN_KEY__
    loadFromWindow() {
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
            const mockConfig = window.RecSysTrackerConfig;
            if (mockConfig) {
                console.log("⚠️ [ConfigLoader] Detect Mock Config from Window. Overriding defaults...");
                this.config = {
                    ...this.config,
                    ...mockConfig,
                    trackingRules: mockConfig.trackingRules || []
                };
            }
            return this.config;
        }
        catch (error) {
            console.error('[RecSysTracker] Error loading config:', error);
            return null;
        }
    }
    // Lấy cấu hình từ server (remote)
    async fetchRemoteConfig() {
        if (window.RecSysTrackerConfig || this.domainKey === 'TEST-DOMAIN-KEY') {
            console.log("⚠️ [ConfigLoader] Mock Mode detected. Skipping Server Fetch.");
            console.log(this.config);
            return this.config;
        }
        if (!this.domainKey) {
            return this.config;
        }
        const baseUrl = process.env.API_URL || DEFAULT_API_URL;
        try {
            // Bước 1: Gọi 4 API song song để lấy domain, list rules cơ bản, return methods và event types
            const [domainResponse, rulesListResponse, returnMethodsResponse, eventTypesResponse] = await Promise.all([
                fetch(`${baseUrl}${DEFAULT_CONFIG_ENDPOINT_PATH}/${this.domainKey}`),
                fetch(`${baseUrl}/rule/domain/${this.domainKey}`),
                fetch(`${baseUrl}/domain/return-method/${this.domainKey}`),
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
                    domainUrl: (domainData === null || domainData === void 0 ? void 0 : domainData.Url) || this.config.domainUrl,
                    domainType: (domainData === null || domainData === void 0 ? void 0 : domainData.Type) || this.config.domainType,
                    trackingRules: this.transformRules(rulesListData),
                    returnMethods: this.transformReturnMethods(returnMethodsData),
                    eventTypes: this.transformEventTypes(eventTypesData),
                };
                // Verify origin sau khi có domainUrl từ server
                // if (this.config.domainUrl) {
                //   const isOriginValid = OriginVerifier.verify(this.config.domainUrl);
                //   if (!isOriginValid) {
                //     console.error('[RecSysTracker] Origin verification failed. SDK will not function.');
                //     this.config = null;
                //     return null;
                //   }
                // }
            }
            return this.config;
        }
        catch (error) {
            return this.config;
        }
    }
    // Transform rules từ server format sang SDK format
    transformRules(rulesData) {
        if (!Array.isArray(rulesData))
            return [];
        return rulesData.map(rule => {
            var _a, _b;
            return ({
                id: ((_a = rule.Id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = rule.id) === null || _b === void 0 ? void 0 : _b.toString()),
                name: rule.Name || rule.name,
                domainId: rule.DomainID || rule.domainId,
                eventTypeId: rule.EventTypeID || rule.eventTypeId,
                trackingTargetId: rule.TrackingTargetId || rule.trackingTargetId,
                payloadMappings: this.transformPayloadMappings(rule.PayloadMappings || rule.payloadMappings || []),
                conditions: this.transformConditions(rule.Conditions || rule.conditions || []),
                trackingTarget: this.transformTrackingTarget(rule.TrackingTarget || rule.trackingTarget),
            });
        });
    }
    // Transform conditions từ server format sang SDK format
    transformConditions(conditionsData) {
        if (!Array.isArray(conditionsData))
            return [];
        return conditionsData.map(condition => ({
            id: condition.Id || condition.id,
            value: condition.Value || condition.value,
            trackingRuleId: condition.TrackingRuleID || condition.trackingRuleId,
            patternId: condition.PatternId || condition.patternId,
            operatorId: condition.OperatorID || condition.operatorId,
        }));
    }
    // Transform payload mappings từ server format sang SDK format
    transformPayloadMappings(payloadData) {
        if (!Array.isArray(payloadData))
            return [];
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
    transformTrackingTarget(targetData) {
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
    transformReturnMethods(returnMethodsData) {
        if (!returnMethodsData || !Array.isArray(returnMethodsData))
            return [];
        return returnMethodsData.map(method => ({
            id: method.Id || method.id,
            domainId: method.DomainID || method.domainId,
            operatorId: method.OperatorID || method.operatorId,
            returnType: method.ReturnType || method.returnType,
            value: method.Value || method.value || '',
            configurationName: method.ConfigurationName || method.configurationName,
        }));
    }
    // Transform event types từ server format sang SDK format
    transformEventTypes(eventTypesData) {
        if (!eventTypesData || !Array.isArray(eventTypesData))
            return [];
        return eventTypesData.map(type => ({
            id: type.Id || type.id,
            name: type.Name || type.name,
        }));
    }
    // Lấy cấu hình hiện tại
    getConfig() {
        return this.config;
    }
}
//# sourceMappingURL=config-loader.js.map