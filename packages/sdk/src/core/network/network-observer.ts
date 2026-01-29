/**
 * NetworkObserver - Passive Network Listener
 * 
 * NGUYÊN TẮC:
 * 1. Init KHI SDK LOAD (không phải trong plugin)
 * 2. Luôn active và lắng nghe TẤT CẢ requests
 * 3. Chỉ xử lý request khi có REC phù hợp
 * 4. KHÔNG dispatch event (chỉ collect data vào REC)
 * 5. Passive - không can thiệp vào logic nghiệp vụ
 * 6. Tích hợp với UserIdentityManager để handle user identity
 */

import { RuleExecutionContextManager, RuleExecutionContext } from '../execution/rule-execution-context';
import { PathMatcher } from '../utils/path-matcher';
import { TrackingRule } from '../../types';
import { UserIdentityManager } from '../user';
import {
  parseBody,
  extractByPath,
  extractFromUrl
} from '../utils/data-extractors';

interface NetworkRequestInfo {
  url: string;
  method: string;
  timestamp: number;
  requestBody?: any;
  responseBody?: any; // Có thể là Response clone (từ fetch) hoặc string (từ XHR)
}

/**
 * NetworkObserver - Singleton passive listener
 */
export class NetworkObserver {
  private static instance: NetworkObserver | null = null;
  
  private originalFetch: typeof fetch;
  private originalXhrOpen: any;
  private originalXhrSend: any;
  private isActive = false;
  
  // Reference to REC manager
  private recManager: RuleExecutionContextManager | null = null;
  
  // Reference to UserIdentityManager
  private userIdentityManager: UserIdentityManager | null = null;
  
  // Buffer for requests that arrived before UserIdentityManager was set
  private pendingUserIdentityRequests: NetworkRequestInfo[] = [];
  private readonly MAX_PENDING_REQUESTS = 10;
  
  // Registered rules that need network data
  private registeredRules: Map<number, TrackingRule> = new Map();

  private constructor() {
    this.originalFetch = window.fetch;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NetworkObserver {
    if (!NetworkObserver.instance) {
      NetworkObserver.instance = new NetworkObserver();
    }
    return NetworkObserver.instance;
  }

  /**
   * Set UserIdentityManager reference
   */
  setUserIdentityManager(userIdentityManager: UserIdentityManager): void {
    console.log('[NetworkObserver] Setting UserIdentityManager');
    this.userIdentityManager = userIdentityManager;
    
    // Process any pending requests that were buffered
    if (this.pendingUserIdentityRequests.length > 0) {
      console.log('[NetworkObserver] Processing', this.pendingUserIdentityRequests.length, 'pending requests');
      for (const requestInfo of this.pendingUserIdentityRequests) {
        this.processUserIdentityRequest(requestInfo);
      }
      
      this.pendingUserIdentityRequests = [];
    }
  }

  /**
   * Process user identity request
   * Extracted as separate method to handle both real-time and buffered requests
   */
  private async processUserIdentityRequest(requestInfo: NetworkRequestInfo): Promise<void> {
    if (!this.userIdentityManager) {
      console.log('[NetworkObserver] No UserIdentityManager set');
      return;
    }

    console.log('[NetworkObserver] Checking if request matches user identity:', requestInfo.url);
    const matchesUserIdentity = this.userIdentityManager.matchesUserIdentityRequest(
      requestInfo.url,
      requestInfo.method
    );
    console.log('[NetworkObserver] Match result:', matchesUserIdentity);
    
    if (matchesUserIdentity) {
      console.log('[NetworkObserver] ✅ Request matches user identity config, extracting...');
      // Parse response body nếu cần
      let responseBodyText: string | null = null;
      if (requestInfo.responseBody) {
        if (typeof requestInfo.responseBody === 'string') {
          responseBodyText = requestInfo.responseBody;
        } else {
          responseBodyText = await (requestInfo.responseBody as Response).text();
          requestInfo.responseBody = responseBodyText;
        }
      }
      
      console.log('[NetworkObserver] Calling UserIdentityManager.extractFromNetworkRequest');
      // Extract user info
      this.userIdentityManager.extractFromNetworkRequest(
        requestInfo.url,
        requestInfo.method,
        requestInfo.requestBody,
        responseBodyText
      );
    }
  }

  /**
   * Initialize observer với REC manager
   * PHẢI GỌI KHI SDK INIT
   */
  initialize(recManager: RuleExecutionContextManager): void {
    if (this.isActive) {
      console.log('[NetworkObserver] Already active, skipping initialization');
      return;
    }

    console.log('[NetworkObserver] Initializing...');
    this.recManager = recManager;
    this.hookFetch();
    this.hookXHR();
    this.isActive = true;
    console.log('[NetworkObserver] ✅ Initialized and hooked fetch/XHR');
  }

  /**
   * Register một rule cần network data
   * Được gọi bởi PayloadBuilder khi phát hiện rule cần async data
   */
  registerRule(rule: TrackingRule): void {
    if (!this.registeredRules.has(rule.id)) {
      this.registeredRules.set(rule.id, rule);
    }
  }

  /**
   * Unregister rule (cleanup)
   */
  unregisterRule(ruleId: number): void {
    this.registeredRules.delete(ruleId);
  }

  /**
   * Hook Fetch API
   */
  private hookFetch(): void {
    const observer = this;

    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method?.toUpperCase() || 'GET';
      const requestBody = init?.body;
      const timestamp = Date.now();
      console.log('[NetworkObserver] Intercepted fetch:', method, url);

      // Call original fetch
      const response = await observer.originalFetch.call(window, input, init);
      
      // Clone để đọc response mà không ảnh hưởng stream
      const clone = response.clone();
      
      // SECURITY: Chỉ process nếu request này có thể match với rules
      // Truyền clone thay vì parse ngay
      observer.handleRequest({
        url,
        method,
        timestamp,
        requestBody,
        responseBody: clone // Truyền clone, sẽ parse sau nếu cần
      });

      return response;
    };
  }

