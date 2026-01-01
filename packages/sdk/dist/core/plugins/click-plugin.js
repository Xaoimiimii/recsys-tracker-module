import { BasePlugin } from "./base-plugin";
import { TrackerInit } from "../tracker-init";
import { SelectorMatcher, MatchMode } from "./utils/selector-matcher";
export class ClickPlugin extends BasePlugin {
    constructor(config) {
        super();
        this.name = "click-plugin";
        this.config = config;
    }
    start() {
        const configToUse = this.config || (this.tracker ? this.tracker.getConfig() : null);
        if (!configToUse || !configToUse.trackingRules) {
            console.warn("[ClickPlugin] No tracking rules found. Plugin stopped.");
            return;
        }
        console.log("[ClickPlugin] Started with config:", configToUse.domainUrl);
        document.addEventListener("click", (event) => {
            this.handleDocumentClick(event, configToUse);
        }, true);
    }
    handleDocumentClick(event, config) {
        var _a, _b, _c;
        if (!this.tracker)
            return;
        const rules = config.trackingRules;
        if (!rules || rules.length === 0)
            return;
        const clickRules = rules.filter((r) => r.eventTypeId === 1);
        if (clickRules.length === 0)
            return;
        for (const rule of clickRules) {
            const selector = (_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value;
            if (!selector)
                continue;
            const clickedElement = event.target;
            // Strategy: 
            // 1. Try STRICT match first (element itself must match selector)
            // 2. If no match, try CLOSEST (parent traversal) but ONLY if clicked element is not a button/link
            //    This prevents other interactive elements from accidentally triggering
            let target = SelectorMatcher.match(clickedElement, selector, MatchMode.STRICT);
            if (!target) {
                // Only use CLOSEST matching if clicked element is NOT an interactive element
                const isInteractiveElement = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(clickedElement.tagName) || clickedElement.hasAttribute('role') && ['button', 'link'].includes(clickedElement.getAttribute('role') || '');
                if (!isInteractiveElement) {
                    // Safe to traverse up - probably clicked on icon/text inside button
                    target = SelectorMatcher.match(clickedElement, selector, MatchMode.CLOSEST);
                }
            }
            if (!target)
                continue;
            // Log for debugging
            console.log('[ClickPlugin] ✓ Click matched tracking target:', {
                element: target.className || target.tagName,
                selector: selector,
                rule: rule.name,
                matchedDirectly: clickedElement === target
            });
            if ((_b = rule.conditions) === null || _b === void 0 ? void 0 : _b.length) {
                const conditionsMet = rule.conditions.every((cond) => {
                    if (cond.patternId === 2 && cond.operatorId === 1) {
                        return window.location.href.includes(cond.value);
                    }
                    return true;
                });
                if (!conditionsMet)
                    continue;
            }
            console.log("🎯 [ClickPlugin] Rule matched:", rule.name, "| ID:", rule.id);
            let payload = {};
            if ((_c = rule.payloadMappings) === null || _c === void 0 ? void 0 : _c.length) {
                rule.payloadMappings.forEach((m) => {
                    var _a;
                    if (m.source === "Element" || m.source === "element") {
                        const el = target.querySelector(m.value);
                        if (el) {
                            payload[m.field] = (_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim();
                        }
                        else if (target.hasAttribute(m.value)) {
                            payload[m.field] = target.getAttribute(m.value);
                        }
                    }
                    if (m.source === "LocalStorage") {
                        payload[m.field] = localStorage.getItem(m.value);
                    }
                    if (m.source === "global_variable") {
                        const globalVal = window[m.value];
                        payload[m.field] =
                            typeof globalVal === "function" ? globalVal() : globalVal;
                    }
                });
            }
            console.log("🚀 Payload collected:", payload);
            const userKey = Object.keys(payload).find((k) => k.toLowerCase().includes("user")) ||
                "userId";
            const itemKey = Object.keys(payload).find((k) => k.toLowerCase().includes("item")) ||
                "ItemId";
            const rawData = TrackerInit.handleMapping(rule, target);
            this.tracker.track({
                eventTypeId: rule.eventTypeId,
                trackingRuleId: Number(rule.id),
                userField: userKey,
                userValue: payload[userKey] ||
                    rawData.userId ||
                    TrackerInit.getUsername() ||
                    "guest",
                itemField: itemKey,
                itemValue: payload[itemKey] ||
                    rawData.ItemId ||
                    rawData.ItemTitle ||
                    "Unknown Song",
            });
            break;
        }
    }
}
//# sourceMappingURL=click-plugin.js.map