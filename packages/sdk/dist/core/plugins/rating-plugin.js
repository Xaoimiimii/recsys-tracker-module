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
            this.active = true;
            console.log('[RatingPlugin] Started successfully');
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
        console.log('[RatingPlugin] handleInteraction called, eventType:', eventType);
        if (!this.tracker) {
            console.warn('[RatingPlugin] No tracker');
            return;
        }
        // Trigger ID = 2 for Rating (Standard)
        const eventId = this.tracker.getEventTypeId('Rating') || 2;
        const config = this.tracker.getConfig();
        const rules = (_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId);
        console.log('[RatingPlugin] Found', (rules === null || rules === void 0 ? void 0 : rules.length) || 0, 'rating rules');
        if (!rules || rules.length === 0) {
            console.warn('[RatingPlugin] No rating rules found');
            return;
        }
        const target = event.target;
        if (!target) {
            console.warn('[RatingPlugin] No target');
            return;
        }
        console.log('[RatingPlugin] Target:', target);
        try {
            for (const rule of rules) {
                const selector = rule.trackingTarget.value;
                console.log('[RatingPlugin] Checking rule:', rule.name, 'selector:', selector);
                if (!selector) {
                    console.warn('[RatingPlugin] No selector for rule:', rule.name);
                    continue;
                }
                const matchedElement = target.closest(selector);
                console.log('[RatingPlugin] Matched element:', matchedElement);
                // TEMPORARY: Flexible matching for CSS modules
                let finalMatch = matchedElement;
                if (!finalMatch && selector.startsWith('.')) {
                    // Extract base class name (remove leading dot and everything after underscore)
                    const baseClassName = selector.substring(1).split('_')[0];
                    console.log('[RatingPlugin] Trying flexible match with base class:', baseClassName);
                    // Try to find parent with matching base class
                    let parent = target;
                    let depth = 0;
                    while (parent && depth < 10) {
                        const parentClassName = parent.className;
                        if (typeof parentClassName === 'string' && parentClassName.includes(baseClassName)) {
                            finalMatch = parent;
                            console.log('[RatingPlugin] Flexible match found at depth', depth);
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                }
                if (finalMatch) {
                    // Determine Container
                    const container = finalMatch.closest('form') ||
                        finalMatch.closest('.rating-container') ||
                        finalMatch.closest('.review-box') ||
                        finalMatch.parentElement ||
                        document.body;
                    // Process Rating
                    const result = RatingUtils.processRating(container, finalMatch, eventType);
                    console.log('[RatingPlugin] Rating result:', result);
                    // Filter garbage
                    if (result.originalValue === 0 && !result.reviewText) {
                        console.warn('[RatingPlugin] Filtered as garbage (value=0, no review)');
                        continue;
                    }
                    console.log(`[RatingPlugin] 🎯 Captured [${eventType}]: Raw=${result.originalValue}/${result.maxValue} -> Norm=${result.normalizedValue}`);
                    // DUPLICATE PREVENTION & NETWORK DATA STRATEGY
                    // Check if this rule requires network data
                    let requiresNetworkData = false;
                    if (rule.payloadMappings) {
                        requiresNetworkData = rule.payloadMappings.some((m) => {
                            const s = (m.source || '').toLowerCase();
                            return [
                                'requestbody',
                                'responsebody',
                                'request_body',
                                'response_body',
                                'requesturl',
                                'request_url'
                            ].includes(s);
                        });
                    }
                    if (requiresNetworkData) {
                        console.log('[RatingPlugin] Rule requires network data. Signaling pending network event for rule:', rule.id);
                        if (this.tracker && typeof this.tracker.addPendingNetworkRule === 'function') {
                            this.tracker.addPendingNetworkRule(rule.id);
                        }
                        else {
                            console.warn('[RatingPlugin] Tracker does not support addPendingNetworkRule');
                        }
                        break;
                    }
                    // Build Payload using centralized method
                    this.buildAndTrack(finalMatch, rule, eventId);
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