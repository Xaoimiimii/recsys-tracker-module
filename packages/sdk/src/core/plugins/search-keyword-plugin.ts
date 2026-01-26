import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { getOrCreateAnonymousId } from './utils/plugin-utils';

export class SearchKeywordPlugin extends BasePlugin {
  public readonly name = 'SearchKeywordPlugin';

  private inputElement: HTMLInputElement | null = null;
  private handleKeyPressBound = this.handleKeyPress.bind(this);

  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      super.init(tracker);
    }, 'SearchKeywordPlugin.init');
  }

  public start(): void {
    this.errorBoundary.execute(() => {
      if (!this.ensureInitialized()) return;

      const config = this.tracker!.getConfig();
      const searchKeywordConfig = config?.searchKeywordConfig;

      if (!searchKeywordConfig) {
        return;
      }

      // Attach listeners
      this.attachListeners(searchKeywordConfig.InputSelector);
      this.active = true;
    }, 'SearchKeywordPlugin.start');
  }

  public stop(): void {
    this.errorBoundary.execute(() => {
      this.removeListeners();
      super.stop();
    }, 'SearchKeywordPlugin.stop');
  }

  /**
   * Attach event listeners to input element
   */
  private attachListeners(selector: string): void {
    // Tìm input element
    this.inputElement = this.findInputElement(selector);

    if (!this.inputElement) {
      // Retry sau một khoảng thời gian (DOM có thể chưa load xong)
      setTimeout(() => {
        this.inputElement = this.findInputElement(selector);
        if (this.inputElement) {
          this.addEventListeners();
        }
      }, 1000);
      
      return;
    }
    this.addEventListeners();
  }

  /**
   * Find input element with fallback strategies
   * 1. Direct querySelector
   * 2. Find element with class containing selector, then find input inside
   * 3. Find element with class containing selector, check if it's an input
   */
  private findInputElement(selector: string): HTMLInputElement | null {
    // Strategy 1: Direct querySelector
    let element = document.querySelector<HTMLInputElement>(selector);
    if (element) {
      return element;
    }

    // Strategy 2 & 3: Contains match for class names
    // Remove leading dot if present (e.g., ".search-bar" -> "search-bar")
    const cleanSelector = selector.startsWith('.') ? selector.slice(1) : selector;
    
    // Find all elements with class containing the selector
    const allElements = Array.from(document.querySelectorAll('[class]'));
    for (const el of allElements) {
      const classList = el.className;
      if (typeof classList === 'string' && classList.includes(cleanSelector)) {
        // Check if this element itself is an input
        if (el.tagName === 'INPUT') {
          return el as HTMLInputElement;
        }
        
        // Try to find input inside this element
        const inputInside = el.querySelector('input') as HTMLInputElement;
        if (inputInside) {
          return inputInside;
        }
      }
    }
    return null;
  }

  /**
   * Add event listeners to input element
   */
  private addEventListeners(): void {
    if (!this.inputElement) return;
    
    // Listen for keypress events (khi user nhấn Enter)
    this.inputElement.addEventListener('keypress', this.handleKeyPressBound);
  }

  /**
   * Remove event listeners
   */
  private removeListeners(): void {
    if (this.inputElement) {
      // this.inputElement.removeEventListener('input', this.handleInputBound);
      this.inputElement.removeEventListener('keypress', this.handleKeyPressBound);
      this.inputElement = null;
    }
  }

  /**
   * Handle keypress event - log khi user nhấn Enter (không debounce)
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const target = event.target as HTMLInputElement;
      const searchKeyword = target.value.trim();

      if (searchKeyword) {
        // console.log('[SearchKeywordPlugin] Search keyword (Enter pressed):', searchKeyword);
        // this.saveKeyword(searchKeyword);

        // Trigger push keyword API ngay lập tức
        this.triggerPushKeyword(searchKeyword);
      }
    }
  }

  /**
   * Trigger push keyword API (được gọi khi nhấn Enter hoặc từ DisplayManager)
   */
  private async triggerPushKeyword(keyword: string): Promise<void> {
    if (!this.tracker) return;

    const config = this.tracker.getConfig();
    if (!config) return;

    const userInfo = this.tracker.userIdentityManager.getUserInfo();
    const userId = userInfo.value || '';
    const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();

    await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
  }

  /**
   * Call API POST recommendation/push-keyword
   */
  public async pushKeywordToServer(
    userId: string, 
    anonymousId: string, 
    domainKey: string, 
    keyword: string
  ): Promise<void> {
    const baseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
    const url = `${baseUrl}/recommendation/push-keyword`;

    const payload = {
      UserId: userId,
      AnonymousId: anonymousId,
      DomainKey: domainKey,
      Keyword: keyword
    };

    try {
      // console.log('[SearchKeywordPlugin] Pushing keyword to server:', payload);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // console.log('[SearchKeywordPlugin] Keyword pushed successfully');
      } else {
        // console.error('[SearchKeywordPlugin] Failed to push keyword:', response.statusText);
      }
    } catch (error) {
      // console.error('[SearchKeywordPlugin] Error pushing keyword:', error);
    }
  }
}
