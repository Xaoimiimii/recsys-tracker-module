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
    trackingTargetId: number;
    payloadMappings: PayloadMapping[];
    conditions: Condition[];
    trackingTarget: TrackingTarget;
}
export interface PayloadMapping {
    id: number;
    field: string;
    source: string;
    value: string;
    requestUrlPattern?: string | null;
    requestMethod?: string | null;
    requestBodyPath?: string | null;
    urlPart?: string | null;
    urlPartValue?: string | null;
    trackingRuleId: number;
}
export interface PayloadConfig {
    field: string;
    source: string;
    value?: string;
    requestUrlPattern?: string;
    requestMethod?: string;
    requestBodyPath?: string;
    urlPart?: string;
    urlPartValue?: string;
}
export interface Condition {
    id: number;
    value: string;
    trackingRuleId: number;
    patternId: number;
    operatorId: number;
}
export interface TrackingTarget {
    id: number;
    value: string;
    patternId: number;
    operatorId: number;
}
export interface ReturnMethod {
    id: number;
    domainId: number;
    operatorId: number;
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
export type RuleSource = 'ai_detect' | 'regex_group';
export interface PayloadExtractor {
    source: RuleSource;
    eventKey: string;
    pattern?: string;
    groupIndex?: number;
}
declare global {
    interface Window {
        __RECSYS_DOMAIN_KEY__?: string;
    }
}
//# sourceMappingURL=index.d.ts.map