  /**
   * Hook XMLHttpRequest
   */
  private hookXHR(): void {
    const observer = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
      (this as any)._networkObserverInfo = {
        method: method.toUpperCase(),
        url,
        timestamp: Date.now()
      };
      return observer.originalXhrOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function(body?: any) {
      const info = (this as any)._networkObserverInfo;
      
      if (info) {
        info.requestBody = body;
        
        this.addEventListener('load', function() {
          observer.handleRequest({
            url: info.url,
            method: info.method,
            timestamp: Date.now(), // Response timestamp
            requestBody: info.requestBody,
            responseBody: this.responseText
          });
        });
      }
      
      return observer.originalXhrSend.call(this, body);
    };
  }

  /**
   * Xử lý request đã intercept
   * Chỉ process và log khi request match với rule patterns
   * Delegate user info extraction to UserIdentityManager
   */
  private async handleRequest(requestInfo: NetworkRequestInfo): Promise<void> {
    if (!this.recManager) {
      return;
    }

    // STEP 1: USER IDENTITY HANDLING
    // Delegate to UserIdentityManager nếu có
    if (this.userIdentityManager) {
      this.processUserIdentityRequest(requestInfo);
    } else {
      // Buffer request if UserIdentityManager not ready yet
      // Only buffer GET/POST requests to avoid memory issues
      if ((requestInfo.method === 'GET' || requestInfo.method === 'POST') && 
          this.pendingUserIdentityRequests.length < this.MAX_PENDING_REQUESTS) {
        this.pendingUserIdentityRequests.push(requestInfo);
      }
    }

    // STEP 2: SECURITY CHECK - Có registered rules không?
    if (this.registeredRules.size === 0) {
      // Không có rules để track events
      return;
    }
    
    // STEP 3: SECURITY CHECK - Request này có khả năng match với rule nào không?
    const potentialMatches = this.findPotentialMatchingRules(requestInfo);
    
    if (potentialMatches.length === 0) {
      return; // Không match với rule nào để track events
    }

    // Parse response body nếu cần (chỉ khi có match)
    if (requestInfo.responseBody && typeof requestInfo.responseBody !== 'string') {
      // responseBody là Response clone từ fetch
      try {
        const text = await (requestInfo.responseBody as Response).text();
        requestInfo.responseBody = text;
      } catch (error) {
        return;
      }
    }
    
    // Process từng rule match
    for (const rule of potentialMatches) {
      // Tìm REC phù hợp cho rule này
      const context = this.recManager.findMatchingContext(
        rule.id,
        requestInfo.timestamp
      );

      if (!context) {
        continue;
      }

      // Process mappings cho rule này
      this.processRuleMappings(rule, context, requestInfo);
    }
  }

  /**
   * Process payload mappings của rule và extract data vào REC
   */
  private processRuleMappings(
    rule: TrackingRule,
    context: RuleExecutionContext,
    requestInfo: NetworkRequestInfo
  ): void {
    if (!rule.payloadMappings) {
      return;
    }

    for (const mapping of rule.payloadMappings) {
      const source = (mapping.source || '').toLowerCase();

      // Chỉ xử lý network sources
      if (!this.isNetworkSource(source)) {
        continue;
      }

      // Check pattern match
      if (!this.matchesPattern(mapping, requestInfo)) {
        continue;
      }

      // Extract value
      const value = this.extractValue(mapping, requestInfo);
      
      if (value !== null && value !== undefined) {
        // Collect vào REC
        this.recManager!.collectField(
          context.executionId,
          mapping.field,
          value
        );
      }
    }
  }

