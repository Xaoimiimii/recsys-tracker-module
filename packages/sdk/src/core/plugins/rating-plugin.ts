import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { throttle } from './utils/plugin-utils';
import { RatingUtils } from './utils/rating-utils';

export class RatingPlugin extends BasePlugin {
    public readonly name = 'RatingPlugin';

    // Throttle for click (prevent spam)
    private throttledClickHandler: (event: Event) => void;
    // No throttle for submit
    private submitHandler: (event: Event) => void;

    constructor() {
        super();
        this.throttledClickHandler = throttle(
            this.wrapHandler(this.handleInteraction.bind(this, 'click'), 'handleClick'),
            500
        );
        this.submitHandler = this.wrapHandler(this.handleInteraction.bind(this, 'submit'), 'handleSubmit');
    }

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[RatingPlugin] initialized.`);
        }, 'RatingPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;

            // 1. Listen for Click (Interactive Rating: Stars, Likes)
            document.addEventListener("click", this.throttledClickHandler, true);

            // 2. Listen for Submit (Traditional Forms)
            document.addEventListener("submit", this.submitHandler, true);

            this.active = true;
        }, 'RatingPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledClickHandler, true);
            document.removeEventListener("submit", this.submitHandler, true);
            super.stop();
        }, 'RatingPlugin.stop');
    }

    private handleInteraction(eventType: 'click' | 'submit', event: Event): void {
        if (!this.tracker) return;

        // Trigger ID = 2 for Rating (Standard)
        const eventId = this.tracker.getEventTypeId('Rating') || 2;
        const config = this.tracker.getConfig();
        const rules = config?.trackingRules?.filter(r => r.eventTypeId === eventId);

        if (!rules || rules.length === 0) return;

        const target = event.target as Element;
        if (!target) return;

        try {
            for (const rule of rules) {
                const selector = rule.trackingTarget.value;
                if (!selector) continue;

                const matchedElement = target.closest(selector);

                if (matchedElement) {
                    // Determine Container
                    const container = matchedElement.closest('form') ||
                        matchedElement.closest('.rating-container') ||
                        matchedElement.closest('.review-box') ||
                        matchedElement.parentElement ||
                        document.body;

                    // Process Rating
                    const result = RatingUtils.processRating(container, matchedElement, eventType);

                    // Filter garbage
                    if (result.originalValue === 0 && !result.reviewText) {
                        continue;
                    }

                    console.log(`[RatingPlugin] 🎯 Captured [${eventType}]: Raw=${result.originalValue}/${result.maxValue} -> Norm=${result.normalizedValue}`);

                    // Build Payload using centralized method
                    this.buildAndTrack(matchedElement, rule, eventId);
                    break;
                }
            }
        } catch (error) {
            console.warn('[RatingPlugin] Error processing interaction:', error);
        }
    }
}