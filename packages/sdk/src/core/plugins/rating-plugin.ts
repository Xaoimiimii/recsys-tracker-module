/**
 * RatingPlugin - UI Trigger Layer
 * 
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi rating (click, submit)
 * 2. Match với tracking rules
 * 3. Extract rating value/metadata
 * 4. Gọi PayloadBuilder.handleTrigger()
 * 5. KHÔNG bắt network (chỉ thu thập UI data)
 * 
 * FLOW:
 * click/submit → detect rating → check rules → handleTrigger → DONE
 */

import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { TrackingRule } from '../../types';
import { RatingUtils } from './utils/rating-utils';

export class RatingPlugin extends BasePlugin {
  public readonly name = 'RatingPlugin';

  private handleClickBound = this.handleClick.bind(this);
  private handleSubmitBound = this.handleSubmit.bind(this);
  
  // Throttle to prevent spam
  private lastTriggerTime = 0;
  private readonly THROTTLE_MS = 500;

  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      super.init(tracker);
      console.log('[RatingPlugin] Initialized');
    }, 'RatingPlugin.init');
  }

  public start(): void {
    this.errorBoundary.execute(() => {
      if (!this.ensureInitialized()) return;

      // Listen for both click and submit events
      document.addEventListener('click', this.handleClickBound, true);
      document.addEventListener('submit', this.handleSubmitBound, true);
      
      this.active = true;
      console.log('[RatingPlugin] ✅ Started');
    }, 'RatingPlugin.start');
  }

  public stop(): void {
    this.errorBoundary.execute(() => {
      if (this.tracker) {
        document.removeEventListener('click', this.handleClickBound, true);
        document.removeEventListener('submit', this.handleSubmitBound, true);
      }
      super.stop();
      console.log('[RatingPlugin] Stopped');
    }, 'RatingPlugin.stop');
  }

  /**
   * Handle click event (interactive rating: stars, likes)
   */
  private handleClick(event: MouseEvent): void {
    // Throttle
    const now = Date.now();
    if (now - this.lastTriggerTime < this.THROTTLE_MS) {
      return;
    }

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
  private handleInteraction(event: Event, eventType: 'click' | 'submit'): void {
    if (!this.tracker) return;

    const target = event.target as Element;
    if (!target) return;

    const config = this.tracker.getConfig();
    if (!config || !config.trackingRules) return;

    // Get rating and review event IDs
    const ratingEventId = this.tracker.getEventTypeId('Rating') || 2;
    // ONLY handle rating rules (eventTypeId === 2)
    // Review rules should be handled by ReviewPlugin
    const rulesToCheck = config.trackingRules.filter(r => r.eventTypeId === ratingEventId);

    if (rulesToCheck.length === 0) return;

    console.log(`[RatingPlugin] ⭐ ${eventType} detected, checking ${rulesToCheck.length} rules`);

    // Track which rules matched
    const matchedRules: Array<{ rule: any; element: Element; container: Element; ratingData: any }> = [];

    // Check each rule
    for (const rule of rulesToCheck) {
      const matchedElement = this.findMatchingElement(target, rule);
      
      if (!matchedElement) {
        continue;
      }

      // Extract rating data
      const container = this.findContainer(matchedElement);
      const ratingData = RatingUtils.processRating(container, matchedElement, eventType);

      console.log(`[RatingPlugin] ✅ Matched rule: "${rule.name}" (EventTypeId: ${rule.eventTypeId})`);
      console.log('[RatingPlugin] Rating data:', ratingData);

      // Filter garbage: 0 rating
      if (ratingData.originalValue === 0) {
        console.warn('[RatingPlugin] Filtered: zero rating');
        continue;
      }

      matchedRules.push({ rule, element: matchedElement, container, ratingData });
    }

    if (matchedRules.length === 0) return;

    // Update throttle time
    this.lastTriggerTime = Date.now();

    // Process each matched rule separately (send separate events)
    for (const { rule, element, container, ratingData } of matchedRules) {
      // Create trigger context for rating
      const triggerContext = {
        element: element,
        target: element,
        container: container,
        eventType: 'rating',
        ratingValue: ratingData.normalizedValue,
        ratingRaw: ratingData.originalValue,
        ratingMax: ratingData.maxValue,
        ratingType: ratingData.type
      };

      // Delegate to PayloadBuilder
      this.tracker.payloadBuilder.handleTrigger(
        rule,
        triggerContext,
        (payload) => {
          // Enrich payload with rating data
          const enrichedPayload = {
            ...payload,
            Value: ratingData.normalizedValue,
            ratingRaw: ratingData.originalValue,
            ratingMax: ratingData.maxValue
          };
          
          // Dispatch rating event
          this.dispatchEvent(enrichedPayload, rule, ratingEventId);
        }
      );
    }
  }

  /**
   * Find element matching rule selector
   */
  private findMatchingElement(target: Element, rule: TrackingRule): Element | null {
    const selector = rule.trackingTarget?.value;
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
      console.error('[RatingPlugin] Selector error:', e);
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

    console.log('[RatingPlugin] 📤 Dispatching event with payload:', payload);

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
