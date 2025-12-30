import { BasePlugin } from './base-plugin';
import { throttle } from './utils/plugin-utils';
import { RatingUtils } from './utils/rating-utils';
export class RatingPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'RatingPlugin';
        this.throttledClickHandler = throttle(this.wrapHandler(this.handleInteraction.bind(this, 'click'), 'handleClick'), 500);
        this.submitHandler = this.wrapHandler(this.handleInteraction.bind(this, 'submit'), 'handleSubmit');
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[RatingPlugin] initialized.`);
        }, 'RatingPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            // 1. Listen for Click (Interactive Rating: Stars, Likes)
            document.addEventListener("click", this.throttledClickHandler, true);
            // 2. Listen for Submit (Traditional Forms)
            document.addEventListener("submit", this.submitHandler, true);
            console.log("[RatingPlugin] started listening for Rating interactions.");
            this.active = true;
        }, 'RatingPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledClickHandler, true);
            document.removeEventListener("submit", this.submitHandler, true);
            super.stop();
        }, 'RatingPlugin.stop');
    }
    handleInteraction(eventType, event) {
        var _a;
        if (!this.tracker)
            return;
        // Trigger ID = 2 for Rating (Standard)
        const eventId = this.tracker.getEventTypeId('Rating') || 2;
        const config = this.tracker.getConfig();
        const rules = (_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId);
        if (!rules || rules.length === 0)
            return;
        const target = event.target;
        if (!target)
            return;
        try {
            for (const rule of rules) {
                const selector = rule.trackingTarget.value;
                if (!selector)
                    continue;
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
                    this.buildAndTrack(matchedElement, rule, eventId, {
                        metadata: {
                            additionalValues: result.reviewText || String(result.normalizedValue),
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
        }
        catch (error) {
            console.warn('[RatingPlugin] Error processing interaction:', error);
        }
    }
}
//# sourceMappingURL=rating-plugin.js.map