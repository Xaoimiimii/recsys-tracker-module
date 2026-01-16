/**
 * ClickPlugin - UI Trigger Layer
 * 
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi click
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG lấy payload, KHÔNG bắt network
 * 
 * FLOW:
 * click event → check rules → handleTrigger → DONE
 */

import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { TrackingRule } from '../../types';

export class ClickPlugin extends BasePlugin {
  public readonly name = 'ClickPlugin';

  private handleClickBound = this.handleClick.bind(this);

  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      super.init(tracker);
      console.log('[ClickPlugin] Initialized');
    }, 'ClickPlugin.init');
  }

  public start(): void {
    this.errorBoundary.execute(() => {
      if (!this.ensureInitialized()) return;

      document.addEventListener('click', this.handleClickBound, true);
      this.active = true;
    }, 'ClickPlugin.start');
  }

  public stop(): void {
    this.errorBoundary.execute(() => {
      if (this.tracker) {
        document.removeEventListener('click', this.handleClickBound, true);
      }
      super.stop();
    }, 'ClickPlugin.stop');
  }

  /**
   * Handle click event - TRIGGER PHASE
   */
  private handleClick(event: MouseEvent): void {
    if (!this.tracker) return;

    const clickedElement = event.target as HTMLElement;
    if (!clickedElement) return;

    // Get click rules
    const eventId = this.tracker.getEventTypeId('Click') || 1;
    const config = this.tracker.getConfig();
    const clickRules = config?.trackingRules?.filter(r => r.eventTypeId === eventId) || [];

    if (clickRules.length === 0) return;

    // Check each rule
    for (const rule of clickRules) {
      const matchedElement = this.findMatchingElement(clickedElement, rule);
      
      if (!matchedElement) {
        continue;
      }

      // No checkConditions needed - schema simplified

      // Create trigger context
      const triggerContext = {
        element: matchedElement,
        target: matchedElement,
        clickedElement: clickedElement,
        eventType: 'click',
        event: event
      };

      // Delegate to PayloadBuilder
      this.tracker.payloadBuilder.handleTrigger(
        rule,
        triggerContext,
        (payload) => {
          // Callback khi payload ready
          this.dispatchEvent(payload, rule, eventId);
        }
      );

      // Chỉ track rule đầu tiên match
      return;
    }
  }

  /**
   * Find element matching rule selector (CSS Selector)
   */
  private findMatchingElement(clickedElement: HTMLElement, rule: TrackingRule): HTMLElement | null {
    // trackingTarget is now a direct string (CSS Selector)
    const selector = rule.trackingTarget;
    if (!selector) return null;

    try {
      // Strategy 1: Strict match (element itself)
      if (clickedElement.matches(selector)) {
        return clickedElement;
      }

      // Strategy 2: Flexible class match (for CSS modules)
      if (selector.startsWith('.')) {
        const className = selector.substring(1);
        if (this.hasFlexibleClassMatch(clickedElement, className)) {
          return clickedElement;
        }
      }

      // Strategy 3: Closest match (parent traversal)
      // Only if clicked element is NOT interactive (avoid false positives)
      const isInteractive = this.isInteractiveElement(clickedElement);
      
      if (!isInteractive) {
        const closestMatch = clickedElement.closest(selector);
        if (closestMatch) {
          return closestMatch as HTMLElement;
        }

        // Flexible class match on parents
        if (selector.startsWith('.')) {
          const className = selector.substring(1);
          const flexibleParent = this.findParentWithFlexibleClass(clickedElement, className);
          if (flexibleParent) {
            return flexibleParent;
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if element has flexible class match (for CSS modules)
   */
  private hasFlexibleClassMatch(element: HTMLElement, baseClassName: string): boolean {
    const actualClassName = element.className;
    if (typeof actualClassName !== 'string') return false;

    // Extract base name (remove hash for CSS modules)
    const baseName = baseClassName.split('_')[0];
    return actualClassName.includes(baseName);
  }

  /**
   * Find parent with flexible class match
   */
  private findParentWithFlexibleClass(element: HTMLElement, baseClassName: string): HTMLElement | null {
    const baseName = baseClassName.split('_')[0];
    let parent = element.parentElement;
    let depth = 0;

    while (parent && depth < 10) {
      const className = parent.className;
      if (typeof className === 'string' && className.includes(baseName)) {
        return parent;
      }
      parent = parent.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Check if element is interactive (button, link, etc.)
   */
  private isInteractiveElement(element: HTMLElement): boolean {
    const tagName = element.tagName;
    
    if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) {
      return true;
    }

    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'menuitem'].includes(role)) {
      return true;
    }

    return false;
  }

  /**
   * Check conditions - removed, schema simplified
   * No longer uses conditions with patternId/operatorId
   */
  // checkConditions removed

  /**
   * Dispatch tracking event
   */
  private dispatchEvent(payload: Record<string, any>, rule: TrackingRule, eventId: number): void {
    if (!this.tracker) return;

    this.tracker.track({
      eventType: eventId,
      eventData: payload,
      timestamp: Date.now(),
      url: window.location.href,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        plugin: this.name
      }
    });
  }
}
