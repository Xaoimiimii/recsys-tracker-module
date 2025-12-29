import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { throttle } from './utils/plugin-utils';
import { RatingUtils } from './utils/rating-utils';

export class RatingPlugin extends BasePlugin {
    public readonly name = 'RatingPlugin';

    private detector: AIItemDetector | null = null;

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
            this.detector = getAIItemDetector();
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

            console.log("[RatingPlugin] started listening (Universal Mode).");
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
        if (!this.tracker || !this.detector) return;

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

                    // Detect Item ID
                    let structuredItem = null;
                    if (!rule.trackingTarget.value?.startsWith('^')) {
                        structuredItem = this.detector.detectItem(container);
                    }

                    // Build Payload using centralized method
                    this.buildAndTrack(structuredItem || matchedElement, rule, eventId, {
                        value: result.reviewText || String(result.normalizedValue),
                        metadata: {
                            rawRateValue: result.originalValue,
                            rateMax: result.maxValue,
                            rateType: result.type,
                            captureMethod: result.captureMethod,
                            normalizedValue: result.normalizedValue,
                            reviewText: result.reviewText
                        }
                    });

                    break;
                }
            }
        } catch (error) {
            console.warn('[RatingPlugin] Error processing interaction:', error);
        }
    }
}