  /**
   * SECURITY: Tìm rules có thể match với request này
   * Check URL pattern và method TRƯỚC KHI parse body
   */
  private findPotentialMatchingRules(requestInfo: NetworkRequestInfo): TrackingRule[] {
    const matches: TrackingRule[] = [];
    
    for (const rule of this.registeredRules.values()) {
      if (!rule.payloadMappings) continue;
      
      // Check xem có mapping nào match với request này không
      for (const mapping of rule.payloadMappings) {
        // Chỉ check network sources
        const source = (mapping.source || '').toLowerCase();
        if (!this.isNetworkSource(source)) continue;
        
        // Check pattern match
        if (this.matchesPattern(mapping, requestInfo)) {
          matches.push(rule);
          break; // Rule này match rồi, không cần check mapping khác
        }
      }
    }
    
    return matches;
  }

  /**
   * Check nếu source là network source
   */
  private isNetworkSource(source: string): boolean {
    return [
      'requestbody',
      'request_body',
      'responsebody', 
      'response_body',
      'requesturl',
      'request_url'
    ].includes(source);
  }

  /**
   * Check nếu request match với pattern trong mapping
   */
  private matchesPattern(mapping: any, requestInfo: NetworkRequestInfo): boolean {
    const requestMethod = mapping.config?.RequestMethod;
    const requestUrlPattern = mapping.config?.RequestUrlPattern;

    // Check method
    if (requestMethod) {
      const expectedMethod = requestMethod.toUpperCase();
      if (requestInfo.method !== expectedMethod) {
        return false;
      }
    }

    // Check URL pattern
    if (requestUrlPattern) {
      if (!PathMatcher.match(requestInfo.url, requestUrlPattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract value từ request theo mapping config
   * 
   * SMART LOGIC:
   * - Source = "RequestBody" + Method = GET → Auto extract từ ResponseBody
   * - Source = "RequestBody" + Method = POST/PUT/PATCH/DELETE → Extract từ RequestBody
   * - Source = "ResponseBody" → Luôn extract từ ResponseBody
   */
  private extractValue(mapping: any, requestInfo: NetworkRequestInfo): any {
    const source = (mapping.source || '').toLowerCase();
    const method = requestInfo.method.toUpperCase();

    switch (source) {
      case 'requestbody':
      case 'request_body':
        // SMART: Nếu là GET request, tự động chuyển sang response body
        if (method === 'GET') {
          return this.extractFromResponseBody(mapping, requestInfo);
        }
        // POST/PUT/PATCH/DELETE → Dùng request body như bình thường
        return this.extractFromRequestBody(mapping, requestInfo);
      
      case 'responsebody':
      case 'response_body':
        return this.extractFromResponseBody(mapping, requestInfo);
      
      case 'requesturl':
      case 'request_url':
        return this.extractFromRequestUrl(mapping, requestInfo);
      
      default:
        return null;
    }
  }

  /**
   * Extract từ request body
   */
  private extractFromRequestBody(mapping: any, requestInfo: NetworkRequestInfo): any {
    const body = parseBody(requestInfo.requestBody);
    
    if (!body) {
      return null;
    }

    const path = mapping.config?.Value;
    const result = extractByPath(body, path);
    
    return result;
  }

  /**
   * Extract từ response body
   */
  private extractFromResponseBody(mapping: any, requestInfo: NetworkRequestInfo): any {
    const body = parseBody(requestInfo.responseBody);
    
    if (!body) {
      return null;
    }

    const path = mapping.config?.Value;
    
    const result = extractByPath(body, path);
    
    return result;
  }

  /**
   * Extract từ request URL
   */
  private extractFromRequestUrl(mapping: any, requestInfo: NetworkRequestInfo): any {
    const { ExtractType, Value, RequestUrlPattern } = mapping.config;
    return extractFromUrl(requestInfo.url, Value, ExtractType, RequestUrlPattern);
  }

  /**
   * Restore original functions (for cleanup/testing)
   */
  restore(): void {
    if (!this.isActive) return;

    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXhrOpen;
    XMLHttpRequest.prototype.send = this.originalXhrSend;
    
    this.isActive = false;
    this.registeredRules.clear();
  }

  /**
   * Check if observer is active
   */
  isObserverActive(): boolean {
    return this.isActive;
  }

  /**
   * Get registered rules count (for debugging)
   */
  getRegisteredRulesCount(): number {
    return this.registeredRules.size;
  }
}

/**
 * Helper function to get singleton instance
 */
export function getNetworkObserver(): NetworkObserver {
  return NetworkObserver.getInstance();
}
