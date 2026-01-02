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
        this.trackerConfig = null;
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
    enableTracking(config, onMatch) {
        if (this.isTrackingActive) {
            console.warn('[NetworkExtractor] Network tracking is already active');
            return;
        }
        this.trackerConfig = config;
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
        this.trackerConfig = null;
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
     * Handle intercepted network request
     * Match against rules and extract data
     */
    handleNetworkRequest(url, method, reqBody, resBody) {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        const reqData = this.safeParse(reqBody);
        const resData = this.safeParse(resBody);
        const networkContext = {
            reqBody: reqData,
            resBody: resData,
            method: method,
            url: url
        };
        // Match against each tracking rule
        for (const rule of this.trackerConfig.trackingRules) {
            if (!rule.payloadMappings)
                continue;
            // Filter mappings that match this request
            const applicableMappings = rule.payloadMappings.filter((mapping) => {
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
            if (applicableMappings.length > 0) {
                // Extract data from matched mappings
                const extractedData = {};
                for (const mapping of applicableMappings) {
                    const normalizedMapping = {
                        ...mapping,
                        source: 'network_request',
                        value: mapping.value || mapping.requestBodyPath
                    };
                    const value = this.extract(normalizedMapping, networkContext);
                    if (this.isValid(value)) {
                        extractedData[mapping.field] = value;
                    }
                }
                // If we extracted any data, invoke callback
                if (Object.keys(extractedData).length > 0) {
                    if (this.onNetworkMatchCallback) {
                        this.onNetworkMatchCallback(rule, extractedData, networkContext);
                    }
                    // Log for debugging
                    console.groupCollapsed(`%c[NetworkExtractor] Match: ${method} ${url}`, 'color: orange');
                    console.log('Rule:', rule.name);
                    console.log('Extracted:', extractedData);
                    console.groupEnd();
                }
            }
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