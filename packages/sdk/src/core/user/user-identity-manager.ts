/**
 * UserIdentityManager - Quản lý User Identity riêng biệt
 * 
 * TRÁCH NHIỆM:
 * 1. Load UserIdentity config từ API
 * 2. Extract user info từ các nguồn khác nhau (request_body, request_url, localStorage, etc.)
 * 3. Cache user info vào localStorage
 * 4. Provide user info khi cần gửi event
 */

import { UserIdentityConfig } from '../../types';
import { saveCachedUserInfo, getCachedUserInfo, getOrCreateAnonymousId } from '../plugins/utils/plugin-utils';
import { PathMatcher } from '../utils/path-matcher';

export class UserIdentityManager {
  private userIdentityConfig: UserIdentityConfig | null = null;
  private isInitialized = false;

  /**
   * Initialize và load user identity config
   * @param domainKey - Domain key để load config
   */
  async initialize(domainKey: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[UserIdentityManager] Initializing for domain:', domainKey);

    // Load user identity config
    this.userIdentityConfig = await this.loadUserIdentityConfig(domainKey);

    if (this.userIdentityConfig) {
      console.log('[UserIdentityManager] Config loaded:', this.userIdentityConfig);
      
      // Nếu source là network (request_body/request_url), đăng ký với NetworkObserver
      if (this.isNetworkSource(this.userIdentityConfig.source)) {
        console.log('[UserIdentityManager] Network source detected, will be handled by NetworkObserver');
      } else {
        // Nếu source là static (localStorage, cookie, etc.), extract ngay
        this.extractAndCacheUserInfo();
      }
    }

    this.isInitialized = true;
  }

  /**
   * Load user identity config từ API (mock for now)
   * TODO: Replace with real API call when available
   */
  private async loadUserIdentityConfig(_domainKey: string): Promise<UserIdentityConfig | null> {
    console.log('[UserIdentityManager] Loading user identity config (MOCK)');
    
    // MOCK DATA
    const mockConfig: UserIdentityConfig = {
      id: 1,
      source: 'request_body',
      domainId: 20,
      requestConfig: {
        RequestUrlPattern: '/api/user/profile',
        RequestMethod: 'GET',
        Value: 'data.userId'
      },
      field: 'UserId'
    };

    return mockConfig;
  }

  /**
   * Extract và cache user info từ static sources (localStorage, cookie, etc.)
   */
  private extractAndCacheUserInfo(): void {
    if (!this.userIdentityConfig) {
      return;
    }

    const { source, value, field } = this.userIdentityConfig;
    let extractedValue: string | null = null;

    try {
      switch (source) {
        case 'local_storage':
          extractedValue = localStorage.getItem(value || '');
          break;

        case 'session_storage':
          extractedValue = sessionStorage.getItem(value || '');
          break;

        case 'cookie':
          extractedValue = this.getCookie(value || '');
          break;

        case 'element':
          // Extract từ element trên page (ít dùng cho user identity)
          if (value) {
            const element = document.querySelector(value);
            extractedValue = element?.textContent || null;
          }
          break;

        default:
          console.warn('[UserIdentityManager] Unsupported static source:', source);
          return;
      }

      if (extractedValue) {
        console.log('[UserIdentityManager] Extracted user info from', source, ':', extractedValue);
        saveCachedUserInfo(field, extractedValue);
      }
    } catch (error) {
      console.error('[UserIdentityManager] Error extracting user info:', error);
    }
  }

  /**
   * Get cookie value by name
   */
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  /**
   * Check if source is network-based
   */
  private isNetworkSource(source: string): boolean {
    return source === 'request_body' || source === 'request_url';
  }

  /**
   * Check if a network request matches the user identity config
   * Called by NetworkObserver
   */
  matchesUserIdentityRequest(url: string, method: string): boolean {
    if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
      return false;
    }

    const { RequestUrlPattern, RequestMethod } = this.userIdentityConfig.requestConfig;

    if (RequestMethod.toUpperCase() !== method.toUpperCase()) {
      return false;
    }

    return PathMatcher.match(url, RequestUrlPattern);
  }

  /**
   * Extract user info từ network request
   * Called by NetworkObserver khi match được request
   */
  extractFromNetworkRequest(
    url: string,
    method: string,
    requestBody?: any,
    responseBody?: any
  ): void {
    if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
      return;
    }

    const { source, field, requestConfig } = this.userIdentityConfig;
    const { Value, ExtractType } = requestConfig;

    let extractedValue: any = null;

    try {
      if (source === 'request_body') {
        // Extract từ response body (for GET) or request body (for POST/PUT)
        const body = method.toUpperCase() === 'GET' ? responseBody : requestBody;
        extractedValue = this.extractByPath(this.parseBody(body), Value);
      } else if (source === 'request_url') {
        // Extract từ URL
        extractedValue = this.extractFromUrl(url, Value, ExtractType);
      }

      if (extractedValue) {
        console.log('[UserIdentityManager] Extracted user info from network:', extractedValue);
        saveCachedUserInfo(field, String(extractedValue));
      }
    } catch (error) {
      console.error('[UserIdentityManager] Error extracting from network:', error);
    }
  }

  /**
   * Extract value từ URL (pathname or query)
   */
  private extractFromUrl(url: string, value: string, extractType?: string): any {
    try {
      const urlObj = new URL(url, window.location.origin);

      if (extractType === 'query') {
        return urlObj.searchParams.get(value);
      } else if (extractType === 'pathname') {
        // Extract từ pathname segments
        const segments = urlObj.pathname.split('/').filter(s => s);
        const index = parseInt(value, 10);
        if (!isNaN(index) && index >= 0 && index < segments.length) {
          return segments[index];
        }
      }

      return null;
    } catch (error) {
      console.error('[UserIdentityManager] Error extracting from URL:', error);
      return null;
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
   * Get current user info để gửi với event
   * Trả về cached user info hoặc AnonymousId
   */
  getUserInfo(): { field: string; value: string } {
    const cached = getCachedUserInfo();

    if (cached && cached.userValue) {
      return {
        field: cached.userField,
        value: cached.userValue
      };
    }

    // Fallback to AnonymousId
    return {
      field: 'AnonymousId',
      value: getOrCreateAnonymousId()
    };
  }

  /**
   * Get user identity config (for debugging)
   */
  getConfig(): UserIdentityConfig | null {
    return this.userIdentityConfig;
  }
}
