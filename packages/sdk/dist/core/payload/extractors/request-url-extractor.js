import { PathMatcher } from '../../utils/path-matcher';
export class RequestUrlExtractor {
    constructor() {
        this.history = [];
        this.MAX_HISTORY = 50;
        this.isTrackingActive = false;
        this.payloadBuilder = null; // Reference to PayloadBuilder
    }
    /**
     * NEW: Set reference to PayloadBuilder
     */
    setPayloadBuilder(builder) {
        this.payloadBuilder = builder;
    }
    /**
     * NEW FLOW: Extract data from the most recent matching network request
     * Chỉ tìm requests xảy ra SAU trigger trong window 5s
     */
    extract(mapping, _context) {
        var _a, _b, _c;
        console.log('[RequestUrlExtractor] Extracting with mapping:', {
            field: mapping.field,
            pattern: mapping.requestUrlPattern,
            method: mapping.requestMethod,
            value: mapping.value
        });
        console.log('[RequestUrlExtractor] History size:', this.history.length);
        console.log('[RequestUrlExtractor] Context:', _context);
        if (!mapping.requestUrlPattern) {
            console.warn('[RequestUrlExtractor] No requestUrlPattern');
            return null;
        }
        const targetMethod = (_a = mapping.requestMethod) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        // NEW: Lấy trigger timestamp từ context
        const triggerTime = (_context === null || _context === void 0 ? void 0 : _context.triggerTimestamp) || 0;
        console.log('[RequestUrlExtractor] Trigger timestamp:', triggerTime);
        // 1. Check strict context first (e.g. from NetworkPlugin)
        if (_context && _context.url) {
            console.log('[RequestUrlExtractor] Checking context URL:', _context.url);
            const ctxUrl = _context.url;
            const ctxMethod = (_b = _context.method) === null || _b === void 0 ? void 0 : _b.toUpperCase();
            let methodMatch = true;
            if (targetMethod && ctxMethod && ctxMethod !== targetMethod) {
                console.log('[RequestUrlExtractor] Method mismatch:', ctxMethod, 'vs', targetMethod);
                methodMatch = false;
            }
            if (methodMatch) {
                const patternMatch = PathMatcher.match(ctxUrl, mapping.requestUrlPattern);
                console.log('[RequestUrlExtractor] Pattern match result:', patternMatch);
                if (patternMatch) {
                    const extracted = this.extractValueFromUrl(ctxUrl, mapping.value);
                    console.log('[RequestUrlExtractor] Extracted from context:', extracted);
                    return extracted;
                }
            }
        }
        // 2. Fallback to history - CHỈ LẤY REQUESTS SAU TRIGGER
        console.log('[RequestUrlExtractor] Checking history...');
        // Iterate backwards (newest first)
        for (let i = this.history.length - 1; i >= 0; i--) {
            const req = this.history[i];
            console.log('[RequestUrlExtractor] Checking history entry:', req);
            // NEW: Check timestamp - Request phải xảy ra SAU trigger
            if (triggerTime > 0) {
                if (req.timestamp < triggerTime) {
                    console.log('[RequestUrlExtractor] Request before trigger, skipping');
                    continue;
                }
                // Check timeout - Không quá 5s sau trigger
                if (req.timestamp - triggerTime > 5000) {
                    console.log('[RequestUrlExtractor] Request too late (>5s after trigger), skipping');
                    continue;
                }
                console.log('[RequestUrlExtractor] Request within window:', req.timestamp - triggerTime, 'ms after trigger');
            }
            // Check Method
            if (targetMethod && req.method !== targetMethod) {
                console.log('[RequestUrlExtractor] Method mismatch in history');
                continue;
            }
            // Check Pattern
            // 1. Static segments must match (optimization & requirement)
            if (!PathMatcher.matchStaticSegments(req.url, mapping.requestUrlPattern)) {
                console.log('[RequestUrlExtractor] Static segments mismatch');
                continue;
            }
            // 2. Full match
            if (!PathMatcher.match(req.url, mapping.requestUrlPattern)) {
                console.log('[RequestUrlExtractor] Full pattern mismatch');
                continue;
            }
            // ✅ Match found! Extract value.
            const extracted = this.extractValueFromUrl(req.url, mapping.value);
            console.log('[RequestUrlExtractor] ✅ Extracted from history:', extracted, 'from URL:', req.url);
            // NEW: Notify PayloadBuilder về data mới (nếu được set)
            if (this.payloadBuilder && this.payloadBuilder.pendingCollections) {
                // Tìm pending collection phù hợp
                for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
                    // Check xem mapping này có thuộc rule này không
                    const belongsToRule = (_c = pending.rule.payloadMappings) === null || _c === void 0 ? void 0 : _c.some((m) => m.field === mapping.field &&
                        m.requestUrlPattern === mapping.requestUrlPattern);
                    if (belongsToRule) {
                        console.log('[RequestUrlExtractor] Notifying PayloadBuilder for rule:', ruleId);
                        this.payloadBuilder.notifyNetworkData(ruleId, mapping.field, extracted);
                        break;
                    }
                }
            }
            return extracted;
        }
        console.warn('[RequestUrlExtractor] No match found');
        return null;
    }
    extractValueFromUrl(url, valueConfig) {
        // User convention: value is the path index.
        // Example: /api/rating/{itemId}/add-review
        // Split: ['api', 'rating', '123', 'add-review']
        // value=2 -> '123'
        console.log('[RequestUrlExtractor.extractValueFromUrl] URL:', url, 'valueConfig:', valueConfig);
        const index = typeof valueConfig === 'string' ? parseInt(valueConfig, 10) : valueConfig;
        if (typeof index !== 'number' || isNaN(index)) {
            console.warn('[RequestUrlExtractor] Invalid index:', index);
            return null;
        }
        const path = url.split('?')[0];
        const segments = path.split('/').filter(Boolean); // Remote empty strings
        console.log('[RequestUrlExtractor.extractValueFromUrl] Segments:', segments, 'index:', index);
        if (index < 0 || index >= segments.length) {
            console.warn('[RequestUrlExtractor] Index out of range:', index, 'segments length:', segments.length);
            return null;
        }
        const result = segments[index];
        console.log('[RequestUrlExtractor.extractValueFromUrl] Result:', result);
        return result;
    }
    /**
     * Enable network tracking
     */
    enableTracking() {
        if (this.isTrackingActive) {
            console.log('[RequestUrlExtractor] Already tracking');
            return;
        }
        this.hookXhr();
        this.hookFetch();
        this.isTrackingActive = true;
        console.log('[RequestUrlExtractor] ✅ Tracking enabled - will capture network requests');
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
        console.log('[RequestUrlExtractor] 📝 Captured request:', normalizedMethod, url, '| History size:', this.history.length);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }
}
//# sourceMappingURL=request-url-extractor.js.map