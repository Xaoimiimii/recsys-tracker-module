export interface TrackerConfig {
    domainKey: string;
    trackEndpoint?: string;
    configEndpoint?: string;
    trackingRules?: TrackingRule[];
    returnMethods?: ReturnMethod[];
    options?: TrackerOptions;
}
export interface TrackingRule {
    id: string;
    name: string;
    domainId: number;
    triggerEventId: number;
    targetEventPatternId: number;
    targetOperatorId: number;
    targetElementValue: string;
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
    payloadPatternId: number;
    operatorId: number;
    value?: string;
}
export interface ReturnMethod {
    key: string;
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
declare global {
    interface Window {
        __RECSYS_DOMAIN_KEY__?: string;
    }
}
//# sourceMappingURL=index.d.ts.map