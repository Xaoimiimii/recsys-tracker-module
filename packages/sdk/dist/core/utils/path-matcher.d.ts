export declare class PathMatcher {
    /**
     * Parse pattern like '/api/user/:id' or '/api/cart/{itemId}' into regex and segment config
     */
    static compile(pattern: string): {
        regex: RegExp;
        keys: string[];
    };
    static match(url: string, pattern: string): boolean;
    static matchStaticSegments(url: string, pattern: string): boolean;
}
//# sourceMappingURL=path-matcher.d.ts.map