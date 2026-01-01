/**
 * Selector Matcher Utility
 * Provides strict and loose matching modes for tracking targets
 */
export var MatchMode;
(function (MatchMode) {
    MatchMode["STRICT"] = "strict";
    MatchMode["CLOSEST"] = "closest";
    MatchMode["CONTAINS"] = "contains"; // Element must contain matching child
})(MatchMode || (MatchMode = {}));
export class SelectorMatcher {
    /**
     * Match element against selector with specified mode
     */
    static match(element, selector, mode = MatchMode.CLOSEST) {
        if (!element || !selector)
            return null;
        switch (mode) {
            case MatchMode.STRICT:
                return this.strictMatch(element, selector);
            case MatchMode.CLOSEST:
                return this.closestMatch(element, selector);
            case MatchMode.CONTAINS:
                return this.containsMatch(element, selector);
            default:
                return this.closestMatch(element, selector);
        }
    }
    /**
     * STRICT: Element itself must match selector
     */
    static strictMatch(element, selector) {
        try {
            return element.matches(selector) ? element : null;
        }
        catch (e) {
            console.error('[SelectorMatcher] Invalid selector:', selector);
            return null;
        }
    }
    /**
     * CLOSEST: Element or closest parent must match selector
     */
    static closestMatch(element, selector) {
        try {
            return element.closest(selector);
        }
        catch (e) {
            console.error('[SelectorMatcher] Invalid selector:', selector);
            return null;
        }
    }
    /**
     * CONTAINS: Element must contain a child matching selector
     */
    static containsMatch(element, selector) {
        try {
            const child = element.querySelector(selector);
            return child ? element : null;
        }
        catch (e) {
            console.error('[SelectorMatcher] Invalid selector:', selector);
            return null;
        }
    }
    /**
     * Check if element exactly matches selector (no parent traversal)
     */
    static isExactMatch(element, selector) {
        return this.strictMatch(element, selector) !== null;
    }
}
//# sourceMappingURL=selector-matcher.js.map