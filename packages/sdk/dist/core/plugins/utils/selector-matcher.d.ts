/**
 * Selector Matcher Utility
 * Provides strict and loose matching modes for tracking targets
 */
export declare enum MatchMode {
    STRICT = "strict",// Element must directly match selector
    CLOSEST = "closest",// Element or closest parent must match
    CONTAINS = "contains"
}
export declare class SelectorMatcher {
    /**
     * Match element against selector with specified mode
     */
    static match(element: HTMLElement, selector: string, mode?: MatchMode): HTMLElement | null;
    /**
     * STRICT: Element itself must match selector
     */
    private static strictMatch;
    /**
     * CLOSEST: Element or closest parent must match selector
     */
    private static closestMatch;
    /**
     * CONTAINS: Element must contain a child matching selector
     */
    private static containsMatch;
    /**
     * Check if element exactly matches selector (no parent traversal)
     */
    static isExactMatch(element: HTMLElement, selector: string): boolean;
}
//# sourceMappingURL=selector-matcher.d.ts.map