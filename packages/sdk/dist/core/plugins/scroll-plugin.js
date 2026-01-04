import { BasePlugin } from './base-plugin';
// CONDITION PATTERNS
const CONDITION_PATTERN = { CSS_SELECTOR: 1, URL: 2, DATA_ATTRIBUTE: 3 };
// OPERATORS
const TARGET_OPERATOR = { CONTAINS: 1, EQUALS: 2, STARTS_WITH: 3, ENDS_WITH: 4 };
export class ScrollPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ScrollPlugin';
        // --- STATE MANAGEMENT ---
        this.milestones = [25, 50, 75, 100];
        this.sentMilestones = new Set();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = true;
        this.currentItemContext = null;
        this.activeRule = null;
        this.targetScrollElement = null;
        this.lastScrollProcessTime = 0;
        this.THROTTLE_MS = 200;
        this.handleScrollBound = this.handleScroll.bind(this);
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        this.handleUnloadBound = this.handleUnload.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[ScrollPlugin] initialized.`);
        }, 'ScrollPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            this.resetState();
            const isResolved = this.resolveContextFromRules();
            if (isResolved) {
                const target = this.targetScrollElement || window;
                target.addEventListener('scroll', this.handleScrollBound, { passive: true });
                document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
                window.addEventListener('beforeunload', this.handleUnloadBound);
                console.log(`[ScrollPlugin] Started. Target:`, this.targetScrollElement ? 'Specific Element' : 'Window');
                this.active = true;
            }
            else {
                console.log(`[ScrollPlugin] No matching rule found for this page. Idle.`);
            }
        }, 'ScrollPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            const target = this.targetScrollElement || window;
            target.removeEventListener('scroll', this.handleScrollBound);
            document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
            window.removeEventListener('beforeunload', this.handleUnloadBound);
            super.stop();
        }, 'ScrollPlugin.stop');
    }
    resetState() {
        this.sentMilestones.clear();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = document.visibilityState === 'visible';
        this.currentItemContext = null;
        this.activeRule = null;
        this.targetScrollElement = null;
    }
    resolveContextFromRules() {
        var _a;
        if (!this.tracker)
            return false;
        const eventId = this.tracker.getEventTypeId('Scroll') || 4;
        const config = this.tracker.getConfig();
        const scrollRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        if (scrollRules.length === 0)
            return false;
        console.log(`📜 [ScrollPlugin] Checking ${scrollRules.length} rules...`);
        for (const rule of scrollRules) {
            const element = this.findTargetElement(rule);
            if (element) {
                const representativeEl = (element instanceof Window) ? document.body : element;
                if (this.checkConditions(representativeEl, rule)) {
                    this.activeRule = rule;
                    this.targetScrollElement = (element instanceof Window) ? null : element;
                    console.log(`✅ [ScrollPlugin] Rule Matched: "${rule.name}"`);
                    this.detectContextForItem(representativeEl);
                    return true;
                }
            }
        }
        return false;
    }
    findTargetElement(rule) {
        const target = rule.targetElement || rule.TargetElement;
        if (!target || !target.targetElementValue || target.targetElementValue === 'document' || target.targetElementValue === 'window') {
            return window;
        }
        const selector = target.targetElementValue || target.Value;
        try {
            const el = document.querySelector(selector);
            return el;
        }
        catch {
            return null;
        }
    }
    detectContextForItem(element) {
        console.log("🔍 [ScrollPlugin] Scanning for context...");
        const contextInfo = this.scanSurroundingContext(element);
        if (contextInfo.id) {
            this.currentItemContext = {
                id: contextInfo.id,
                name: contextInfo.name || 'Unknown Item',
                type: contextInfo.type || 'item',
                confidence: 1,
                source: contextInfo.source,
                context: 'dom_context'
            };
        }
        else {
            this.currentItemContext = this.createSyntheticItem();
        }
        console.log("🎯 [ScrollPlugin] Resolved Context:", this.currentItemContext);
    }
    checkConditions(element, rule) {
        const conditions = rule.Conditions || rule.conditions;
        if (!conditions || conditions.length === 0)
            return true;
        for (const condition of conditions) {
            const patternId = condition.EventPatternID || condition.eventPatternId || 1;
            const operatorId = condition.OperatorID || condition.operatorId || 5;
            const expectedValue = condition.Value || condition.value || '';
            let actualValue = null;
            let isMet = false;
            switch (patternId) {
                case CONDITION_PATTERN.URL:
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has(expectedValue))
                        actualValue = urlParams.get(expectedValue);
                    else
                        actualValue = window.location.href;
                    break;
                case CONDITION_PATTERN.CSS_SELECTOR:
                    try {
                        isMet = element.matches(expectedValue);
                        if (!isMet)
                            return false;
                        continue;
                    }
                    catch {
                        return false;
                    }
                case CONDITION_PATTERN.DATA_ATTRIBUTE:
                    actualValue = element.getAttribute(expectedValue);
                    break;
                default: actualValue = '';
            }
            isMet = this.compareValues(actualValue, expectedValue, operatorId);
            if (!isMet)
                return false;
        }
        return true;
    }
    compareValues(actual, expected, operatorId) {
        if (actual === null)
            actual = '';
        switch (operatorId) {
            case TARGET_OPERATOR.EQUALS: return actual === expected;
            case TARGET_OPERATOR.CONTAINS: return actual.includes(expected);
            case TARGET_OPERATOR.STARTS_WITH: return actual.startsWith(expected);
            case TARGET_OPERATOR.ENDS_WITH: return actual.endsWith(expected);
            default: return actual === expected;
        }
    }
    scanSurroundingContext(element) {
        const getAttrs = (el) => {
            if (!el)
                return null;
            const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
            if (id)
                return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
            return null;
        };
        const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
        const ancestorData = getAttrs(ancestor);
        if (ancestorData)
            return { ...ancestorData, source: 'ancestor' };
        let currentParent = element.parentElement;
        let levels = 0;
        while (currentParent && levels < 5) {
            const candidates = currentParent.querySelectorAll('[data-item-id], [data-product-id], [data-id]');
            if (candidates.length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    if (!element.contains(candidate)) {
                        const data = getAttrs(candidate);
                        if (data)
                            return { ...data, source: `scope_level_${levels + 1}` };
                    }
                }
            }
            currentParent = currentParent.parentElement;
            levels++;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('productId');
        if (urlId)
            return { id: urlId, source: 'url_param' };
        return { id: undefined, source: 'none' };
    }
    handleScroll() {
        const now = Date.now();
        if (now - this.lastScrollProcessTime < this.THROTTLE_MS)
            return;
        this.lastScrollProcessTime = now;
        let scrollTop, docHeight, clientHeight;
        if (this.targetScrollElement instanceof HTMLElement) {
            scrollTop = this.targetScrollElement.scrollTop;
            docHeight = this.targetScrollElement.scrollHeight;
            clientHeight = this.targetScrollElement.clientHeight;
        }
        else {
            scrollTop = window.scrollY || document.documentElement.scrollTop;
            docHeight = document.documentElement.scrollHeight;
            clientHeight = window.innerHeight;
        }
        const currentPercent = Math.min(100, Math.round(((scrollTop + clientHeight) / docHeight) * 100));
        if (currentPercent > this.maxScrollDepth)
            this.maxScrollDepth = currentPercent;
        this.milestones.forEach(milestone => {
            if (currentPercent >= milestone && !this.sentMilestones.has(milestone)) {
                this.sendScrollEvent(milestone);
                this.sentMilestones.add(milestone);
            }
        });
    }
    sendScrollEvent(depth) {
        var _a;
        if (!this.tracker)
            return;
        const rule = this.activeRule || this.createDefaultRule('default-scroll', 'Default Scroll');
        const currentActiveSeconds = this.calculateActiveTime();
        // Extract via PayloadBuilder
        const extracted = this.tracker.payloadBuilder.build(this.currentItemContext, rule);
        // Build Payload
        const payload = {
            eventTypeId: rule.eventTypeId || 4, // Default Scroll ID
            trackingRuleId: rule.id,
            userField: 'userId',
            userValue: extracted['userId'] || extracted['User'] || '',
            itemField: 'itemId',
            itemValue: extracted['itemId'] || extracted['Item'] || ((_a = this.currentItemContext) === null || _a === void 0 ? void 0 : _a.id) || 'N/A',
            // Metadata
            metadata: {
                depth_percentage: depth,
                time_on_page: currentActiveSeconds,
                url: window.location.href,
                ...extracted // Merge extracted
            }
        };
        this.tracker.track(payload);
    }
    handleUnload() {
        var _a;
        if (!this.tracker)
            return;
        if (this.isTabVisible)
            this.totalActiveTime += Date.now() - this.startTime;
        const finalTime = parseFloat((this.totalActiveTime / 1000).toFixed(1));
        if (finalTime < 1)
            return;
        const rule = this.activeRule || this.createDefaultRule('summary', 'Page Summary');
        if (!this.currentItemContext)
            this.currentItemContext = this.createSyntheticItem();
        // Extract
        const extracted = this.tracker.payloadBuilder.build(this.currentItemContext, rule);
        const payload = {
            eventTypeId: rule.eventTypeId || 4,
            trackingRuleId: rule.id,
            userField: 'userId',
            userValue: extracted['userId'] || '',
            itemField: 'itemId',
            itemValue: extracted['itemId'] || ((_a = this.currentItemContext) === null || _a === void 0 ? void 0 : _a.id) || 'N/A',
            metadata: {
                max_scroll_depth: this.maxScrollDepth,
                total_time_on_page: finalTime,
                is_bounce: this.maxScrollDepth < 25 && finalTime < 5,
                event: 'page_summary'
            }
        };
        this.tracker.track(payload);
    }
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.totalActiveTime += Date.now() - this.startTime;
            this.isTabVisible = false;
        }
        else {
            this.startTime = Date.now();
            this.isTabVisible = true;
        }
    }
    calculateActiveTime() {
        let currentSessionTime = 0;
        if (this.isTabVisible)
            currentSessionTime = Date.now() - this.startTime;
        const totalMs = this.totalActiveTime + currentSessionTime;
        return parseFloat((totalMs / 1000).toFixed(1));
    }
    createSyntheticItem() {
        return {
            id: 'page_scroll_' + Date.now(),
            name: document.title || 'General Page',
            type: 'page_view',
            confidence: 1,
            source: 'synthetic_page'
        };
    }
    createDefaultRule(id, name) {
        return {
            id, name, eventTypeId: 4,
            targetElement: { targetElementValue: 'document', targetEventPatternId: 1, targetOperatorId: 5 },
            conditions: [], payloadMappings: [] // Empty mappings
        };
    }
}
//# sourceMappingURL=scroll-plugin.js.map