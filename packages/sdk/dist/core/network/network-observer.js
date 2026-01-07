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
import { saveCachedUserInfo } from '../plugins/utils/plugin-utils';
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
        // User info mappings được extract từ config để smart caching
        this.userInfoMappings = [];
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
     * Register user info mappings từ config
     * Được gọi bởi ConfigLoader sau khi parse rules
     */
    registerUserInfoMappings(rules) {
        console.log('[NetworkObserver] Scanning rules for user info mappings...');
        this.userInfoMappings = [];
        for (const rule of rules) {
            if (!rule.payloadMappings)
                continue;
            for (const mapping of rule.payloadMappings) {
                // Chỉ quan tâm UserId hoặc Username
                if (mapping.field !== 'UserId' && mapping.field !== 'Username') {
                    continue;
                }
                const source = (mapping.source || '').toLowerCase();
                // Chỉ quan tâm network sources
                const networkSources = ['requestbody', 'request_body', 'responsebody', 'response_body'];
                if (!networkSources.includes(source)) {
                    continue;
                }
                // Phải có pattern và method
                if (!mapping.requestUrlPattern || !mapping.requestMethod) {
                    continue;
                }
                // Thêm vào danh sách
                this.userInfoMappings.push({
                    field: mapping.field,
                    source: mapping.source || '',
                    requestUrlPattern: mapping.requestUrlPattern,
                    requestMethod: mapping.requestMethod,
                    requestBodyPath: mapping.requestBodyPath || mapping.value || ''
                });
                console.log('[NetworkObserver] ✅ Registered user info mapping:', {
                    field: mapping.field,
                    pattern: mapping.requestUrlPattern,
                    method: mapping.requestMethod,
                    path: mapping.requestBodyPath || mapping.value
                });
            }
        }
        console.log('[NetworkObserver] Total user info mappings registered:', this.userInfoMappings.length);
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
     * SECURITY: Chỉ process và log khi request match với rule patterns
     * SMART: Cache user info dựa trên registered user info mappings từ config
     */
    async handleRequest(requestInfo) {
        if (!this.recManager) {
            return;
        }
        // STEP 1: SMART USER INFO CACHING
        // Chỉ cache nếu có user info mappings đã đăng ký từ config
        const userInfoCached = await this.smartUserInfoCaching(requestInfo);
        if (userInfoCached) {
            // Đã cache user info, log ngắn gọn
            console.log('[NetworkObserver] 💾 User info cached from:', requestInfo.url);
        }
        // STEP 2: SECURITY CHECK - Có registered rules không?
        if (this.registeredRules.size === 0) {
            // Không có rules để track events, nhưng vẫn có thể đã cache user info ở trên
            return;
        }
        // STEP 3: SECURITY CHECK - Request này có khả năng match với rule nào không?
        const potentialMatches = this.findPotentialMatchingRules(requestInfo);
        if (potentialMatches.length === 0) {
            return; // Không match với rule nào để track events
        }
        // CHỈ LOG KHI CÓ POTENTIAL MATCH
        console.log('[NetworkObserver] 🎯 Potential match found - URL:', requestInfo.url, 'Method:', requestInfo.method);
        console.log('[NetworkObserver] Matching rules:', potentialMatches.map(r => `${r.id}:${r.name}`));
        // Parse response body nếu cần (chỉ khi có match)
        if (requestInfo.responseBody && typeof requestInfo.responseBody !== 'string') {
            // responseBody là Response clone từ fetch
            try {
                const text = await requestInfo.responseBody.text();
                requestInfo.responseBody = text;
                console.log('[NetworkObserver] Response body parsed (preview):', text.substring(0, 200));
            }
            catch (error) {
                console.error('[NetworkObserver] Failed to parse response body:', error);
                return;
            }
        }
        // Process từng rule match
        for (const rule of potentialMatches) {
            // Tìm REC phù hợp cho rule này
            const context = this.recManager.findMatchingContext(rule.id, requestInfo.timestamp);
            if (!context) {
                console.log('[NetworkObserver] No active context for rule:', rule.id, '(but user info may have been cached)');
                continue;
            }
            console.log('[NetworkObserver] ✅ Processing rule with active context:', context.executionId);
            // Process mappings cho rule này
            this.processRuleMappings(rule, context, requestInfo);
        }
    }
    /**
     * Process payload mappings của rule và extract data vào REC
     */
    processRuleMappings(rule, context, requestInfo) {
        console.log('[NetworkObserver] processRuleMappings for rule:', rule.id);
        if (!rule.payloadMappings) {
            console.log('[NetworkObserver] No payload mappings');
            return;
        }
        console.log('[NetworkObserver] Processing', rule.payloadMappings.length, 'mappings');
        for (const mapping of rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            console.log('[NetworkObserver] Checking mapping - Field:', mapping.field, 'Source:', source);
            // Chỉ xử lý network sources
            if (!this.isNetworkSource(source)) {
                console.log('[NetworkObserver] Not a network source, skipping');
                continue;
            }
            console.log('[NetworkObserver] Is network source, checking pattern match');
            console.log('[NetworkObserver] Mapping pattern:', mapping.requestUrlPattern, 'Method:', mapping.requestMethod);
            console.log('[NetworkObserver] Request URL:', requestInfo.url, 'Method:', requestInfo.method);
            // Check pattern match
            if (!this.matchesPattern(mapping, requestInfo)) {
                console.log('[NetworkObserver] Pattern does not match, skipping');
                continue;
            }
            console.log('[NetworkObserver] ✅ Pattern matched! Extracting value...');
            // Extract value
            const value = this.extractValue(mapping, requestInfo);
            console.log('[NetworkObserver] Extracted value:', value);
            if (value !== null && value !== undefined) {
                console.log('[NetworkObserver] 📦 Collecting field into REC:', mapping.field, '=', value);
                // Collect vào REC
                this.recManager.collectField(context.executionId, mapping.field, value);
            }
            else {
                console.log('[NetworkObserver] ⚠️ Extracted value is null/undefined');
            }
        }
    }
    /**
     * SMART USER INFO CACHING
     *
     * Cache user info dựa trên registered user info mappings từ config
     * Chỉ cache khi request match với patterns đã đăng ký
     *
     * @returns true nếu đã cache user info
     */
    async smartUserInfoCaching(requestInfo) {
        if (this.userInfoMappings.length === 0) {
            return false; // Không có user info mappings đăng ký
        }
        // Tìm mapping phù hợp với request này
        for (const mapping of this.userInfoMappings) {
            // Check method
            if (mapping.requestMethod.toUpperCase() !== requestInfo.method) {
                continue;
            }
            // Check URL pattern
            if (!PathMatcher.match(requestInfo.url, mapping.requestUrlPattern)) {
                continue;
            }
            console.log('[NetworkObserver] 🎯 Matched user info mapping:', {
                field: mapping.field,
                pattern: mapping.requestUrlPattern,
                url: requestInfo.url
            });
            // Parse response body nếu cần
            let responseBodyText = null;
            if (requestInfo.responseBody) {
                if (typeof requestInfo.responseBody === 'string') {
                    responseBodyText = requestInfo.responseBody;
                }
                else {
                    try {
                        responseBodyText = await requestInfo.responseBody.text();
                        requestInfo.responseBody = responseBodyText;
                    }
                    catch (error) {
                        console.error('[NetworkObserver] Failed to parse response:', error);
                        continue;
                    }
                }
            }
            if (!responseBodyText) {
                console.log('[NetworkObserver] No response body to extract from');
                continue;
            }
            // Parse JSON
            let responseData;
            try {
                responseData = JSON.parse(responseBodyText);
            }
            catch {
                console.log('[NetworkObserver] Response is not JSON');
                continue;
            }
            // Extract value theo path trong mapping
            const path = mapping.requestBodyPath;
            if (!path) {
                console.log('[NetworkObserver] No path specified in mapping');
                continue;
            }
            const value = this.extractByPath(responseData, path);
            if (value) {
                console.log('[NetworkObserver] ✅ Extracted user value:', value, 'from path:', path);
                console.log('[NetworkObserver] 💾 Caching to localStorage as', mapping.field);
                saveCachedUserInfo(mapping.field, String(value));
                return true;
            }
            else {
                console.log('[NetworkObserver] ⚠️ Could not extract value from path:', path);
            }
        }
        return false;
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
                    console.log('[NetworkObserver] Smart routing: RequestBody + GET → Using ResponseBody');
                    return this.extractFromResponseBody(mapping, requestInfo);
                }
                // POST/PUT/PATCH/DELETE → Dùng request body như bình thường
                console.log('[NetworkObserver] Using RequestBody for method:', method);
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
        console.log('[NetworkObserver] extractFromRequestBody');
        console.log('[NetworkObserver] Raw request body:', requestInfo.requestBody);
        const body = this.parseBody(requestInfo.requestBody);
        console.log('[NetworkObserver] Parsed request body:', body);
        if (!body) {
            console.log('[NetworkObserver] Request body is empty/null');
            return null;
        }
        const path = mapping.value || mapping.requestBodyPath;
        console.log('[NetworkObserver] Extracting by path:', path);
        const result = this.extractByPath(body, path);
        console.log('[NetworkObserver] Extract result:', result);
        return result;
    }
    /**
     * Extract từ response body
     */
    extractFromResponseBody(mapping, requestInfo) {
        var _a, _b;
        console.log('[NetworkObserver] extractFromResponseBody');
        console.log('[NetworkObserver] Raw response body:', (_b = (_a = requestInfo.responseBody) === null || _a === void 0 ? void 0 : _a.substring) === null || _b === void 0 ? void 0 : _b.call(_a, 0, 500));
        const body = this.parseBody(requestInfo.responseBody);
        console.log('[NetworkObserver] Parsed response body:', body);
        if (!body) {
            console.log('[NetworkObserver] Response body is empty/null');
            return null;
        }
        const path = mapping.value || mapping.requestBodyPath;
        console.log('[NetworkObserver] Extracting by path:', path);
        const result = this.extractByPath(body, path);
        console.log('[NetworkObserver] Extract result:', result);
        return result;
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