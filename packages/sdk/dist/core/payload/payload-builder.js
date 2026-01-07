/**
 * PayloadBuilder - The Orchestrator
 *
 * TRÁCH NHIỆM:
 * 1. Điều phối toàn bộ quá trình build payload
 * 2. Biết rule cần field nào
 * 3. Biết field đó lấy từ đâu (sync hay async)
 * 4. Là NƠI DUY NHẤT chốt payload
 * 5. Quản lý RuleExecutionContext
 *
 * FLOW:
 * 1. Plugin trigger → gọi handleTrigger()
 * 2. Phân loại sync/async sources
 * 3. Resolve sync sources ngay
 * 4. Đăng ký async sources với NetworkObserver
 * 5. Khi đủ dữ liệu → dispatch event
 */
import { RuleExecutionContextManager } from '../execution/rule-execution-context';
import { getNetworkObserver } from '../network/network-observer';
import { getCachedUserInfo, getOrCreateAnonymousId } from '../plugins/utils/plugin-utils';
/**
 * Các source types
 */
var SourceType;
(function (SourceType) {
    SourceType[SourceType["SYNC"] = 0] = "SYNC";
    SourceType[SourceType["ASYNC"] = 1] = "ASYNC"; // Network data - cần chờ request
})(SourceType || (SourceType = {}));
/**
 * PayloadBuilder v2 - Full Orchestrator
 */
