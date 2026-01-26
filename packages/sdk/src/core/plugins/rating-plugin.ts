/**
 * RatingPlugin - UI Trigger Layer
 * 
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi rating (click, submit)
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG extract data (PayloadBuilder + NetworkObserver sẽ làm)
 * 
 * FLOW:
 * click/submit → match rule → handleTrigger → DONE
 * Rating value sẽ được lấy từ request body qua NetworkObserver
 */

import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { TrackingRule } from '../../types';

export class RatingPlugin extends BasePlugin {
  public readonly name = 'RatingPlugin';

  private handleClickBound = this.handleClick.bind(this);
  private handleSubmitBound = this.handleSubmit.bind(this);

  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      super.init(tracker);
      // console.log('[RatingPlugin] Initialized');
    }, 'RatingPlugin.init');
  }

  public start(): void {
    this.errorBoundary.execute(() => {
      if (!this.ensureInitialized()) return;

      // Listen for both click and submit events
      document.addEventListener('click', this.handleClickBound, true);
      document.addEventListener('submit', this.handleSubmitBound, true);
      
      this.active = true;
    }, 'RatingPlugin.start');
  }

  public stop(): void {
    this.errorBoundary.execute(() => {
      if (this.tracker) {
        document.removeEventListener('click', this.handleClickBound, true);
        document.removeEventListener('submit', this.handleSubmitBound, true);
      }
      super.stop();
    }, 'RatingPlugin.stop');
  }

  /**
   * Handle click event (interactive rating: stars, likes)
   */
  private handleClick(event: MouseEvent): void {
    this.handleInteraction(event, 'click');
  }

  /**
   * Handle submit event (traditional forms)
   */
  private handleSubmit(event: Event): void {
    this.handleInteraction(event, 'submit');
  }

  /**
   * Main interaction handler
   */
  private handleInteraction(event: Event, _eventType: 'click' | 'submit'): void {
    if (!this.tracker) return;

    const target = event.target as Element;
    if (!target) return;

    const config = this.tracker.getConfig();
    if (!config || !config.trackingRules) return;

    // Get rating event ID
    const ratingEventId = this.tracker.getEventTypeId('Rating') || 2;
    const rulesToCheck = config.trackingRules.filter(r => r.eventTypeId === ratingEventId);

    if (rulesToCheck.length === 0) return;

    // Check each rule
    for (const rule of rulesToCheck) {
      const matchedElement = this.findMatchingElement(target, rule);
      
      if (!matchedElement) {
        continue;
      }

      // Find container (form or parent)
      const container = this.findContainer(matchedElement);

      // Create trigger context - NO rating value extraction
      const triggerContext = {
        element: matchedElement,
        target: matchedElement,
        container: container,
        eventType: 'rating'
      };

      // Delegate to PayloadBuilder
      // PayloadBuilder will extract rating value from network request body
      this.tracker.payloadBuilder.handleTrigger(
        rule,
        triggerContext,
        (payload) => {
          // Dispatch rating event
          this.dispatchEvent(payload, rule, ratingEventId);
        }
      );
    }
  }

  /**
   * Find element matching rule selector
   */
  private findMatchingElement(target: Element, rule: TrackingRule): Element | null {
    const selector = rule.trackingTarget;
    if (!selector) return null;

    try {
      // Try closest match
      let match = target.closest(selector);
      
      // Flexible matching for CSS modules
      if (!match && selector.startsWith('.')) {
        const baseClassName = selector.substring(1).split('_')[0];
        let parent: Element | null = target;
        let depth = 0;

        while (parent && depth < 10) {
          const className = parent.className;
          if (typeof className === 'string' && className.includes(baseClassName)) {
            match = parent;
            break;
          }
          parent = parent.parentElement;
          depth++;
        }
      }

      return match;
    } catch (e) {
      return null;
    }
  }

  /**
   * Find rating container (form, rating-box, etc.)
   */
  private findContainer(element: Element): Element {
    // Try to find form
    const form = element.closest('form');
    if (form) return form;

    // Try to find rating container
    const ratingContainer = element.closest('.rating-container') ||
                           element.closest('.rating-box') ||
                           element.closest('.review-box') ||
                           element.closest('[data-rating]');
    
    if (ratingContainer) return ratingContainer;

    // Fallback to parent or body
    return element.parentElement || document.body;
  }

  /**
   * Dispatch tracking event
   */
  private dispatchEvent(payload: Record<string, any>, rule: TrackingRule, eventId: number): void {
    if (!this.tracker) return;

    this.tracker.track({
      eventType: eventId,
      eventData: {
        ...payload,
        actionType: rule.actionType || null
      },
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
