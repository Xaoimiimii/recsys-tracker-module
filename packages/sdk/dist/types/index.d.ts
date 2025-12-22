export interface TrackerConfig {
    domainKey: string;
    domainUrl?: string;
    domainType?: number;
    trackEndpoint?: string;
    configEndpoint?: string;
    trackingRules?: TrackingRule[];
    returnMethods?: ReturnMethod[];
    options?: TrackerOptions;
}
export interface TrackingRule {
    id: string;
    name: string;
    eventTypeId: number;
    targetElement: {
        targetElementOperatorId?: number;
        targetElementValue?: string;
    };
    conditions: Condition[];
    payload: PayloadConfig[];
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
    patternId: number;
    operatorId: number;
    value?: string;
}
export interface ReturnMethod {
    configurationName: string;
    returnMethodId: number;
    operatorId: number;
    value: string;
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