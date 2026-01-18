export interface TrackerConfig {
    domainKey: string;
    domainUrl?: string;
    domainType?: number;
    trackingRules?: TrackingRule[];
    returnMethods?: ReturnMethod[];
    eventTypes?: EventType[];
    options?: TrackerOptions;
}
export interface EventType {
    id: number;
    name: string;
}
export interface TrackingRule {
    id: number;
    name: string;
    domainId: number;
    eventTypeId: number;
    actionType?: string | null;
    payloadMappings: PayloadMapping[];
    trackingTarget: string;
}
export interface PayloadMapping {
    id?: number;
    field: string;
    source: string;
    config: PayloadMappingConfig;
    trackingRuleId?: number;
}
export interface PayloadMappingConfig {
    RequestUrlPattern?: string;
    RequestMethod?: string;
    Value?: string;
    ExtractType?: 'pathname' | 'query';
    SelectorPattern?: string;
}
export interface UserIdentityConfig {
    id?: number;
    source: 'request_body' | 'request_url' | 'local_storage' | 'session_storage' | 'cookie' | 'element';
    domainId: number;
    requestConfig?: UserIdentityRequestConfig | null;
    value?: string | null;
    field: 'UserId' | 'AnonymousId';
}
export interface UserIdentityRequestConfig {
    RequestUrlPattern: string;
    RequestMethod: string;
    Value: string;
    ExtractType?: 'pathname' | 'query';
}
export interface ReturnMethod {
    id: number;
    domainId: number;
    returnType: string;
    value: string;
    configurationName: string;
}
export interface TrackerOptions {
    maxRetries?: number;
    batchSize?: number;
    batchDelay?: number;
    offlineStorage?: boolean;
}
declare global {
    interface Window {
        __RECSYS_DOMAIN_KEY__?: string;
    }
}
//# sourceMappingURL=index.d.ts.map