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
  // domainId: number;
  triggerEventId: number; // (click, scroll, ...)
  targetElementId?: number;
  targetEventPatternId?: number;
  targetOperatorId?: number;
  targetElementValue?: string;
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
  id?: number;
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
  batchDelay?: number; // ms
  offlineStorage?: boolean;
}

// Window declaration for domain key
declare global {
  interface Window {
    __RECSYS_DOMAIN_KEY__?: string;
  }
}