export class PayloadBuilder {
    constructor() {
        this.recManager = new RuleExecutionContextManager();
        this.networkObserver = getNetworkObserver();
    }
    /**
     * Main entry point - được gọi bởi tracking plugins
     *
     * @param rule - Tracking rule được trigger
     * @param triggerContext - Context của trigger (element, eventType, etc.)
     * @param onComplete - Callback khi payload sẵn sàng để dispatch
     */
    handleTrigger(rule, triggerContext, onComplete) {
        console.log('[PayloadBuilder] handleTrigger started for rule:', rule.id, 'eventTypeId:', rule.eventTypeId);
        // 1. Phân tích mappings
        const { syncMappings, asyncMappings } = this.classifyMappings(rule);
        console.log('[PayloadBuilder] Classified mappings - sync:', syncMappings.length, 'async:', asyncMappings.length);
        // 2. Nếu không có async → resolve ngay
        if (asyncMappings.length === 0) {
            console.log('[PayloadBuilder] No async mappings, resolving sync only');
            const payload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
            console.log('[PayloadBuilder] Sync payload ready:', payload);
            onComplete(payload);
            return;
        }
        // 3. Có async data → tạo REC
        const requiredFields = asyncMappings.map(m => m.field);
        console.log('[PayloadBuilder] Has async mappings, required fields:', requiredFields);
        const context = this.recManager.createContext(rule.id, requiredFields, triggerContext, (collectedData) => {
            // Khi async data đã thu thập xong
            console.log('[PayloadBuilder] Async data collection complete:', collectedData);
            const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
            const finalPayload = { ...syncPayload, ...collectedData };
            console.log('[PayloadBuilder] Final payload ready:', finalPayload);
            onComplete(finalPayload);
        });
        console.log('[PayloadBuilder] Created REC context with ID:', context.executionId);
        // 4. Resolve sync data ngay và collect vào REC
        const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
        for (const [field, value] of Object.entries(syncPayload)) {
            this.recManager.collectField(context.executionId, field, value);
        }
        // 4.5 Thu thập User Info (UserValue/AnonymousId) từ async mappings
        this.collectUserInfoFromAsyncMappings(context.executionId, asyncMappings);
        // 5. Register rule với NetworkObserver để bắt async data
        this.networkObserver.registerRule(rule);
    }
    /**
     * Thu thập User Info từ async mappings
     *
     * LOGIC ĐƠN GIẢN:
     * 1. NetworkObserver đã cache user info vào localStorage (nếu match request)
     * 2. Đọc localStorage: recsys_cached_user_info
     *    - CÓ → Dùng userField và userValue từ cache
     *    - KHÔNG → Fallback AnonymousId ngay
     *
     * Không đợi network data vì:
     * - Nếu có data thì đã được cache rồi (từ lần đăng nhập/refresh)
     * - Nếu không có cache nghĩa là không bắt được → fallback ngay
     */
    collectUserInfoFromAsyncMappings(executionId, asyncMappings) {
        console.log('[PayloadBuilder] collectUserInfoFromAsyncMappings - executionId:', executionId);
        console.log('[PayloadBuilder] Async mappings:', asyncMappings.map(m => ({ field: m.field, source: m.source })));
        // Tìm xem có mapping nào cho UserId/Username không
        const userMapping = asyncMappings.find(m => m.field === 'UserId' ||
            m.field === 'Username');
        if (!userMapping) {
            console.log('[PayloadBuilder] No user mapping found in async mappings');
            return; // Không cần user info
        }
        console.log('[PayloadBuilder] Found user mapping for field:', userMapping.field);
        // Check localStorage: recsys_cached_user_info
        const cachedInfo = getCachedUserInfo();
        console.log('[PayloadBuilder] Checking localStorage cache:', cachedInfo);
        if (cachedInfo && cachedInfo.userValue) {
            // ✅ CÓ CACHE - Dùng userField và userValue từ cache
            console.log('[PayloadBuilder] ✅ Using cached user info');
            console.log('[PayloadBuilder] Field:', cachedInfo.userField, 'Value:', cachedInfo.userValue);
            // Thay thế required field nếu cần
            // VD: Mapping yêu cầu UserId nhưng cache có Username
            if (userMapping.field !== cachedInfo.userField) {
                console.log('[PayloadBuilder] Replacing required field:', userMapping.field, '→', cachedInfo.userField);
                this.recManager.replaceRequiredField(executionId, userMapping.field, cachedInfo.userField);
            }
            // Collect cached value
            this.recManager.collectField(executionId, cachedInfo.userField, cachedInfo.userValue);
            return;
        }
        // ❌ KHÔNG CÓ CACHE - Fallback AnonymousId ngay
        console.log('[PayloadBuilder] ⚠️ No cached user info found');
        console.log('[PayloadBuilder] Fallback to AnonymousId immediately');
        // Thay thế required field: UserId/Username → AnonymousId
        console.log('[PayloadBuilder] Replacing required field:', userMapping.field, '→ AnonymousId');
        this.recManager.replaceRequiredField(executionId, userMapping.field, 'AnonymousId');
        // Collect AnonymousId ngay
        const anonId = getOrCreateAnonymousId();
        console.log('[PayloadBuilder] Collecting AnonymousId:', anonId);
        this.recManager.collectField(executionId, 'AnonymousId', anonId);
    }
    /**
     * Phân loại mappings thành sync và async
     */
    classifyMappings(rule) {
        const syncMappings = [];
        const asyncMappings = [];
        if (!rule.payloadMappings) {
            return { syncMappings, asyncMappings };
        }
        for (const mapping of rule.payloadMappings) {
            const sourceType = this.getSourceType(mapping.source);
            if (sourceType === SourceType.SYNC) {
                syncMappings.push(mapping);
            }
            else {
                asyncMappings.push(mapping);
            }
        }
        return { syncMappings, asyncMappings };
    }
    /**
     * Xác định source type
     */
    getSourceType(source) {
        const s = (source || '').toLowerCase();
        const asyncSources = [
            'requestbody',
            'request_body',
            'responsebody',
            'response_body',
            'requesturl',
            'request_url'
        ];
        return asyncSources.includes(s) ? SourceType.ASYNC : SourceType.SYNC;
    }
    /**
     * Resolve tất cả sync mappings
     */
    resolveSyncMappings(mappings, context, rule) {
        console.log('[PayloadBuilder] resolveSyncMappings - mappings count:', mappings.length);
        const payload = {
            ruleId: rule.id,
            eventTypeId: rule.eventTypeId
        };
        for (const mapping of mappings) {
            const value = this.resolveSyncMapping(mapping, context);
            console.log('[PayloadBuilder] Resolved sync mapping:', mapping.field, 'from source:', mapping.source, 'value:', value);
            if (this.isValidValue(value)) {
                payload[mapping.field] = value;
            }
            else {
                console.log('[PayloadBuilder] Invalid value for field:', mapping.field);
            }
        }
        console.log('[PayloadBuilder] Final sync payload:', payload);
        return payload;
    }
    /**
     * Resolve một sync mapping
     */
    resolveSyncMapping(mapping, context) {
        const source = (mapping.source || '').toLowerCase();
        switch (source) {
            case 'element':
                return this.extractFromElement(mapping, context);
            case 'cookie':
                return this.extractFromCookie(mapping);
            case 'localstorage':
                return this.extractFromLocalStorage(mapping);
            case 'sessionstorage':
                return this.extractFromSessionStorage(mapping);
            case 'url':
            case 'pageurl':
            case 'page_url':
                return this.extractFromPageUrl(mapping);
            case 'static':
                return mapping.value;
            case 'login_detector':
                return this.extractFromLoginDetector(mapping);
            default:
                return null;
        }
    }
    /**
     * Extract từ element
     */
    extractFromElement(mapping, context) {
        const element = context.element || context.target;
        if (!element) {
            return null;
        }
        const selector = mapping.value;
        if (!selector) {
            return null;
        }
        try {
            // Strategy 1: Find trong scope của element
            let targetElement = element.querySelector(selector);
            // Strategy 2: Closest match
            if (!targetElement) {
                targetElement = element.closest(selector);
            }
            // Strategy 3: Search trong form parent
            if (!targetElement && element.form) {
                targetElement = element.form.querySelector(selector);
            }
            if (!targetElement) {
                return null;
            }
            // Extract value từ element
            return this.getElementValue(targetElement);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Get value từ element (text, value, attribute)
     */
    getElementValue(element) {
        var _a;
        // Input elements
        if (element instanceof HTMLInputElement) {
            if (element.type === 'checkbox' || element.type === 'radio') {
                return element.checked;
            }
            return element.value;
        }
        // Textarea
        if (element instanceof HTMLTextAreaElement) {
            return element.value;
        }
        // Select
        if (element instanceof HTMLSelectElement) {
            return element.value;
        }
        // Data attributes
        if (element.hasAttribute('data-value')) {
            return element.getAttribute('data-value');
        }
        if (element.hasAttribute('data-id')) {
            return element.getAttribute('data-id');
        }
        // Text content
        return ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null;
    }
    /**
     * Extract từ cookie
     */
    extractFromCookie(mapping) {
        const cookieName = mapping.value;
        if (!cookieName)
            return null;
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.split('=').map(s => s.trim());
            if (name === cookieName) {
                return decodeURIComponent(value);
            }
        }
        return null;
    }
    /**
     * Extract từ localStorage
     */
    extractFromLocalStorage(mapping) {
        const key = mapping.value;
        if (!key)
            return null;
        try {
            const value = localStorage.getItem(key);
            if (value === null)
                return null;
            // Try parse JSON
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Extract từ sessionStorage
     */
    extractFromSessionStorage(mapping) {
        const key = mapping.value;
        if (!key)
            return null;
        try {
            const value = sessionStorage.getItem(key);
            if (value === null)
                return null;
            // Try parse JSON
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Extract từ page URL
     */
    extractFromPageUrl(mapping) {
        const url = new URL(window.location.href);
        const urlPart = (mapping.urlPart || '').toLowerCase();
        switch (urlPart) {
            case 'query':
            case 'queryparam':
                const paramName = mapping.urlPartValue || mapping.value;
                return url.searchParams.get(paramName);
            case 'path':
                return url.pathname;
            case 'hash':
                return url.hash.substring(1);
            case 'hostname':
                return url.hostname;
            default:
                return url.href;
        }
    }
    /**
     * Extract từ LoginDetector (custom integration)
     */
    extractFromLoginDetector(_mapping) {
        var _a;
        try {
            // @ts-ignore
            const user = (_a = window.LoginDetector) === null || _a === void 0 ? void 0 : _a.getCurrentUser();
            return user || 'guest';
        }
        catch {
            return 'guest';
        }
    }
    /**
     * Check if value is valid (not null, undefined, empty string)
     */
    isValidValue(value) {
        return value !== null && value !== undefined && value !== '';
    }
    /**
     * Get REC manager (for external access if needed)
     */
    getRECManager() {
        return this.recManager;
    }
    /**
     * Get active contexts count (for debugging)
     */
    getActiveContextsCount() {
        return this.recManager.getActiveCount();
    }
}
//# sourceMappingURL=payload-builder.js.map