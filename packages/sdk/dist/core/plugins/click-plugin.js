/**
 * ClickPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi click
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG lấy payload, KHÔNG bắt network
 *
 * FLOW:
 * click event → check rules → handleTrigger → DONE
 */
import { BasePlugin } from './base-plugin';
export class ClickPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ClickPlugin';
        this.handleClickBound = this.handleClick.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log('[ClickPlugin] Initialized');
        }, 'ClickPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            document.addEventListener('click', this.handleClickBound, true);
            this.active = true;
        }, 'ClickPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('click', this.handleClickBound, true);
            }
            super.stop();
        }, 'ClickPlugin.stop');
    }
    /**
     * Handle click event - TRIGGER PHASE
     */
    handleClick(event) {
        var _a;
        if (!this.tracker)
            return;
        const clickedElement = event.target;
        if (!clickedElement)
            return;
        // Get click rules
        const eventId = this.tracker.getEventTypeId('Click') || 1;
        const config = this.tracker.getConfig();
        const clickRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        if (clickRules.length === 0)
            return;
        // Check each rule
        for (const rule of clickRules) {
            const matchedElement = this.findMatchingElement(clickedElement, rule);
            if (!matchedElement) {
                continue;
            }
            // Check conditions
            if (!this.checkConditions(matchedElement, rule)) {
                continue;
            }
            // Create trigger context
            const triggerContext = {
                element: matchedElement,
                target: matchedElement,
                clickedElement: clickedElement,
                eventType: 'click',
                event: event
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
     * Find element matching rule selector
     */
    findMatchingElement(clickedElement, rule) {
        var _a;
        const selector = (_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value;
        if (!selector)
            return null;
        try {
            // Strategy 1: Strict match (element itself)
            if (clickedElement.matches(selector)) {
                return clickedElement;
            }
            // Strategy 2: Flexible class match (for CSS modules)
            if (selector.startsWith('.')) {
                const className = selector.substring(1);
                if (this.hasFlexibleClassMatch(clickedElement, className)) {
                    return clickedElement;
                }
            }
            // Strategy 3: Closest match (parent traversal)
            // Only if clicked element is NOT interactive (avoid false positives)
            const isInteractive = this.isInteractiveElement(clickedElement);
            if (!isInteractive) {
                const closestMatch = clickedElement.closest(selector);
                if (closestMatch) {
                    return closestMatch;
                }
                // Flexible class match on parents
                if (selector.startsWith('.')) {
                    const className = selector.substring(1);
                    const flexibleParent = this.findParentWithFlexibleClass(clickedElement, className);
                    if (flexibleParent) {
                        return flexibleParent;
                    }
                }
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Check if element has flexible class match (for CSS modules)
     */
    hasFlexibleClassMatch(element, baseClassName) {
        const actualClassName = element.className;
        if (typeof actualClassName !== 'string')
            return false;
        // Extract base name (remove hash for CSS modules)
        const baseName = baseClassName.split('_')[0];
        return actualClassName.includes(baseName);
    }
    /**
     * Find parent with flexible class match
     */
    findParentWithFlexibleClass(element, baseClassName) {
        const baseName = baseClassName.split('_')[0];
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 10) {
            const className = parent.className;
            if (typeof className === 'string' && className.includes(baseName)) {
                return parent;
            }
            parent = parent.parentElement;
            depth++;
        }
        return null;
    }
    /**
     * Check if element is interactive (button, link, etc.)
     */
    isInteractiveElement(element) {
        const tagName = element.tagName;
        if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) {
            return true;
        }
        const role = element.getAttribute('role');
        if (role && ['button', 'link', 'menuitem'].includes(role)) {
            return true;
        }
        return false;
    }
    /**
     * Check conditions
     */
    checkConditions(_element, rule) {
        const conditions = rule.conditions;
        if (!conditions || conditions.length === 0) {
            return true;
        }
        for (const cond of conditions) {
            // Pattern ID 2 = URL, Operator ID 1 = CONTAINS
            if (cond.patternId === 2 && cond.operatorId === 1) {
                if (!window.location.href.includes(cond.value)) {
                    return false;
                }
            }
            // Add more condition types as needed
        }
        return true;
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
//# sourceMappingURL=click-plugin.js.map