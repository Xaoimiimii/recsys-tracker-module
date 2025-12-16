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
    triggerEventId: number;
    targetElement: {
        targetEventPatternId?: number;
        targetOperatorId?: number;
        targetElementValue?: string;
    };
    conditions: Condition[];
    payload: PayloadConfig[];
}
export interface PayloadConfig {
    payloadPatternId: number;
    operatorId: number;
    value?: string;
    type?: string;
}
export interface Condition {
    eventPatternId: number;
    operatorId: number;
    value?: string;
}
export interface ReturnMethod {
    slotName: string;
    returnMethodId: number;
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