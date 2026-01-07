/**
 * PayloadBuilder - The Orchestrator
 * 
 * TRÁCH NHIỆM:
 * 1. Điều phối toàn bộ quá trình build payload
 * 2. Biết rule cần field nào
 * 3. Biết field đó lấy từ đâu (sync hay async)
 * 4. Là NƠI DUY NHẤT chốt payload
 * 5. Quản lý RuleExecutionContext
 * 
 * FLOW:
 * 1. Plugin trigger → gọi handleTrigger()
 * 2. Phân loại sync/async sources
 * 3. Resolve sync sources ngay
 * 4. Đăng ký async sources với NetworkObserver
 * 5. Khi đủ dữ liệu → dispatch event
 */

import { TrackingRule, PayloadMapping } from '../../types';
import { RuleExecutionContextManager } from '../execution/rule-execution-context';
import { NetworkObserver, getNetworkObserver } from '../network/network-observer';
import { getCachedUserInfo, getOrCreateAnonymousId } from '../plugins/utils/plugin-utils';

/**
 * Các source types
 */
enum SourceType {
  SYNC,   // Cookie, localStorage, element, page url - resolve ngay
  ASYNC   // Network data - cần chờ request
}

/**
 * PayloadBuilder v2 - Full Orchestrator
 */
export class PayloadBuilder {
  private recManager: RuleExecutionContextManager;
  private networkObserver: NetworkObserver;

  constructor() {
    this.recManager = new RuleExecutionContextManager();
    this.networkObserver = getNetworkObserver();
  }

  /**
   * Main entry point - được gọi bởi tracking plugins
   * 
   * @param rule - Tracking rule được trigger
   * @param triggerContext - Context của trigger (element, eventType, etc.)
   * @param onComplete - Callback khi payload sẵn sàng để dispatch
   */
  handleTrigger(
    rule: TrackingRule,
    triggerContext: any,
    onComplete: (payload: Record<string, any>) => void
  ): void {
    // 1. Phân tích mappings
    const { syncMappings, asyncMappings } = this.classifyMappings(rule);

    // 2. Nếu không có async → resolve ngay
    if (asyncMappings.length === 0) {
      const payload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
      onComplete(payload);
      return;
    }

    // 3. Có async data → tạo REC
    const requiredFields = asyncMappings.map(m => m.field);
    
    const context = this.recManager.createContext(
      rule.id,
      requiredFields,
      triggerContext,
      (collectedData) => {
        // Khi async data đã thu thập xong
        const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
        const finalPayload = { ...syncPayload, ...collectedData };
        onComplete(finalPayload);
      }
    );

    // 4. Resolve sync data ngay và collect vào REC
    const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
    for (const [field, value] of Object.entries(syncPayload)) {
      this.recManager.collectField(context.executionId, field, value);
    }

    // 4.5 Thu thập User Info (UserValue/AnonymousId) từ async mappings
    this.collectUserInfoFromAsyncMappings(context.executionId, asyncMappings);

    // 5. Register rule với NetworkObserver để bắt async data
    this.networkObserver.registerRule(rule);
  }

  /**
   * Thu thập User Info từ async mappings
   * Nếu có UserId/Username trong async mappings, tự động lấy từ:
   * 1. Cached user info (đã lưu từ lần trước)
   * 2. AnonymousId (fallback)
   */
  private collectUserInfoFromAsyncMappings(
    executionId: string,
    asyncMappings: PayloadMapping[]
  ): void {
    // Tìm xem có mapping nào cho UserValue/AnonymousId không
    const userMapping = asyncMappings.find(m => 
      m.field === 'UserId' ||  
      m.field === 'AnonymousId'
    );

    if (!userMapping) {
      return; // Không cần user info
    }

    // Lấy cached user info
    const cachedInfo = getCachedUserInfo();
    
    if (cachedInfo && cachedInfo.userValue) {
      // Có cached user info → dùng nó
      this.recManager.collectField(executionId, cachedInfo.userField, cachedInfo.userValue);
      return;
    }

    // Không có cached user info → dùng AnonymousId
    const anonId = getOrCreateAnonymousId();
    this.recManager.collectField(executionId, 'AnonymousId', anonId);
  }

  /**
   * Phân loại mappings thành sync và async
   */
  private classifyMappings(rule: TrackingRule): {
    syncMappings: PayloadMapping[];
    asyncMappings: PayloadMapping[];
  } {
    const syncMappings: PayloadMapping[] = [];
    const asyncMappings: PayloadMapping[] = [];

    if (!rule.payloadMappings) {
      return { syncMappings, asyncMappings };
    }

    for (const mapping of rule.payloadMappings) {
      const sourceType = this.getSourceType(mapping.source);
      
      if (sourceType === SourceType.SYNC) {
        syncMappings.push(mapping);
      } else {
        asyncMappings.push(mapping);
      }
    }

    return { syncMappings, asyncMappings };
  }

