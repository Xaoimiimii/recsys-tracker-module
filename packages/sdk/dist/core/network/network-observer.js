/**
 * NetworkObserver - Passive Network Listener
 *
 * NGUYÊN TẮC:
 * 1. Init KHI SDK LOAD (không phải trong plugin)
 * 2. Luôn active và lắng nghe TẤT CẢ requests
 * 3. Chỉ xử lý request khi có REC phù hợp
 * 4. KHÔNG dispatch event (chỉ collect data vào REC)
 * 5. Passive - không can thiệp vào logic nghiệp vụ
 * 6. Tích hợp với UserIdentityManager để handle user identity
 */
import { PathMatcher } from '../utils/path-matcher';
import { parseBody, extractByPath, extractFromUrl } from '../utils/data-extractors';
/**
 * NetworkObserver - Singleton passive listener
 */
export class NetworkObserver {
    constructor() {
        this.isActive = false;
        // Reference to REC manager
        this.recManager = null;
        // Reference to UserIdentityManager
        this.userIdentityManager = null;
        // Buffer for requests that arrived before UserIdentityManager was set
        this.pendingUserIdentityRequests = [];
        this.MAX_PENDING_REQUESTS = 10;
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
     * Set UserIdentityManager reference
     */
    setUserIdentityManager(userIdentityManager) {
        this.userIdentityManager = userIdentityManager;
        // Process any pending requests that were buffered
        if (this.pendingUserIdentityRequests.length > 0) {
            for (const requestInfo of this.pendingUserIdentityRequests) {
                this.processUserIdentityRequest(requestInfo);
            }
            this.pendingUserIdentityRequests = [];
        }
    }
    /**
     * Process user identity request
     * Extracted as separate method to handle both real-time and buffered requests
     */
    async processUserIdentityRequest(requestInfo) {
        if (!this.userIdentityManager) {
            return;
        }
        const matchesUserIdentity = this.userIdentityManager.matchesUserIdentityRequest(requestInfo.url, requestInfo.method);
        if (matchesUserIdentity) {
            // Parse response body nếu cần
            let responseBodyText = null;
            if (requestInfo.responseBody) {
                if (typeof requestInfo.responseBody === 'string') {
                    responseBodyText = requestInfo.responseBody;
                }
                else {
                    responseBodyText = await requestInfo.responseBody.text();
                    requestInfo.responseBody = responseBodyText;
                }
            }
            // Extract user info
            this.userIdentityManager.extractFromNetworkRequest(requestInfo.url, requestInfo.method, requestInfo.requestBody, responseBodyText);
        }
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
            // SECURITY: Chỉ process nếu request này có thể match với rules
            // Truyền clone thay vì parse ngay
            observer.handleRequest({
                url,
                method,
                timestamp,
                requestBody,
                responseBody: clone // Truyền clone, sẽ parse sau nếu cần
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
     * Chỉ process và log khi request match với rule patterns
     * Delegate user info extraction to UserIdentityManager
     */
    async handleRequest(requestInfo) {
        if (!this.recManager) {
            return;
        }
        // STEP 1: USER IDENTITY HANDLING
        // Delegate to UserIdentityManager nếu có
        if (this.userIdentityManager) {
            this.processUserIdentityRequest(requestInfo);
        }
        else {
            // Buffer request if UserIdentityManager not ready yet
            // Only buffer GET/POST requests to avoid memory issues
            if ((requestInfo.method === 'GET' || requestInfo.method === 'POST') &&
                this.pendingUserIdentityRequests.length < this.MAX_PENDING_REQUESTS) {
                this.pendingUserIdentityRequests.push(requestInfo);
            }
        }
        // STEP 2: SECURITY CHECK - Có registered rules không?
        if (this.registeredRules.size === 0) {
            // Không có rules để track events
            return;
        }
        // STEP 3: SECURITY CHECK - Request này có khả năng match với rule nào không?
        const potentialMatches = this.findPotentialMatchingRules(requestInfo);
        if (potentialMatches.length === 0) {
            return; // Không match với rule nào để track events
        }
        // Parse response body nếu cần (chỉ khi có match)
        if (requestInfo.responseBody && typeof requestInfo.responseBody !== 'string') {
            // responseBody là Response clone từ fetch
            try {
                const text = await requestInfo.responseBody.text();
                requestInfo.responseBody = text;
            }
            catch (error) {
                return;
            }
        }
        // Process từng rule match
        for (const rule of potentialMatches) {
            // Tìm REC phù hợp cho rule này
            const context = this.recManager.findMatchingContext(rule.id, requestInfo.timestamp);
            if (!context) {
                continue;
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
     * SECURITY: Tìm rules có thể match với request này
     * Check URL pattern và method TRƯỚC KHI parse body
     */
    findPotentialMatchingRules(requestInfo) {
        const matches = [];
        for (const rule of this.registeredRules.values()) {
            if (!rule.payloadMappings)
                continue;
            // Check xem có mapping nào match với request này không
            for (const mapping of rule.payloadMappings) {
                // Chỉ check network sources
                const source = (mapping.source || '').toLowerCase();
                if (!this.isNetworkSource(source))
                    continue;
                // Check pattern match
                if (this.matchesPattern(mapping, requestInfo)) {
                    matches.push(rule);
                    break; // Rule này match rồi, không cần check mapping khác
                }
            }
        }
        return matches;
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
        var _a, _b;
        const requestMethod = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.RequestMethod;
        const requestUrlPattern = (_b = mapping.config) === null || _b === void 0 ? void 0 : _b.RequestUrlPattern;
        // Check method
        if (requestMethod) {
            const expectedMethod = requestMethod.toUpperCase();
            if (requestInfo.method !== expectedMethod) {
                return false;
            }
        }
        // Check URL pattern
        if (requestUrlPattern) {
            if (!PathMatcher.match(requestInfo.url, requestUrlPattern)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Extract value từ request theo mapping config
     *
     * SMART LOGIC:
     * - Source = "RequestBody" + Method = GET → Auto extract từ ResponseBody
     * - Source = "RequestBody" + Method = POST/PUT/PATCH/DELETE → Extract từ RequestBody
     * - Source = "ResponseBody" → Luôn extract từ ResponseBody
     */
    extractValue(mapping, requestInfo) {
        const source = (mapping.source || '').toLowerCase();
        const method = requestInfo.method.toUpperCase();
        switch (source) {
            case 'requestbody':
            case 'request_body':
                // SMART: Nếu là GET request, tự động chuyển sang response body
                if (method === 'GET') {
                    return this.extractFromResponseBody(mapping, requestInfo);
                }
                // POST/PUT/PATCH/DELETE → Dùng request body như bình thường
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
        var _a;
        const body = parseBody(requestInfo.requestBody);
        if (!body) {
            return null;
        }
        const path = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
        const result = extractByPath(body, path);
        return result;
    }
    /**
     * Extract từ response body
     */
    extractFromResponseBody(mapping, requestInfo) {
        var _a;
        const body = parseBody(requestInfo.responseBody);
        if (!body) {
            return null;
        }
        const path = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
        const result = extractByPath(body, path);
        return result;
    }
    /**
     * Extract từ request URL
     */
    extractFromRequestUrl(mapping, requestInfo) {
        const { ExtractType, Value, RequestUrlPattern } = mapping.config;
        return extractFromUrl(requestInfo.url, Value, ExtractType, RequestUrlPattern);
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