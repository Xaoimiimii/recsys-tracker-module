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
            console.log(`[ReviewPlugin] initialized.`);
        }, 'ReviewPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            this.active = true;
            console.log('[ReviewPlugin] Started successfully');
        }, 'ReviewPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            }
            super.stop();
        }, 'ReviewPlugin.stop'); // Using stop/destroy consistency?
    }
    handleSubmit(event) {
        var _a;
        console.log('[ReviewPlugin] handleSubmit called');
        if (!this.tracker)
            return;
        const form = event.target;
        // Trigger ID for Review is typically 3 (or configured)
        const eventId = this.tracker.getEventTypeId('Review') || 3;
        const config = this.tracker.getConfig();
        const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        console.log('[ReviewPlugin] Event ID:', eventId);
        console.log('[ReviewPlugin] Rules found:', reviewRules.length);
        if (reviewRules.length === 0)
            return;
        for (const rule of reviewRules) {
            // 1. Check Target
            if (!this.checkTargetMatch(form, rule))
                continue;
            // 2. Check Condition
            if (!this.checkConditions(form, rule))
                continue;
            console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);
            // 3. Auto-detect review content if needed
            const reviewContent = this.autoDetectReviewContent(form);
            console.log(`[ReviewPlugin] Detected review content: "${reviewContent}"`);
            // 4. Check if rule requires network data
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
            // 4. NEW FLOW: Check if rule requires network data
            if (requiresNetworkData) {
                console.log('[ReviewPlugin] ⏳ Rule requires network data. Starting collection for rule:', rule.id);
                // NEW FLOW: Gọi startCollection với đầy đủ context
                if (this.tracker && this.tracker.payloadBuilder) {
                    const context = {
                        element: form,
                        eventType: 'review',
                        triggerTimestamp: Date.now(),
                        reviewContent: reviewContent
                    };
                    this.tracker.payloadBuilder.startCollection(context, rule, (finalPayload) => {
                        console.log('[ReviewPlugin] ✅ Collection complete, tracking event with payload:', finalPayload);
                        // Track directly with collected payload
                        this.trackWithPayload(finalPayload, rule, eventId);
                    });
                }
                else {
                    console.warn('[ReviewPlugin] Tracker or PayloadBuilder not available');
                }
                return;
            }
            // 5. Không cần network data → Track ngay
            console.log('[ReviewPlugin] No network data required, tracking immediately');
            this.buildAndTrack(form, rule, eventId);
            console.log(`[ReviewPlugin] 📤 Event tracked successfully`);
            return;
        }
    }
    checkTargetMatch(form, rule) {
        const target = rule.targetElement;
        if (!target)
            return false;
        const patternId = Number(target.targetEventPatternId);
        if (patternId !== TARGET_PATTERN_ID.CSS_SELECTOR)
            return false;
        try {
            console.log('[ReviewPlugin] Checking target match against:', target.targetElementValue);
            console.log('[ReviewPlugin] Form classes:', form.className);
            if (form.matches(target.targetElementValue)) {
                console.log('[ReviewPlugin] Strict match success');
                return true;
            }
            // Flexible match: Check if form is inside the target element
            const closest = form.closest(target.targetElementValue);
            console.log('[ReviewPlugin] Flexible match result:', closest);
            return !!closest;
        }
        catch (e) {
            console.error('[ReviewPlugin] Match error:', e);
            return false;
        }
    }
    checkConditions(form, rule) {
        const conditions = rule.conditions;
        if (!conditions || conditions.length === 0)
            return true;
        for (const cond of conditions) {
            const pattern = Number(cond.eventPatternId);
            const operator = Number(cond.operatorId);
            const val = cond.value;
            let actual = null;
            let isMet = false;
            switch (pattern) {
                case CONDITION_PATTERN_ID.URL:
                    actual = location.href;
                    break;
                case CONDITION_PATTERN_ID.CSS_SELECTOR:
                    try {
                        isMet = form.matches(val);
                        actual = isMet ? 'true' : 'false';
                    }
                    catch {
                        return false;
                    }
                    break;
                case CONDITION_PATTERN_ID.DATA_ATTRIBUTE:
                    actual = form.getAttribute(val);
                    break;
            }
            if (pattern === CONDITION_PATTERN_ID.CSS_SELECTOR)
                continue;
            if (!this.compareValues(actual, val, operator))
                return false;
        }
        return true;
    }
    autoDetectReviewContent(form) {
        const formData = new FormData(form);
        let content = '';
        for (const [key, val] of formData) {
            const k = key.toLowerCase();
            const vStr = String(val);
            if (k.includes('review') || k.includes('comment') || k.includes('body') || k.includes('content')) {
                if (vStr.length > content.length)
                    content = vStr;
            }
        }
        return content;
    }
    compareValues(actual, expected, op) {
        if (!actual)
            actual = '';
        if (op === OPERATOR_ID.EQUALS)
            return actual == expected;
        if (op === OPERATOR_ID.CONTAINS)
            return actual.includes(expected);
        if (op === OPERATOR_ID.STARTS_WITH)
            return actual.startsWith(expected);
        if (op === OPERATOR_ID.ENDS_WITH)
            return actual.endsWith(expected);
        return false;
    }
}
//# sourceMappingURL=review-plugin.legacy.js.map