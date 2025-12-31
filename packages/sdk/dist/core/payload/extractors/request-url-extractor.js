import { PathMatcher } from '../../utils/path-matcher';
export class RequestUrlExtractor {
    constructor() {
        this.history = [];
        this.MAX_HISTORY = 50;
        this.isTrackingActive = false;
    }
    /**
     * Extract data from the most recent matching network request
     */
    extract(mapping, _context) {
        var _a;
        if (!mapping.requestUrlPattern)
            return null;
        // If context provides URL (e.g. NetworkPlugin), check it first?
        // But user said "capture data from request url matching closest after tracking plugins triggered"
        // This likely implies looking at the global history.
        // But if 'context.url' is present, it's the *current* request.
        // We should prioritize the *current* request if it matches?
        // Or strictly look at history?
        // Let's look at history, effectively "most recent".
        const targetMethod = (_a = mapping.requestMethod) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        // Iterate backwards (newest first)
        for (let i = this.history.length - 1; i >= 0; i--) {
            const req = this.history[i];
            // Check Method
            if (targetMethod && req.method !== targetMethod)
                continue;
            // Check Pattern
            // 1. Static segments must match (optimization & requirement)
            if (!PathMatcher.matchStaticSegments(req.url, mapping.requestUrlPattern)) {
                continue;
            }
            // 2. Full match
            if (!PathMatcher.match(req.url, mapping.requestUrlPattern)) {
                continue;
            }
            // Match found! Extract value.
            return this.extractValueFromUrl(req.url, mapping.value);
        }
        return null;
    }
    extractValueFromUrl(url, valueConfig) {
        // User convention: value is the path index.
        // Example: /api/rating/{itemId}/add-review
        // Split: ['api', 'rating', '123', 'add-review']
        // value=2 -> '123'
        const index = typeof valueConfig === 'string' ? parseInt(valueConfig, 10) : valueConfig;
        if (typeof index !== 'number' || isNaN(index))
            return null;
        const path = url.split('?')[0];
        const segments = path.split('/').filter(Boolean); // Remote empty strings
        if (index < 0 || index >= segments.length)
            return null;
        return segments[index];
    }
    /**
     * Enable network tracking
     */
    enableTracking() {
        if (this.isTrackingActive)
            return;
        this.hookXhr();
        this.hookFetch();
        this.isTrackingActive = true;
    }
    /**
     * Disable network tracking
     */
    disableTracking() {
        if (!this.isTrackingActive)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.isTrackingActive = false;
        this.history = [];
    }
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const self = this;
        XMLHttpRequest.prototype.open = function (method, url) {
            // Capture init info
            this._reqUrlArgs = { method, url };
            return self.originalXmlOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (_body) {
            const info = this._reqUrlArgs;
            if (info) {
                // We log the request when it is SENT (closest to trigger time usually)
                // or when it completes?
                // NetworkExtractor handles on 'load'.
                // But we want to capture the URL.
                // If we log on 'send', we capture it immediately.
                // This matches "closest after trigger" if the request starts after trigger?
                // Actually, if we log on 'send', we have it in history.
                self.addToHistory(info.url, info.method);
            }
            return self.originalXmlSend.apply(this, arguments);
        };
    }
    restoreXhr() {
        if (this.originalXmlOpen)
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend)
            XMLHttpRequest.prototype.send = this.originalXmlSend;
    }
    hookFetch() {
        this.originalFetch = window.fetch;
        const self = this;
        window.fetch = async function (...args) {
            var _a;
            const [resource, config] = args;
            let url = '';
            if (typeof resource === 'string') {
                url = resource;
            }
            else if (resource instanceof Request) {
                url = resource.url;
            }
            const method = ((_a = config === null || config === void 0 ? void 0 : config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            // Log immediately
            self.addToHistory(url, method);
            return self.originalFetch.apply(this, args);
        };
    }
    restoreFetch() {
        if (this.originalFetch)
            window.fetch = this.originalFetch;
    }
    addToHistory(url, method) {
        // Normalize method
        const normalizedMethod = (method || 'GET').toUpperCase();
        this.history.push({
            url,
            method: normalizedMethod,
            timestamp: Date.now()
        });
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }
}
//# sourceMappingURL=request-url-extractor.js.map