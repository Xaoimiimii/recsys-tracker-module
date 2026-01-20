export declare class PathMatcher {
    /**
     * Parse pattern like '/api/user/:id' or '/api/cart/{itemId}' into regex and segment config
     * Supports flexible patterns:
     * - "/api/product/:id/details" or "/api/product/{id}/details"
     * - "api/product/:id/details" (without leading slash)
     * - "product/:id" (partial path)
     */
    static compile(pattern: string): {
        regex: RegExp;
        keys: string[];
    };
    /**
     * Match URL against pattern with flexible matching
     * Supports:
     * - Full path matching: "/api/product/:id/details" matches "/api/product/123/details"
     * - Partial path matching: "product/:id" matches "/api/product/123/details"
     * - Pattern with or without leading slash
     *
     * @param url - Full URL or path to match
     * @param pattern - Pattern to match against (can be partial)
     * @returns true if URL matches pattern
     */
    static match(url: string, pattern: string): boolean;
    /**
     * Match partial path segments
     * Example: "product/:id" matches "/api/product/123/details"
     */
    private static matchPartialPath;
    /**
     * Check if a path segment matches a pattern segment
     * Pattern segment can be:
     * - Literal: "product" matches "product"
     * - Dynamic: ":id" or "{id}" matches any non-empty value
     */
    private static segmentMatches;
    /**
     * Extract dynamic values from URL based on pattern
     * Example: extractParams("/api/product/123/details", "/api/product/:id/details")
     * Returns: { id: "123" }
     */
    static extractParams(url: string, pattern: string): Record<string, string>;
    /**
     * Extract value by segment index from URL
     * @param url - URL to extract from
     * @param pattern - Pattern to match (must match first)
     * @param segmentIndex - 0-based index of segment to extract
     */
    static extractByIndex(url: string, pattern: string, segmentIndex: number): string | null;
    static matchStaticSegments(url: string, pattern: string): boolean;
}
//# sourceMappingURL=path-matcher.d.ts.map