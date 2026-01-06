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
const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };
const CONDITION_PATTERN_ID = { CSS_SELECTOR: 1, URL: 2, DATA_ATTRIBUTE: 3 };
const OPERATOR_ID = { CONTAINS: 1, EQUALS: 2, STARTS_WITH: 3, ENDS_WITH: 4 };
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
            console.log('[ReviewPlugin] ✅ Started');
        }, 'ReviewPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            }
            super.stop();
            console.log('[ReviewPlugin] Stopped');
        }, 'ReviewPlugin.stop');
    }
    /**
     * Handle submit event - TRIGGER PHASE
     */
    handleSubmit(event) {
        var _a;
        if (!this.tracker)
            return;
        const form = event.target;
        if (!form)
            return;
        // Get review rules
        const eventId = this.tracker.getEventTypeId('Review') || 3;
        const config = this.tracker.getConfig();
        const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        if (reviewRules.length === 0)
            return;
        console.log(`[ReviewPlugin] 📝 Submit detected, checking ${reviewRules.length} rules`);
        // Check each rule
        for (const rule of reviewRules) {
            if (!this.matchesRule(form, rule)) {
                continue;
            }
            console.log(`[ReviewPlugin] ✅ Matched rule: "${rule.name}"`);
            // Auto-detect review content
            const reviewContent = this.autoDetectReviewContent(form);
            // Create trigger context
            const triggerContext = {
                element: form,
                target: form,
                eventType: 'review',
                reviewContent: reviewContent,
                form: form
            };
            // Delegate to PayloadBuilder
            this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                // Callback khi payload ready
                this.dispatchEvent(payload, rule, eventId);
            });
            // Chỉ track rule đầu tiên match
            return;
        }
    }
    /**
     * Check if form matches rule
     */
    matchesRule(form, rule) {
        // Check target
        if (!this.checkTargetMatch(form, rule)) {
            return false;
        }
        // Check conditions
        if (!this.checkConditions(form, rule)) {
            return false;
        }
        return true;
    }
    /**
     * Check target match
     */
    checkTargetMatch(form, rule) {
        const target = rule.trackingTarget;
        if (!target)
            return false;
        const patternId = Number(target.patternId);
        if (patternId !== TARGET_PATTERN_ID.CSS_SELECTOR) {
            return false;
        }
        const selector = target.value;
        if (!selector)
            return false;
        try {
            // Strict match
            if (form.matches(selector)) {
                return true;
            }
            // Flexible match - form inside target
            const closest = form.closest(selector);
            return !!closest;
        }
        catch (e) {
            console.error('[ReviewPlugin] Selector error:', e);
            return false;
        }
    }
    /**
     * Check conditions
     */
    checkConditions(form, rule) {
        const conditions = rule.conditions;
        if (!conditions || conditions.length === 0) {
            return true;
        }
        for (const cond of conditions) {
            if (!this.checkCondition(form, cond)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Check single condition
     */
    checkCondition(form, condition) {
        const patternId = Number(condition.patternId);
        const operatorId = Number(condition.operatorId);
        const value = condition.value;
        switch (patternId) {
            case CONDITION_PATTERN_ID.URL:
                return this.checkUrlCondition(operatorId, value);
            case CONDITION_PATTERN_ID.CSS_SELECTOR:
                return this.checkSelectorCondition(form, operatorId, value);
            case CONDITION_PATTERN_ID.DATA_ATTRIBUTE:
                return this.checkDataAttributeCondition(form, operatorId, value);
            default:
                return true;
        }
    }
    /**
     * Check URL condition
     */
    checkUrlCondition(operatorId, value) {
        const url = window.location.href;
        switch (operatorId) {
            case OPERATOR_ID.CONTAINS:
                return url.includes(value);
            case OPERATOR_ID.EQUALS:
                return url === value;
            case OPERATOR_ID.STARTS_WITH:
                return url.startsWith(value);
            case OPERATOR_ID.ENDS_WITH:
                return url.endsWith(value);
            default:
                return false;
        }
    }
    /**
     * Check selector condition
     */
    checkSelectorCondition(form, _operatorId, value) {
        try {
            const element = form.querySelector(value);
            return !!element; // Exists or not
        }
        catch {
            return false;
        }
    }
    /**
     * Check data attribute condition
     */
    checkDataAttributeCondition(form, operatorId, value) {
        const [attrName, expectedValue] = value.split('=');
        const actualValue = form.getAttribute(attrName);
        if (!actualValue)
            return false;
        switch (operatorId) {
            case OPERATOR_ID.CONTAINS:
                return actualValue.includes(expectedValue);
            case OPERATOR_ID.EQUALS:
                return actualValue === expectedValue;
            default:
                return false;
        }
    }
    /**
     * Auto-detect review content from form
     */
    autoDetectReviewContent(form) {
        var _a, _b;
        // Strategy 1: textarea với name/id có 'review', 'comment', 'content'
        const textareas = Array.from(form.querySelectorAll('textarea'));
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
        const textInputs = Array.from(form.querySelectorAll('input[type="text"]'));
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
        console.log('[ReviewPlugin] 📤 Dispatching event with payload:', payload);
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