  /**
   * Xác định source type
   */
  private getSourceType(source: string): SourceType {
    const s = (source || '').toLowerCase();
    
    const asyncSources = [
      'requestbody',
      'request_body',
      'responsebody',
      'response_body',
      'requesturl',
      'request_url'
    ];

    return asyncSources.includes(s) ? SourceType.ASYNC : SourceType.SYNC;
  }

  /**
   * Resolve tất cả sync mappings
   */
  private resolveSyncMappings(
    mappings: PayloadMapping[],
    context: any,
    rule: TrackingRule
  ): Record<string, any> {
    const payload: Record<string, any> = {
      ruleId: rule.id,
      eventTypeId: rule.eventTypeId
    };

    for (const mapping of mappings) {
      const value = this.resolveSyncMapping(mapping, context);
      
      if (this.isValidValue(value)) {
        payload[mapping.field] = value;
      }
    }

    return payload;
  }

  /**
   * Resolve một sync mapping
   */
  private resolveSyncMapping(mapping: PayloadMapping, context: any): any {
    const source = (mapping.source || '').toLowerCase();

    switch (source) {
      case 'element':
        return this.extractFromElement(mapping, context);
      
      case 'cookie':
        return this.extractFromCookie(mapping);
      
      case 'localstorage':
        return this.extractFromLocalStorage(mapping);
      
      case 'sessionstorage':
        return this.extractFromSessionStorage(mapping);
      
      case 'url':
      case 'pageurl':
      case 'page_url':
        return this.extractFromPageUrl(mapping);
      
      case 'static':
        return mapping.value;
      
      case 'login_detector':
        return this.extractFromLoginDetector(mapping);
      
      default:
        return null;
    }
  }

  /**
   * Extract từ element
   */
  private extractFromElement(mapping: PayloadMapping, context: any): any {
    const element = context.element || context.target;
    if (!element) {
      return null;
    }

    const selector = mapping.value;
    if (!selector) {
      return null;
    }

    try {
      // Strategy 1: Find trong scope của element
      let targetElement = element.querySelector(selector);
      
      // Strategy 2: Closest match
      if (!targetElement) {
        targetElement = element.closest(selector);
      }
      
      // Strategy 3: Search trong form parent
      if (!targetElement && element.form) {
        targetElement = element.form.querySelector(selector);
      }

      if (!targetElement) {
        return null;
      }

      // Extract value từ element
      return this.getElementValue(targetElement);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get value từ element (text, value, attribute)
   */
  private getElementValue(element: Element): any {
    // Input elements
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked;
      }
      return element.value;
    }

    // Textarea
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }

    // Select
    if (element instanceof HTMLSelectElement) {
      return element.value;
    }

    // Data attributes
    if (element.hasAttribute('data-value')) {
      return element.getAttribute('data-value');
    }
    if (element.hasAttribute('data-id')) {
      return element.getAttribute('data-id');
    }

    // Text content
    return element.textContent?.trim() || null;
  }

  /**
   * Extract từ cookie
   */
  private extractFromCookie(mapping: PayloadMapping): any {
    const cookieName = mapping.value;
    if (!cookieName) return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=').map(s => s.trim());
      if (name === cookieName) {
        return decodeURIComponent(value);
      }
    }
    
    return null;
  }

  /**
   * Extract từ localStorage
   */
  private extractFromLocalStorage(mapping: PayloadMapping): any {
    const key = mapping.value;
    if (!key) return null;

    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      
      // Try parse JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract từ sessionStorage
   */
  private extractFromSessionStorage(mapping: PayloadMapping): any {
    const key = mapping.value;
    if (!key) return null;

    try {
      const value = sessionStorage.getItem(key);
      if (value === null) return null;
      
      // Try parse JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract từ page URL
   */
  private extractFromPageUrl(mapping: PayloadMapping): any {
    const url = new URL(window.location.href);
    const urlPart = (mapping.urlPart || '').toLowerCase();

    switch (urlPart) {
      case 'query':
      case 'queryparam':
        const paramName = mapping.urlPartValue || mapping.value;
        return url.searchParams.get(paramName);
      
      case 'path':
        return url.pathname;
      
      case 'hash':
        return url.hash.substring(1);
      
      case 'hostname':
        return url.hostname;
      
      default:
        return url.href;
    }
  }

  /**
   * Extract từ LoginDetector (custom integration)
   */
  private extractFromLoginDetector(_mapping: PayloadMapping): any {
    try {
      // @ts-ignore
      const user = window.LoginDetector?.getCurrentUser();
      return user || 'guest';
    } catch {
      return 'guest';
    }
  }

  /**
   * Check if value is valid (not null, undefined, empty string)
   */
  private isValidValue(value: any): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Get REC manager (for external access if needed)
   */
  getRECManager(): RuleExecutionContextManager {
    return this.recManager;
  }

  /**
   * Get active contexts count (for debugging)
   */
  getActiveContextsCount(): number {
    return this.recManager.getActiveCount();
  }
}
