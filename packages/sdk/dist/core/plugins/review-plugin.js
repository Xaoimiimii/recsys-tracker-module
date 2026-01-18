/**
 * ReviewPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi review (form submit)
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG lấy payload, KHÔNG bắt network
 *
 * FLOW:
 * submit event → check rules → handleTrigger → DONE
 */
import { BasePlugin } from './base-plugin';
export class ReviewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ReviewPlugin';
        this.handleSubmitBound = this.handleSubmit.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log('[ReviewPlugin] Initialized');
        }, 'ReviewPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            this.active = true;
        }, 'ReviewPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            }
            super.stop();
        }, 'ReviewPlugin.stop');
    }
    /**
     * Handle submit event - TRIGGER PHASE
     * NOTE: This is now mainly a fallback. Rating Plugin handles most review detection.
     */
    handleSubmit(event) {
        var _a;
        if (!this.tracker)
            return;
        const target = event.target;
        if (!target)
            return;
        // Get review rules
        const eventId = this.tracker.getEventTypeId('Review') || 3;
        const config = this.tracker.getConfig();
        const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        if (reviewRules.length === 0)
            return;
        // Check each rule
        for (const rule of reviewRules) {
            // Try to find matching element (form or button)
            const matchedElement = this.findMatchingElement(target, rule);
            if (!matchedElement) {
                continue;
            }
            // Find container (form or parent)
            const container = this.findContainer(matchedElement);
            // Auto-detect review content from container
            const reviewContent = this.autoDetectReviewContent(container);
            // Filter if no review content
            if (!reviewContent) {
                continue;
            }
            // Create trigger context
            const triggerContext = {
                element: matchedElement,
                target: matchedElement,
                container: container,
                eventType: 'review',
                reviewContent: reviewContent,
                Value: reviewContent
            };
            // Delegate to PayloadBuilder
            this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                // Enrich with review content
                const enrichedPayload = {
                    ...payload,
                    Value: reviewContent
                };
                // Callback khi payload ready
                this.dispatchEvent(enrichedPayload, rule, eventId);
            });
            // Track all matching rules (không return)
        }
    }
    /**
     * Find element matching rule selector
     */
    findMatchingElement(target, rule) {
        const selector = rule.trackingTarget;
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
            return null;
        }
    }
    /**
     * Find container (form or parent element)
     */
    findContainer(element) {
        // Try to find form
        const form = element.closest('form');
        if (form)
            return form;
        // Try to find review container
        const container = element.closest('.review-container') ||
            element.closest('.review-box') ||
            element.closest('[data-review]');
        if (container)
            return container;
        // Fallback to parent or body
        return element.parentElement || document.body;
    }
    /**
     * Auto-detect review content from container
     */
    autoDetectReviewContent(container) {
        var _a, _b;
        // Strategy 1: textarea với name/id có 'review', 'comment', 'content'
        const textareas = Array.from(container.querySelectorAll('textarea'));
        for (const textarea of textareas) {
            const name = ((_a = textarea.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            const id = ((_b = textarea.id) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
            if (name.includes('review') || name.includes('comment') || name.includes('content') ||
                id.includes('review') || id.includes('comment') || id.includes('content')) {
                const value = textarea.value.trim();
                if (value)
                    return value;
            }
        }
        // Strategy 2: textarea lớn nhất
        let largestTextarea = null;
        let maxLength = 0;
        for (const textarea of textareas) {
            const value = textarea.value.trim();
            if (value.length > maxLength) {
                maxLength = value.length;
                largestTextarea = textarea;
            }
        }
        if (largestTextarea) {
            return largestTextarea.value.trim();
        }
        // Strategy 3: input[type="text"] lớn
        const textInputs = Array.from(container.querySelectorAll('input[type="text"]'));
        for (const input of textInputs) {
            const value = input.value.trim();
            if (value.length > 20) { // Assume review > 20 chars
                return value;
            }
        }
        return '';
    }
    /**
     * Dispatch tracking event
     */
    dispatchEvent(payload, rule, eventId) {
        if (!this.tracker)
            return;
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
//# sourceMappingURL=review-plugin.js.map