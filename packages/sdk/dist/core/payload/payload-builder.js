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
        console.log(`[PayloadBuilder] Handle trigger for rule: ${rule.name} (${rule.id})`);
        // 1. Phân tích mappings
        const { syncMappings, asyncMappings } = this.classifyMappings(rule);
        console.log(`[PayloadBuilder] Sync mappings: ${syncMappings.length}, Async: ${asyncMappings.length}`);
        // 2. Nếu không có async → resolve ngay
        if (asyncMappings.length === 0) {
            const payload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
            console.log('[PayloadBuilder] ✅ No async data needed, payload ready:', payload);
            onComplete(payload);
            return;
        }
        // 3. Có async data → tạo REC
        const requiredFields = asyncMappings.map(m => m.field);
        const context = this.recManager.createContext(rule.id, requiredFields, triggerContext, (collectedData) => {
            // Khi async data đã thu thập xong
            const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
            const finalPayload = { ...syncPayload, ...collectedData };
            console.log('[PayloadBuilder] ✅ All data collected, final payload:', finalPayload);
            onComplete(finalPayload);
        });
        // 4. Resolve sync data ngay và collect vào REC
        const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
        for (const [field, value] of Object.entries(syncPayload)) {
            this.recManager.collectField(context.executionId, field, value);
        }
        // 4.5 Thu thập User Info (UserValue/AnonymousId) từ async mappings
        this.collectUserInfoFromAsyncMappings(context.executionId, asyncMappings);
        // 5. Register rule với NetworkObserver để bắt async data
        this.networkObserver.registerRule(rule);
        console.log(`[PayloadBuilder] ⏳ Waiting for network data...`);
    }
    /**
     * Thu thập User Info từ async mappings
     * Nếu có UserId/Username trong async mappings, tự động lấy từ:
     * 1. Cached user info (đã lưu từ lần trước)
     * 2. AnonymousId (fallback)
     */
    collectUserInfoFromAsyncMappings(executionId, asyncMappings) {
        // Tìm xem có mapping nào cho UserValue/AnonymousId không
        const userMapping = asyncMappings.find(m => m.field === 'UserId' ||
            m.field === 'AnonymousId');
        if (!userMapping) {
            return; // Không cần user info
        }
        // Lấy cached user info
        const cachedInfo = getCachedUserInfo();
        if (cachedInfo && cachedInfo.userValue) {
            // Có cached user info → dùng nó
            this.recManager.collectField(executionId, cachedInfo.userField, cachedInfo.userValue);
            console.log(`[PayloadBuilder] Using cached user: ${cachedInfo.userField}=${cachedInfo.userValue}`);
            return;
        }
        // Không có cached user info → dùng AnonymousId
        const anonId = getOrCreateAnonymousId();
        this.recManager.collectField(executionId, 'AnonymousId', anonId);
        console.log(`[PayloadBuilder] Using AnonymousId: ${anonId}`);
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
        const payload = {
            ruleId: rule.id,
            eventTypeId: rule.eventTypeId
        };
        for (const mapping of mappings) {
            const value = this.resolveSyncMapping(mapping, context);
            if (this.isValidValue(value)) {
                payload[mapping.field] = value;
            }
        }
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
                console.warn(`[PayloadBuilder] Unknown sync source: ${source}`);
                return null;
        }
    }
    /**
     * Extract từ element
     */
    extractFromElement(mapping, context) {
        const element = context.element || context.target;
        if (!element) {
            console.warn('[PayloadBuilder] No element in context');
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
                console.warn(`[PayloadBuilder] Element not found: ${selector}`);
                return null;
            }
            // Extract value từ element
            return this.getElementValue(targetElement);
        }
        catch (error) {
            console.error('[PayloadBuilder] Error extracting from element:', error);
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
            console.warn('[PayloadBuilder] Error reading localStorage:', error);
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
            console.warn('[PayloadBuilder] Error reading sessionStorage:', error);
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