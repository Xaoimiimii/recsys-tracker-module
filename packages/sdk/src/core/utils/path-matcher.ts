export class PathMatcher {
    /**
     * Parse pattern like '/api/user/:id' or '/api/cart/{itemId}' into regex and segment config
     * Supports flexible patterns:
     * - "/api/product/:id/details" or "/api/product/{id}/details"
     * - "api/product/:id/details" (without leading slash)
     * - "product/:id" (partial path)
     */
    static compile(pattern: string): { regex: RegExp; keys: string[] } {
        const keys: string[] = [];
        const cleanPattern = pattern.split('?')[0];

        // Escape generic regex chars except ':' and '{' and '}'
        const escaped = cleanPattern.replace(/[.+^$|()\\[\]]/g, '\\$&');

        // Replace :param or {param} with capture group
        // Regex explanation:
        // :([a-zA-Z0-9_]+)   -> matches :id
        // \{([a-zA-Z0-9_]+)\} -> matches {id}
        const regexString = escaped.replace(/:([a-zA-Z0-9_]+)|\{([a-zA-Z0-9_]+)\}/g, (_match, p1, p2) => {
            const key = p1 || p2;
            keys.push(key);
            return '([^/]+)';
        });

        // Match start to end, allow query params at end
        return {
            regex: new RegExp(`^${regexString}(?:\\?.*)?$`),
            keys
        };
    }

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
    static match(url: string, pattern: string): boolean {
        // Normalize Path from URL
        let path = url.split('?')[0];
        try {
            if (path.startsWith('http')) {
                const urlObj = new URL(path);
                path = urlObj.pathname;
            }
        } catch { }

        // Ensure path starts with /
        if (!path.startsWith('/')) path = '/' + path;

        // Normalize pattern
        let effectivePattern = pattern.trim();
        
        // If pattern doesn't start with http or /, prepend /
        if (!effectivePattern.startsWith('http') && !effectivePattern.startsWith('/')) {
            effectivePattern = '/' + effectivePattern;
        }

        // Try exact match first
        const { regex } = PathMatcher.compile(effectivePattern);
        if (regex.test(path)) {
            return true;
        }

        // Try partial match - check if pattern segments exist in path
        // This allows "product/:id" to match "/api/product/123/details"
        return PathMatcher.matchPartialPath(path, effectivePattern);
    }

    /**
     * Match partial path segments
     * Example: "product/:id" matches "/api/product/123/details"
     */
    private static matchPartialPath(path: string, pattern: string): boolean {
        const pathSegments = path.split('/').filter(Boolean);
        const patternSegments = pattern.split('/').filter(Boolean);

        // Pattern must have at least one segment
        if (patternSegments.length === 0) {
            return false;
        }

        // Find if pattern segments exist as a subsequence in path
        let patternIdx = 0;
        let pathIdx = 0;

        while (pathIdx < pathSegments.length && patternIdx < patternSegments.length) {
            const patternSeg = patternSegments[patternIdx];
            const pathSeg = pathSegments[pathIdx];

            // Check if segment matches (literal or dynamic)
            if (this.segmentMatches(pathSeg, patternSeg)) {
                patternIdx++;
            }

            pathIdx++;
        }

        // All pattern segments found in path
        return patternIdx === patternSegments.length;
    }

    /**
     * Check if a path segment matches a pattern segment
     * Pattern segment can be:
     * - Literal: "product" matches "product"
     * - Dynamic: ":id" or "{id}" matches any non-empty value
     */
    private static segmentMatches(pathSegment: string, patternSegment: string): boolean {
        // Dynamic segment - matches anything
        if (patternSegment.startsWith(':') || 
            (patternSegment.startsWith('{') && patternSegment.endsWith('}'))) {
            return pathSegment.length > 0;
        }

        // Literal segment - must match exactly
        return pathSegment === patternSegment;
    }

    /**
     * Extract dynamic values from URL based on pattern
     * Example: extractParams("/api/product/123/details", "/api/product/:id/details")
     * Returns: { id: "123" }
     */
    static extractParams(url: string, pattern: string): Record<string, string> {
        let path = url.split('?')[0];
        try {
            if (path.startsWith('http')) {
                const urlObj = new URL(path);
                path = urlObj.pathname;
            }
        } catch { }

        if (!path.startsWith('/')) path = '/' + path;

        let effectivePattern = pattern.trim();
        if (!effectivePattern.startsWith('http') && !effectivePattern.startsWith('/')) {
            effectivePattern = '/' + effectivePattern;
        }

        const { regex, keys } = PathMatcher.compile(effectivePattern);
        const match = path.match(regex);

        if (!match) {
            return {};
        }

        const params: Record<string, string> = {};
        keys.forEach((key, index) => {
            params[key] = match[index + 1];
        });

        return params;
    }

    /**
     * Extract value by segment index from URL
     * @param url - URL to extract from
     * @param pattern - Pattern to match (must match first)
     * @param segmentIndex - 0-based index of segment to extract
     */
    static extractByIndex(url: string, pattern: string, segmentIndex: number): string | null {
        if (!PathMatcher.match(url, pattern)) {
            return null;
        }

        let path = url.split('?')[0];
        try {
            if (path.startsWith('http')) {
                const urlObj = new URL(path);
                path = urlObj.pathname;
            }
        } catch { }

        const segments = path.split('/').filter(Boolean);
        return segments[segmentIndex] || null;
    }

    // Logic specifically from tracker.js (optional, but robust)
    static matchStaticSegments(url: string, pattern: string): boolean {
        // tracker.js logic:
        // const segments = rule.apiUrl.split('/').filter(Boolean);
        // _staticSegments: segments.filter(seg => !seg.startsWith(':'))
        // return rule._staticSegments.every(seg => segments.includes(seg));

        const patternSegments = pattern.split('/').filter(Boolean);
        // Filter out dynamic segments (:param or {param})
        const staticSegments = patternSegments.filter(s =>
            !s.startsWith(':') && !(s.startsWith('{') && s.endsWith('}'))
        );

        const urlSegments = url.split('?')[0].split('/').filter(Boolean);

        return staticSegments.every(seg => urlSegments.includes(seg));
    }
}
