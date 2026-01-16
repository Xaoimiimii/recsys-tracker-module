/**
 * NetworkObserver - Passive Network Listener
 * 
 * NGUYÊN TẮC:
 * 1. Init KHI SDK LOAD (không phải trong plugin)
 * 2. Luôn active và lắng nghe TẤT CẢ requests
 * 3. Chỉ xử lý request khi có REC phù hợp
 * 4. KHÔNG dispatch event (chỉ collect data vào REC)
 * 5. Passive - không can thiệp vào logic nghiệp vụ
 */

import { RuleExecutionContextManager, RuleExecutionContext } from '../execution/rule-execution-context';
import { PathMatcher } from '../utils/path-matcher';
import { TrackingRule, UserIdentity } from '../../types';
import { saveCachedUserInfo } from '../plugins/utils/plugin-utils';

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
  
  // Registered rules that need network data
  private registeredRules: Map<number, TrackingRule> = new Map();
  
  // User identities từ config để smart caching
  private userInfoMappings: UserIdentity[] = [];

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
   * Register user identities từ config
   * Được gọi bởi ConfigLoader sau khi parse rules
   */
  registerUserInfoMappings(config: { trackingRules?: TrackingRule[], userIdentities?: any[] }): void {
    console.log('[NetworkObserver] Registering UserIdentities for network observation...');
    
    const userIdentities = config.userIdentities || [];
    
    // Filter chỉ lấy network sources (request_body)
    this.userInfoMappings = userIdentities.filter((identity: any) => {
      const source = (identity.source || '').toLowerCase();
      if (source !== 'request_body') {
        return false;
      }
      
      const requestConfig = identity.requestConfig;
      if (!requestConfig || !requestConfig.requestUrlPattern || !requestConfig.requestMethod) {
        return false;
      }
      
      return true;
    });
    
    for (const identity of this.userInfoMappings) {
      const requestConfig = identity.requestConfig || {};
      console.log('[NetworkObserver] ✅ User identity:', {
        id: identity.id,
        source: identity.source,
        pattern: requestConfig.requestUrlPattern,
        method: requestConfig.requestMethod,
        path: requestConfig.requestBodyPath
      });
    }
  }

  /**
   * Initialize observer với REC manager
   * PHẢI GỌI KHI SDK INIT
   */
  initialize(recManager: RuleExecutionContextManager): void {
    if (this.isActive) {
      return;
    }

    this.recManager = recManager;
    this.hookFetch();
    this.hookXHR();
    this.isActive = true;
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
   * SECURITY: Chỉ process và log khi request match với rule patterns
   * SMART: Cache user info dựa trên registered user info mappings từ config
   */
  private async handleRequest(requestInfo: NetworkRequestInfo): Promise<void> {
    if (!this.recManager) {
      return;
    }

    // STEP 1: SMART USER INFO CACHING
    // Chỉ cache nếu có user info mappings đã đăng ký từ config
    const userInfoCached = await this.smartUserInfoCaching(requestInfo);
    
    if (userInfoCached) {
      // Đã cache user info, log ngắn gọn
      console.log('[NetworkObserver] 💾 User info cached from:', requestInfo.url);
    }

    // STEP 2: SECURITY CHECK - Có registered rules không?
    if (this.registeredRules.size === 0) {
      // Không có rules để track events, nhưng vẫn có thể đã cache user info ở trên
      return;
    }
    
    // STEP 3: SECURITY CHECK - Request này có khả năng match với rule nào không?
    const potentialMatches = this.findPotentialMatchingRules(requestInfo);
    
    if (potentialMatches.length === 0) {
      return; // Không match với rule nào để track events
    }

    // CHỈ LOG KHI CÓ POTENTIAL MATCH
    console.log('[NetworkObserver] 🎯 Potential match found - URL:', requestInfo.url, 'Method:', requestInfo.method);
    console.log('[NetworkObserver] Matching rules:', potentialMatches.map(r => `${r.id}:${r.name}`));
    
    // Parse response body nếu cần (chỉ khi có match)
    if (requestInfo.responseBody && typeof requestInfo.responseBody !== 'string') {
      // responseBody là Response clone từ fetch
      try {
        const text = await (requestInfo.responseBody as Response).text();
        requestInfo.responseBody = text;
        console.log('[NetworkObserver] Response body parsed (preview):', text.substring(0, 200));
      } catch (error) {
        console.error('[NetworkObserver] Failed to parse response body:', error);
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
        console.log('[NetworkObserver] No active context for rule:', rule.id, '(but user info may have been cached)');
        continue;
      }

      console.log('[NetworkObserver] ✅ Processing rule with active context:', context.executionId);
      
      // Process mappings cho rule này
      this.processRuleMappings(rule, context, requestInfo);
    }
  }

  /**
   * Process item identities của rule và extract data vào REC
   */
  private processRuleMappings(
    rule: TrackingRule,
    context: RuleExecutionContext,
    requestInfo: NetworkRequestInfo
  ): void {
    console.log('[NetworkObserver] processRuleMappings for rule:', rule.id);
    
    if (!rule.itemIdentities || rule.itemIdentities.length === 0) {
      console.log('[NetworkObserver] No item identities');
      return;
    }

    console.log('[NetworkObserver] Processing', rule.itemIdentities.length, 'item identities');
    
    for (const identity of rule.itemIdentities) {
      const source = (identity.source || '').toLowerCase();
      console.log('[NetworkObserver] Checking identity - Source:', source);
      
      // Chỉ xử lý network sources (request_body, request_url)
      if (source !== 'request_body' && source !== 'request_url') {
        console.log('[NetworkObserver] Not a network source, skipping');
        continue;
      }

      console.log('[NetworkObserver] Is network source, checking pattern match');
      const requestConfig = identity.requestConfig || {};
      console.log('[NetworkObserver] Identity pattern:', requestConfig.requestUrlPattern, 'Method:', requestConfig.requestMethod);
      console.log('[NetworkObserver] Request URL:', requestInfo.url, 'Method:', requestInfo.method);
      
      // Check pattern match
      if (!this.matchesItemIdentityPattern(identity, requestInfo)) {
        console.log('[NetworkObserver] Pattern does not match, skipping');
        continue;
      }

      console.log('[NetworkObserver] ✅ Pattern matched! Extracting ItemId...');
      
      // Extract ItemId value from request body or URL
      const value = this.extractItemIdValue(identity, requestInfo);
      console.log('[NetworkObserver] Extracted ItemId:', value);
      
      if (value !== null && value !== undefined) {
        console.log('[NetworkObserver] 📦 Collecting ItemId into REC:', value);
        
        // Collect vào REC - always as ItemId
        this.recManager!.collectField(
          context.executionId,
          'ItemId',
          value
        );
      } else {
        console.log('[NetworkObserver] ⚠️ Extracted ItemId is null/undefined');
      }
    }
  }

  /**
   * SMART USER INFO CACHING
   * 
   * Cache user info từ network responses dựa trên UserIdentity từ config
   * Chỉ cache khi có userIdentities đã đăng ký (không log spam)
   * 
   * @returns true nếu đã cache user info
   */
  private async smartUserInfoCaching(requestInfo: NetworkRequestInfo): Promise<boolean> {
    if (this.userInfoMappings.length === 0) {
      return false; // Không có user identities đăng ký
    }

    // Tìm UserIdentity phù hợp với request này
    for (const identity of this.userInfoMappings) {
      // Chỉ xử lý source = request_body (network source)
      if (identity.source !== 'request_body') {
        continue;
      }
      
      const requestConfig = identity.requestConfig || {};
      
      // Check method
      const method = (requestConfig.requestMethod || '').toUpperCase();
      if (method !== requestInfo.method) {
        continue;
      }
      
      // Check URL pattern
      const urlPattern = requestConfig.requestUrlPattern || '';
      if (!PathMatcher.match(requestInfo.url, urlPattern)) {
        continue;
      }
      
      console.log('[NetworkObserver] 🎯 Matched user identity:', {
        id: identity.id,
        pattern: urlPattern,
        url: requestInfo.url
      });
      
      // Parse response body nếu cần
      let responseBodyText: string | null = null;
      
      if (requestInfo.responseBody) {
        if (typeof requestInfo.responseBody === 'string') {
          responseBodyText = requestInfo.responseBody;
        } else {
          try {
            responseBodyText = await (requestInfo.responseBody as Response).text();
            requestInfo.responseBody = responseBodyText;
          } catch (error) {
            console.error('[NetworkObserver] Failed to parse response:', error);
            continue;
          }
        }
      }
      
      if (!responseBodyText) {
        console.log('[NetworkObserver] No response body to extract from');
        continue;
      }
      
      // Parse JSON
      let responseData: any;
      try {
        responseData = JSON.parse(responseBodyText);
      } catch {
        console.log('[NetworkObserver] Response is not JSON');
        continue;
      }
      
      // Extract value theo path trong requestConfig
      const path = requestConfig.requestBodyPath;
      if (!path) {
        console.log('[NetworkObserver] No requestBodyPath in requestConfig');
        continue;
      }
      
      const value = this.extractByPath(responseData, path);
      
      if (value) {
        console.log('[NetworkObserver] ✅ Extracted user value:', value, 'from path:', path);
        console.log('[NetworkObserver] 💾 Caching to localStorage as UserId');
        
        // Always cache as 'UserId' field
        saveCachedUserInfo('UserId', String(value));
        return true;
      } else {
        console.log('[NetworkObserver] ⚠️ Could not extract value from path:', path);
      }
    }
    
    return false;
  }

  /**
   * SECURITY: Tìm rules có thể match với request này
   * Check URL pattern và method TRƯỚC KHI parse body
   */
  private findPotentialMatchingRules(requestInfo: NetworkRequestInfo): TrackingRule[] {
    const matches: TrackingRule[] = [];
    
    for (const rule of this.registeredRules.values()) {
      if (!rule.itemIdentities || rule.itemIdentities.length === 0) continue;
      
      // Check xem có identity nào match với request này không
      for (const identity of rule.itemIdentities) {
        // Chỉ check network sources
        const source = (identity.source || '').toLowerCase();
        if (source !== 'request_body' && source !== 'request_url') continue;
        
        // Check pattern match
        if (this.matchesItemIdentityPattern(identity, requestInfo)) {
          matches.push(rule);
          break; // Rule này match rồi, không cần check identity khác
        }
      }
    }
    
    return matches;
  }

  /**
   * Check nếu request match với pattern trong item identity
   */
  private matchesItemIdentityPattern(identity: any, requestInfo: NetworkRequestInfo): boolean {
    const requestConfig = identity.requestConfig || {};
    
    // Check method
    if (requestConfig.requestMethod) {
      const expectedMethod = requestConfig.requestMethod.toUpperCase();
      const actualMethod = requestInfo.method.toUpperCase();
      if (expectedMethod !== actualMethod) {
        return false;
      }
    }

    // Check URL pattern
    if (requestConfig.requestUrlPattern) {
      const pattern = requestConfig.requestUrlPattern;
      return PathMatcher.match(requestInfo.url, pattern);
    }

    return false;
  }

  /**
   * Extract ItemId value from item identity
   */
  private extractItemIdValue(identity: any, requestInfo: NetworkRequestInfo): any {
    const source = (identity.source || '').toLowerCase();
    const requestConfig = identity.requestConfig || {};

    switch (source) {
      case 'requestbody':
      case 'request_body':
        // SMART: Nếu là GET request, tự động chuyển sang response body
        if (requestConfig.requestMethod === 'GET') {
          console.log('[NetworkObserver] Smart routing: RequestBody + GET → Using ResponseBody');
          return this.extractFromResponseBody(identity, requestInfo);
        }
        // POST/PUT/PATCH/DELETE → Dùng request body như bình thường
        console.log('[NetworkObserver] Using RequestBody for method:', requestConfig.requestMethod);
        return this.extractFromRequestBody(identity, requestInfo);
      
      case 'responsebody':
      case 'response_body':
        return this.extractFromResponseBody(identity, requestInfo);
      
      case 'requesturl':
      case 'request_url':
        return this.extractFromRequestUrl(identity, requestInfo);
      
      default:
        return null;
    }
  }

  /**
   * Extract từ request body using requestConfig
   */
  private extractFromRequestBody(requestConfig: any, requestInfo: NetworkRequestInfo): any {
    const body = this.parseBody(requestInfo.requestBody);
    if (!body) return null;

    const path = requestConfig.requestBodyPath || '';
    return this.extractByPath(body, path);
  }

  /**
   * Extract từ response body
   */
  private extractFromResponseBody(requestConfig: any, requestInfo: NetworkRequestInfo): any {
    const body = this.parseBody(requestInfo.responseBody);
    if (!body) return null;

    const path = requestConfig.requestBodyPath || '';
    return this.extractByPath(body, path);
  }

  /**
   * Extract từ request URL
   */
  private extractFromRequestUrl(requestConfig: any, requestInfo: NetworkRequestInfo): any {
    const url = new URL(requestInfo.url, window.location.origin);
    
    // Parse from urlPart config (query, path, etc.)
    const urlPart = requestConfig.urlPart?.toLowerCase();
    
    switch (urlPart) {
      case 'query':
      case 'queryparam':
        const paramName = requestConfig.urlPartValue || requestConfig.value;
        return url.searchParams.get(paramName);
      
      case 'path':
      case 'pathsegment':
        // Extract path segment by index or pattern
        const pathValue = requestConfig.urlPartValue || requestConfig.value;
        
        if (pathValue && !isNaN(Number(pathValue))) {
          const segments = url.pathname.split('/').filter(s => s);
          // Convert from user view (1-based) to dev view (0-based)
          const index = Number(pathValue) - 1;
          const result = segments[index] || null;
          return result;
        }
        return url.pathname;
      
      case 'hash':
        return url.hash.substring(1); // Remove #
      
      default:
        // Check if value is a number (path segment index)
        const segments = url.pathname.split('/').filter(s => s);
        
        if (requestConfig.value && !isNaN(Number(requestConfig.value))) {
          // Convert from user view (1-based) to dev view (0-based)
          const index = Number(requestConfig.value) - 1;
          const result = segments[index] || null;
          return result;
        }
        return url.href;
    }
  }

  /**
   * Parse body (JSON or text)
   */
  private parseBody(body: any): any {
    if (!body) return null;
    
    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    }
    
    return body;
  }

  /**
   * Extract value by path (e.g., "data.user.id")
   */
  private extractByPath(obj: any, path: string): any {
    if (!path || !obj) return null;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }
      current = current[part];
    }

    return current;
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
