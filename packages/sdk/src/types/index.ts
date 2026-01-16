export interface TrackerConfig {
  domainKey: string;
  domainUrl?: string;
  domainType?: number;
  trackingRules?: TrackingRule[];
  returnMethods?: ReturnMethod[];
  eventTypes?: EventType[];
  userIdentities?: UserIdentity[];
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
  trackingTarget: string | null;
  itemIdentities: ItemIdentity[];
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
  batchDelay?: number; // ms
  offlineStorage?: boolean;
}

export type ItemIdentitySource = 'request_body' | 'request_url';

export interface ItemIdentity {
  id: number;
  source: ItemIdentitySource;
  trackingRuleId: number;
  requestConfig: any | null;
}

export type UserIdentitySource = 'request_body' | 'local_storage' | 'session_storage' | 'cookie' | 'element';

export interface UserIdentity {
  id: number;
  source: UserIdentitySource;
  domainId: number;
  requestConfig: any | null;
  value: string | null;
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
