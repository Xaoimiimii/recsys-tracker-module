import { PathMatcher } from '../../utils/path-matcher';
/**
 * NetworkExtractor handles:
 * 1. Extracting data from network request/response (extract method)
 * 2. Network tracking via XHR/Fetch hooking (enableTracking/disableTracking)
 * 3. Matching network requests against rules and dispatching events
 */
export class NetworkExtractor {
    constructor() {
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
     * Extract data from network request/response based on mapping
     * This is called by PayloadBuilder when processing network_request mappings
     */
    extract(mapping, context) {
        var _a, _b;
        if (!context)
            return null;
        // Check if mapping matches context URL (basic validation)
        if (mapping.requestUrlPattern && context.url) {
            if (!this.matchesUrl(context.url, mapping.requestUrlPattern)) {
                return null;
            }
        }
        const source = (mapping.source || '').toLowerCase();
        const path = mapping.value || mapping.requestBodyPath; // Backward compat or direct value
        if (!path) {
            return null;
        }
        if (source === 'requestbody' || source === 'request_body') {
            let result = this.traverseObject(context.reqBody, path);
            // Fallback: If GET request has no request body, try response body
            if (!this.isValid(result) && ((_a = context.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'GET') {
                result = this.traverseObject(context.resBody, path);
            }
            return result;
        }
        if (source === 'responsebody' || source === 'response_body') {
            const result = this.traverseObject(context.resBody, path);
            return result;
        }
        if (source === 'network_request') {
            // Smart inference based on HTTP method
            const method = (_b = context.method) === null || _b === void 0 ? void 0 : _b.toUpperCase();
            if (method === 'GET') {
                // For GET requests, data typically comes from response
                return this.traverseObject(context.resBody, path);
            }
            else {
                // For POST/PUT/PATCH, try request first, then fallback to response
                let val = this.traverseObject(context.reqBody, path);
                if (this.isValid(val))
                    return val;
                val = this.traverseObject(context.resBody, path);
                if (this.isValid(val))
                    return val;
            }
        }
        return null;
    }
    /**
     * Enable network tracking by hooking into XHR and Fetch APIs
     */
    enableTracking(_config, onMatch) {
        if (this.isTrackingActive) {
            console.warn('[NetworkExtractor] Network tracking is already active');
            return;
        }
        this.onNetworkMatchCallback = onMatch;
        this.hookXhr();
        this.hookFetch();
        this.isTrackingActive = true;
        console.log('[NetworkExtractor] Network tracking enabled');
    }
    /**
     * Disable network tracking and restore original XHR/Fetch
     */
    disableTracking() {
        if (!this.isTrackingActive)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.isTrackingActive = false;
        this.onNetworkMatchCallback = undefined;
        console.log('[NetworkExtractor] Network tracking disabled');
    }
    /**
     * Check if network tracking is currently active
     */
    isTracking() {
        return this.isTrackingActive;
    }
    // --- XHR HOOKING ---
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const extractor = this;
        // Hook open() to capture method and URL
        XMLHttpRequest.prototype.open = function (method, url) {
            this._networkTrackInfo = {
                method,
                url,
                startTime: Date.now()
            };
            return extractor.originalXmlOpen.apply(this, arguments);
        };
        // Hook send() to capture request body and response
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkTrackInfo;
            if (info) {
                this.addEventListener('load', () => {
                    extractor.handleNetworkRequest(info.url, info.method, body, this.response);
                });
            }
            return extractor.originalXmlSend.apply(this, arguments);
        };
    }
    restoreXhr() {
        if (this.originalXmlOpen) {
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        }
        if (this.originalXmlSend) {
            XMLHttpRequest.prototype.send = this.originalXmlSend;
        }
    }
    // --- FETCH HOOKING ---
    hookFetch() {
        this.originalFetch = window.fetch;
        const extractor = this;
        window.fetch = async function (...args) {
            var _a;
            // Parse arguments
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
            const method = ((_a = config === null || config === void 0 ? void 0 : config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            const body = config === null || config === void 0 ? void 0 : config.body;
            // Call original fetch
            const response = await extractor.originalFetch.apply(this, args);
            // Clone response to read data without disturbing the stream
            const clone = response.clone();
            clone.text().then((text) => {
                extractor.handleNetworkRequest(url, method, body, text);
            }).catch(() => {
                // Silently ignore errors in reading response
            });
            return response;
        };
    }
    restoreFetch() {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
    }
    // --- REQUEST HANDLING ---
    /**
     * NEW FLOW: Handle intercepted network request
     * Chỉ bắt request khi có pending collection + anti-duplicate
     */
    handleNetworkRequest(url, method, reqBody, resBody) {
        var _a, _b;
        if (!this.payloadBuilder || !this.payloadBuilder.pendingCollections) {
            // Không có pending collections → Ignore
            return;
        }
        const timestamp = Date.now();
        const reqData = this.safeParse(reqBody);
        const resData = this.safeParse(resBody);
        const networkContext = {
            reqBody: reqData,
            resBody: resData,
            method: method,
            url: url
        };
        console.log('[NetworkExtractor] Intercepted request:', method, url);
        console.log('[NetworkExtractor] Pending collections:', this.payloadBuilder.pendingCollections.size);
        // Lặp qua các pending collections
        for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
            console.log('[NetworkExtractor] Checking pending rule:', ruleId, pending.rule.name);
            // 1. Check xem request có xảy ra SAU trigger không (trong 5s)
            const timeSinceTrigger = timestamp - pending.timestamp;
            if (timeSinceTrigger > 5000) {
                console.log('[NetworkExtractor] Request too late (>5s) for rule:', ruleId);
                continue;
            }
            if (timeSinceTrigger < 0) {
                console.log('[NetworkExtractor] Request before trigger for rule:', ruleId);
                continue;
            }
            // 2. Check xem đã bắt request cho rule này chưa (anti-duplicate)
            if (pending.networkCaptured) {
                console.log('[NetworkExtractor] Already captured network data for rule:', ruleId, '- IGNORING duplicate');
                continue;
            }
            // 3. Check xem request có khớp với rule không (bao gồm cả requesturl, requestbody, responsebody)
            const matchedMappings = (_a = pending.rule.payloadMappings) === null || _a === void 0 ? void 0 : _a.filter((mapping) => {
                const source = (mapping.source || '').toLowerCase();
                // Chấp nhận cả requesturl, requestbody, responsebody
                if (!['requesturl', 'request_url', 'requestbody', 'request_body', 'responsebody', 'response_body'].includes(source)) {
                    return false;
                }
                if (!mapping.requestUrlPattern)
                    return false;
                // Check method match
                if (mapping.requestMethod &&
                    mapping.requestMethod.toUpperCase() !== method.toUpperCase()) {
                    return false;
                }
                // Check URL pattern match
                if (!PathMatcher.matchStaticSegments(url, mapping.requestUrlPattern)) {
                    return false;
                }
                if (!PathMatcher.match(url, mapping.requestUrlPattern)) {
                    return false;
                }
                return true;
            });
            if (!matchedMappings || matchedMappings.length === 0) {
                console.log('[NetworkExtractor] Request URL does not match rule patterns');
                continue;
            }
            console.log('[NetworkExtractor] ✅ Request matched!', matchedMappings.length, 'mappings');
            // 4. Extract dữ liệu từ các mappings (bao gồm cả requesturl)
            let hasRequiredData = false;
            const extractedData = {};
            for (const mapping of matchedMappings) {
                const source = (mapping.source || '').toLowerCase();
                let value = null;
                // Handle requesturl source - extract from URL pattern
                if (source === 'requesturl' || source === 'request_url') {
                    console.log('[NetworkExtractor] Extracting from requesturl:', mapping.field);
                    const urlExtractor = (_b = this.payloadBuilder) === null || _b === void 0 ? void 0 : _b.requestUrlExtractor;
                    if (urlExtractor) {
                        // Pass the current URL and method as context
                        value = urlExtractor.extract(mapping, {
                            url: url,
                            method: method,
                            currentUrl: url,
                            currentMethod: method,
                            triggerTimestamp: pending.timestamp
                        });
                    }
                }
                else {
                    // Handle requestbody/responsebody
                    const normalizedMapping = {
                        ...mapping,
                        source: 'network_request',
                        value: mapping.value || mapping.requestBodyPath
                    };
                    value = this.extract(normalizedMapping, networkContext);
                }
                if (this.isValid(value)) {
                    extractedData[mapping.field] = value;
                    hasRequiredData = true;
                }
            }
            if (!hasRequiredData) {
                console.log('[NetworkExtractor] Request missing required data, continuing to wait...');
                continue;
            }
            // ✅ Đã bắt được request đúng!
            console.log('[NetworkExtractor] 🎯 Captured matching request for rule:', ruleId);
            console.log('[NetworkExtractor] Extracted data:', extractedData);
            // Notify PayloadBuilder về dữ liệu mới
            for (const [field, value] of Object.entries(extractedData)) {
                this.payloadBuilder.notifyNetworkData(ruleId, field, value);
            }
            // Invoke callback if exists
            if (this.onNetworkMatchCallback) {
                this.onNetworkMatchCallback(pending.rule, extractedData, networkContext);
            }
            // Log for debugging
            console.groupCollapsed(`%c[NetworkExtractor] ✅ Captured: ${method} ${url}`, 'color: green; font-weight: bold');
            console.log('Rule:', pending.rule.name);
            console.log('Time since trigger:', timeSinceTrigger, 'ms');
            console.log('Extracted:', extractedData);
            console.groupEnd();
            // IMPORTANT: Sau khi bắt được → Đánh dấu đã capture
            // Các requests tiếp theo sẽ bị ignore
            break;
        }
    }
    // --- HELPER METHODS ---
    matchesUrl(url, pattern) {
        return PathMatcher.match(url, pattern);
    }
    traverseObject(obj, path) {
        if (!obj)
            return null;
        try {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                }
                else {
                    return null;
                }
            }
            return (typeof current === 'object') ? JSON.stringify(current) : current;
        }
        catch {
            return null;
        }
    }
    safeParse(data) {
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        }
        catch {
            return data;
        }
    }
    isValid(val) {
        return val !== null && val !== undefined && val !== '';
    }
}
//# sourceMappingURL=network-extractor.js.map