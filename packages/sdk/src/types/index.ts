export interface TrackerConfig {
  domainKey: string;
  domainUrl?: string;
  domainType?: number;
  trackingRules?: TrackingRule[];
  returnMethods?: ReturnMethod[];
  eventTypes?: EventType[];
  searchKeywordConfig?: SearchKeywordConfig;
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
  // For request_url source
  RequestUrlPattern?: string;
  RequestMethod?: string;
  Value?: string; // For pathname: segment index, for query: param name, for request_body: JSON path
  ExtractType?: 'pathname' | 'query'; // Only for request_url
  
  // For request_body/response_body source
  // (RequestUrlPattern and RequestMethod already covered above)
  // Value used as JSON path for body extraction
  
  // For element source
  SelectorPattern?: string;
}

// User Identity configuration
export interface UserIdentityConfig {
  id?: number;
  source: 'request_body' | 'request_url' | 'local_storage' | 'session_storage' | 'cookie' | 'element';
  domainId: number;
  requestConfig?: UserIdentityRequestConfig | null;
  value?: string | null; // For element/cookie/local_storage/session_storage
  field: 'UserId' | 'AnonymousId';
}

export interface UserIdentityRequestConfig {
  RequestUrlPattern: string;
  RequestMethod: string;
  Value: string; // JSON path for request_body, segment index for request_url pathname
  ExtractType?: 'pathname' | 'query'; // Only for request_url
}

export interface ReturnMethod {
  id: number;
  domainId: number;
  returnType: string;
  value: string;
  configurationName: string;
}

export interface SearchKeywordConfig {
  Id: number;
  DomainID: number;
  ConfigurationName: string;
  InputSelector: string;
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
