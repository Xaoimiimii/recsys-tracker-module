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
            console.log("[ReviewPlugin] started listening for Review submissions.");
            this.active = true;
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
        if (!this.tracker)
            return;
        const form = event.target;
        //console.log(`📝 [ReviewPlugin] Checking form: #${form.id} (Classes: ${form.className})`);
        // Trigger ID for Review is typically 3 (or configured)
        const eventId = this.tracker.getEventTypeId('Review') || 3;
        const config = this.tracker.getConfig();
        const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        console.log(`🔎 [ReviewPlugin] Found ${reviewRules.length} rules for TriggerID=${eventId}`);
        if (reviewRules.length === 0)
            return;
        for (const rule of reviewRules) {
            // 1. Check Target
            if (!this.checkTargetMatch(form, rule))
                continue;
            console.log("🔥 [ReviewPlugin] Detected SUBMIT event!");
            // 2. Check Condition
            if (!this.checkConditions(form, rule))
                continue;
            console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);
            // 3. Auto-detect review content if needed
            const reviewContent = this.autoDetectReviewContent(form);
            console.log(`[ReviewPlugin] Detected review content: "${reviewContent}"`);
            // 4. Build and track using centralized method
            this.buildAndTrack(form, rule, eventId, {
                metadata: {
                    additionalValues: reviewContent,
                    captureMethod: 'form-submit',
                    source: 'review-plugin'
                }
            });
            console.log(`[ReviewPlugin] 📤 Event tracked successfully`);
            return;
        }
        console.log("❌ [ReviewPlugin] No rules matched the current form.");
    }
    checkTargetMatch(form, rule) {
        const target = rule.targetElement;
        if (!target)
            return false;
        const patternId = Number(target.targetEventPatternId);
        if (patternId !== TARGET_PATTERN_ID.CSS_SELECTOR)
            return false;
        try {
            return form.matches(target.targetElementValue);
        }
        catch {
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
//# sourceMappingURL=review-plugin.js.map