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
import {
  extractFromCookie,
  extractFromLocalStorage,
  extractFromSessionStorage,
  extractFromUrl,
  getElementValue
} from '../utils/data-extractors';

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
    console.log('[PayloadBuilder] handleTrigger called for rule:', rule.name);
    // 1. Phân tích mappings
    const { syncMappings, asyncMappings } = this.classifyMappings(rule);
    console.log('[PayloadBuilder] syncMappings:', syncMappings.length, 'asyncMappings:', asyncMappings.length);

    // 2. Nếu không có async → resolve ngay
    if (asyncMappings.length === 0) {
      console.log('[PayloadBuilder] No async mappings, resolving sync only');
      const payload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
      console.log('[PayloadBuilder] Resolved payload:', payload);
      console.log('[PayloadBuilder] Calling onComplete callback');
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

    // 5. Register rule với NetworkObserver để bắt async data
    this.networkObserver.registerRule(rule);
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
    console.log('[PayloadBuilder] resolveSyncMappings called with', mappings.length, 'mappings');
    const payload: Record<string, any> = {
      ruleId: rule.id,
      eventTypeId: rule.eventTypeId
    };

    for (const mapping of mappings) {
      const value = this.resolveSyncMapping(mapping, context);
      console.log('[PayloadBuilder] Resolved', mapping.field, '=', value, 'from source:', mapping.source);

      if (this.isValidValue(value)) {
        payload[mapping.field] = value;
      } else {
        console.log('[PayloadBuilder] Value is invalid for', mapping.field);
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
      case 'local_storage':
        return this.extractFromLocalStorage(mapping);
      
      case 'sessionstorage':
      case 'session_storage':
        return this.extractFromSessionStorage(mapping);

      case 'pageurl':
      case 'page_url':
        return this.extractFromPageUrl(mapping);
      
      case 'static':
        return mapping.config?.Value;
      
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

    const selector = mapping.config?.SelectorPattern;
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
      return getElementValue(targetElement);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract từ cookie
   */
  private extractFromCookie(mapping: PayloadMapping): any {
    const cookieName = mapping.config?.Value;
    if (!cookieName) return null;

    return extractFromCookie(cookieName);
  }

  /**
   * Extract từ localStorage
   */
  private extractFromLocalStorage(mapping: PayloadMapping): any {
    const key = mapping.config?.Value;
    if (!key) return null;

    return extractFromLocalStorage(key);
  }

  /**
   * Extract từ sessionStorage
   */
  private extractFromSessionStorage(mapping: PayloadMapping): any {
    const key = mapping.config?.Value;
    if (!key) return null;

    return extractFromSessionStorage(key);
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
   * Extract từ page URL (current page)
   * Supports extracting dynamic parameters from URL patterns like /song/:id
   */
  private extractFromPageUrl(mapping: PayloadMapping): any {
    if (typeof window === 'undefined' || !window.location) {
      return null;
    }

    const { PageUrlPattern, PageUrlExtractType, Value } = mapping.config || {};
    
    if (!PageUrlPattern || !Value) {
      return null;
    }

    try {
      const currentUrl = window.location.href;
      const extractType = (PageUrlExtractType || 'pathname').toLowerCase();

      // Use existing extractFromUrl utility with page_url specific config
      return extractFromUrl(currentUrl, Value, extractType, PageUrlPattern);
    } catch (error) {
      // console.error('[PayloadBuilder] Error extracting from page URL:', error);
      return null;
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
