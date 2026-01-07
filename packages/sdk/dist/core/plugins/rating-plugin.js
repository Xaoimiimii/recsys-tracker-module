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
export class RatingPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'RatingPlugin';
        this.handleClickBound = this.handleClick.bind(this);
        this.handleSubmitBound = this.handleSubmit.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log('[RatingPlugin] Initialized');
        }, 'RatingPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            // Listen for both click and submit events
            document.addEventListener('click', this.handleClickBound, true);
            document.addEventListener('submit', this.handleSubmitBound, true);
            this.active = true;
            console.log('[RatingPlugin] ✅ Started');
        }, 'RatingPlugin.start');
    }
    stop() {
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
    handleClick(event) {
        this.handleInteraction(event, 'click');
    }
    /**
     * Handle submit event (traditional forms)
     */
    handleSubmit(event) {
        console.log('[RatingPlugin] 🔔 Submit event detected');
        this.handleInteraction(event, 'submit');
    }
    /**
     * Main interaction handler
     */
    handleInteraction(event, eventType) {
        if (!this.tracker)
            return;
        const target = event.target;
        if (!target)
            return;
        console.log(`[RatingPlugin] 🎯 handleInteraction called: eventType=${eventType}, target=`, target);
        const config = this.tracker.getConfig();
        if (!config || !config.trackingRules)
            return;
        // Get rating event ID
        const ratingEventId = this.tracker.getEventTypeId('Rating') || 2;
        const rulesToCheck = config.trackingRules.filter(r => r.eventTypeId === ratingEventId);
        if (rulesToCheck.length === 0)
            return;
        console.log(`[RatingPlugin] ⭐ ${eventType} detected, checking ${rulesToCheck.length} rules`);
        // Check each rule
        for (const rule of rulesToCheck) {
            const matchedElement = this.findMatchingElement(target, rule);
            if (!matchedElement) {
                continue;
            }
            console.log(`[RatingPlugin] ✅ Matched rule: "${rule.name}" (EventTypeId: ${rule.eventTypeId})`);
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
            this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                // Dispatch rating event
                this.dispatchEvent(payload, rule, ratingEventId);
            });
        }
    }
    /**
     * Find element matching rule selector
     */
    findMatchingElement(target, rule) {
        var _a;
        const selector = (_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value;
        if (!selector)
            return null;
        try {
            // Try closest match
            let match = target.closest(selector);
            // Flexible matching for CSS modules
            if (!match && selector.startsWith('.')) {
                const baseClassName = selector.substring(1).split('_')[0];
                let parent = target;
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
        }
        catch (e) {
            console.error('[RatingPlugin] Selector error:', e);
            return null;
        }
    }
    /**
     * Find rating container (form, rating-box, etc.)
     */
    findContainer(element) {
        // Try to find form
        const form = element.closest('form');
        if (form)
            return form;
        // Try to find rating container
        const ratingContainer = element.closest('.rating-container') ||
            element.closest('.rating-box') ||
            element.closest('.review-box') ||
            element.closest('[data-rating]');
        if (ratingContainer)
            return ratingContainer;
        // Fallback to parent or body
        return element.parentElement || document.body;
    }
    /**
     * Dispatch tracking event
     */
    dispatchEvent(payload, rule, eventId) {
        if (!this.tracker)
            return;
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
//# sourceMappingURL=rating-plugin.js.map