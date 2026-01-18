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
import {
  extractFromCookie,
  extractFromLocalStorage,
  extractFromSessionStorage,
  parseBody,
  extractByPath,
  extractFromUrl
} from '../utils/data-extractors';

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
      domainId: 11,
      requestConfig: {
        RequestUrlPattern: '/api/auth/me',
        RequestMethod: 'GET',
        Value: 'username'
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
          extractedValue = extractFromLocalStorage(value || '');
          break;

        case 'session_storage':
          extractedValue = extractFromSessionStorage(value || '');
          break;

        case 'cookie':
          extractedValue = extractFromCookie(value || '');
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
        extractedValue = extractByPath(parseBody(body), Value);
      } else if (source === 'request_url') {
        // Extract từ URL
        extractedValue = extractFromUrl(url, Value, ExtractType, requestConfig.RequestUrlPattern);
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
