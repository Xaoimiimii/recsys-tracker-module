export class PathMatcher {
    /**
     * Parse pattern like '/api/user/:id' into regex and segment config
     */
    static compile(pattern: string): { regex: RegExp; keys: string[] } {
        const keys: string[] = [];
        const cleanPattern = pattern.split('?')[0];

        // Escape generic regex chars except ':'
        const escaped = cleanPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        // Replace :param with capture group
        const regexString = escaped.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
            keys.push(key);
            return '([^/]+)';
        });

        // Match start to end, allow query params at end
        return {
            regex: new RegExp(`^${regexString}(?:\\?.*)?$`),
            keys
        };
    }

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

        // Compile Pattern
        // If pattern is not absolute URL, ensure it starts with / for consistency with path
        let effectivePattern = pattern;
        if (!effectivePattern.startsWith('http') && !effectivePattern.startsWith('/')) {
            effectivePattern = '/' + effectivePattern;
        }

        const { regex } = PathMatcher.compile(effectivePattern);
        return regex.test(path);
    }

    // Logic specifically from tracker.js (optional, but robust)
    static matchStaticSegments(url: string, pattern: string): boolean {
        // tracker.js logic:
        // const segments = rule.apiUrl.split('/').filter(Boolean);
        // _staticSegments: segments.filter(seg => !seg.startsWith(':'))
        // return rule._staticSegments.every(seg => segments.includes(seg));

        const patternSegments = pattern.split('/').filter(Boolean);
        const staticSegments = patternSegments.filter(s => !s.startsWith(':'));

        const urlSegments = url.split('?')[0].split('/').filter(Boolean);

        return staticSegments.every(seg => urlSegments.includes(seg));
    }
}
