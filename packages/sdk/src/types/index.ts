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
  triggerEventId: number; // (click, rate, page view, ...)
  // targetElementId?: number;
  targetElement: {
    targetEventPatternId?: number,
    targetOperatorId?: number,
    targetElementValue?: string
  };
  conditions: Condition[];
  payloadMappings: PayloadConfig[];
}

export interface PayloadConfig {
  payloadPatternId: number;
  field: number;
  source?: string;
  value?: string;
}

export interface Condition {
  // id?: number;
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

// Plugin-related types (đồng bộ với plugin interfaces)
export type RuleSource = 'ai_detect' | 'regex_group';

export interface PayloadExtractor {
  source: RuleSource;
  eventKey: string;
  pattern?: string;
  groupIndex?: number;
}

// Window declaration for domain key
declare global {
  interface Window {
    __RECSYS_DOMAIN_KEY__?: string;
  }
}
