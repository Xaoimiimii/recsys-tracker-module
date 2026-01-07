/**
 * NetworkObserver - Passive Network Listener
 *
 * NGUYÊN TẮC:
 * 1. Init KHI SDK LOAD (không phải trong plugin)
 * 2. Luôn active và lắng nghe TẤT CẢ requests
 * 3. Chỉ xử lý request khi có REC phù hợp
 * 4. KHÔNG dispatch event (chỉ collect data vào REC)
 * 5. Passive - không can thiệp vào logic nghiệp vụ
 */
import { PathMatcher } from '../utils/path-matcher';
/**
 * NetworkObserver - Singleton passive listener
 */
export class NetworkObserver {
    constructor() {
        this.isActive = false;
        // Reference to REC manager
        this.recManager = null;
        // Registered rules that need network data
        this.registeredRules = new Map();
        this.originalFetch = window.fetch;
        this.originalXhrOpen = XMLHttpRequest.prototype.open;
        this.originalXhrSend = XMLHttpRequest.prototype.send;
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!NetworkObserver.instance) {
            NetworkObserver.instance = new NetworkObserver();
        }
        return NetworkObserver.instance;
    }
    /**
     * Initialize observer với REC manager
     * PHẢI GỌI KHI SDK INIT
     */
    initialize(recManager) {
        if (this.isActive) {
            return;
        }
        this.recManager = recManager;
        this.hookFetch();
        this.hookXHR();
        this.isActive = true;
    }
    /**
     * Register một rule cần network data
     * Được gọi bởi PayloadBuilder khi phát hiện rule cần async data
     */
    registerRule(rule) {
        if (!this.registeredRules.has(rule.id)) {
            this.registeredRules.set(rule.id, rule);
        }
    }
    /**
     * Unregister rule (cleanup)
     */
    unregisterRule(ruleId) {
        this.registeredRules.delete(ruleId);
    }
    /**
     * Hook Fetch API
     */
    hookFetch() {
        const observer = this;
        window.fetch = async function (input, init) {
            var _a;
            const url = typeof input === 'string' ? input : input.url;
            const method = ((_a = init === null || init === void 0 ? void 0 : init.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            const requestBody = init === null || init === void 0 ? void 0 : init.body;
            const timestamp = Date.now();
            // Call original fetch
            const response = await observer.originalFetch.call(window, input, init);
            // Clone để đọc response mà không ảnh hưởng stream
            const clone = response.clone();
            // Process async
            clone.text().then(responseText => {
                observer.handleRequest({
                    url,
                    method,
                    timestamp,
                    requestBody,
                    responseBody: responseText
                });
            });
            return response;
        };
    }
    /**
     * Hook XMLHttpRequest
     */
    hookXHR() {
        const observer = this;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._networkObserverInfo = {
                method: method.toUpperCase(),
                url,
                timestamp: Date.now()
            };
            return observer.originalXhrOpen.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkObserverInfo;
            if (info) {
                info.requestBody = body;
                this.addEventListener('load', function () {
                    observer.handleRequest({
                        url: info.url,
                        method: info.method,
                        timestamp: Date.now(), // Response timestamp
                        requestBody: info.requestBody,
                        responseBody: this.responseText
                    });
                });
            }
            return observer.originalXhrSend.call(this, body);
        };
    }
    /**
     * Xử lý request đã intercept
     * CORE LOGIC - chỉ xử lý nếu có REC phù hợp
     */
    handleRequest(requestInfo) {
        if (!this.recManager) {
            return;
        }
        // Check tất cả registered rules
        for (const rule of this.registeredRules.values()) {
            // Tìm REC phù hợp cho rule này
            const context = this.recManager.findMatchingContext(rule.id, requestInfo.timestamp);
            if (!context) {
                continue; // Không có context đang chờ cho rule này
            }
            // Process mappings cho rule này
            this.processRuleMappings(rule, context, requestInfo);
        }
    }
    /**
     * Process payload mappings của rule và extract data vào REC
     */
    processRuleMappings(rule, context, requestInfo) {
        if (!rule.payloadMappings) {
            return;
        }
        for (const mapping of rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            // Chỉ xử lý network sources
            if (!this.isNetworkSource(source)) {
                continue;
            }
            // Check pattern match
            if (!this.matchesPattern(mapping, requestInfo)) {
                continue;
            }
            // Extract value
            const value = this.extractValue(mapping, requestInfo);
            if (value !== null && value !== undefined) {
                // Collect vào REC
                this.recManager.collectField(context.executionId, mapping.field, value);
            }
        }
    }
    /**
     * Check nếu source là network source
     */
    isNetworkSource(source) {
        return [
            'requestbody',
            'request_body',
            'responsebody',
            'response_body',
            'requesturl',
            'request_url'
        ].includes(source);
    }
    /**
     * Check nếu request match với pattern trong mapping
     */
    matchesPattern(mapping, requestInfo) {
        // Check method
        if (mapping.requestMethod) {
            const expectedMethod = mapping.requestMethod.toUpperCase();
            if (requestInfo.method !== expectedMethod) {
                return false;
            }
        }
        // Check URL pattern
        if (mapping.requestUrlPattern) {
            if (!PathMatcher.match(requestInfo.url, mapping.requestUrlPattern)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Extract value từ request theo mapping config
     */
    extractValue(mapping, requestInfo) {
        const source = (mapping.source || '').toLowerCase();
        switch (source) {
            case 'requestbody':
            case 'request_body':
                return this.extractFromRequestBody(mapping, requestInfo);
            case 'responsebody':
            case 'response_body':
                return this.extractFromResponseBody(mapping, requestInfo);
            case 'requesturl':
            case 'request_url':
                return this.extractFromRequestUrl(mapping, requestInfo);
            default:
                return null;
        }
    }
    /**
     * Extract từ request body
     */
    extractFromRequestBody(mapping, requestInfo) {
        const body = this.parseBody(requestInfo.requestBody);
        if (!body)
            return null;
        return this.extractByPath(body, mapping.value || mapping.requestBodyPath);
    }
    /**
     * Extract từ response body
     */
    extractFromResponseBody(mapping, requestInfo) {
        const body = this.parseBody(requestInfo.responseBody);
        if (!body)
            return null;
        return this.extractByPath(body, mapping.value || mapping.requestBodyPath);
    }
    /**
     * Extract từ request URL
     */
    extractFromRequestUrl(mapping, requestInfo) {
        var _a;
        const url = new URL(requestInfo.url, window.location.origin);
        const urlPart = (_a = mapping.urlPart) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        switch (urlPart) {
            case 'query':
            case 'queryparam':
                const paramName = mapping.urlPartValue || mapping.value;
                return url.searchParams.get(paramName);
            case 'path':
            case 'pathsegment':
                // Extract path segment by index or pattern
                const pathValue = mapping.urlPartValue || mapping.value;
                if (pathValue && !isNaN(Number(pathValue))) {
                    const segments = url.pathname.split('/').filter(s => s);
                    // Convert from user view (1-based) to dev view (0-based)
                    const index = Number(pathValue) - 1;
                    const result = segments[index] || null;
                    return result;
                }
                return url.pathname;
            case 'hash':
                return url.hash.substring(1); // Remove #
            default:
                // If no urlPart specified, try to extract from value
                // Check if value is a number (path segment index)
                const segments = url.pathname.split('/').filter(s => s);
                if (mapping.value && !isNaN(Number(mapping.value))) {
                    // Convert from user view (1-based) to dev view (0-based)
                    const index = Number(mapping.value) - 1;
                    const result = segments[index] || null;
                    return result;
                }
                return url.href;
        }
    }
    /**
     * Parse body (JSON or text)
     */
    parseBody(body) {
        if (!body)
            return null;
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            }
            catch {
                return body;
            }
        }
        return body;
    }
    /**
     * Extract value by path (e.g., "data.user.id")
     */
    extractByPath(obj, path) {
        if (!path || !obj)
            return null;
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) {
                return null;
            }
            current = current[part];
        }
        return current;
    }
    /**
     * Restore original functions (for cleanup/testing)
     */
    restore() {
        if (!this.isActive)
            return;
        window.fetch = this.originalFetch;
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.isActive = false;
        this.registeredRules.clear();
    }
    /**
     * Check if observer is active
     */
    isObserverActive() {
        return this.isActive;
    }
    /**
     * Get registered rules count (for debugging)
     */
    getRegisteredRulesCount() {
        return this.registeredRules.size;
    }
}
NetworkObserver.instance = null;
/**
 * Helper function to get singleton instance
 */
export function getNetworkObserver() {
    return NetworkObserver.getInstance();
}
//# sourceMappingURL=network-observer.js.map