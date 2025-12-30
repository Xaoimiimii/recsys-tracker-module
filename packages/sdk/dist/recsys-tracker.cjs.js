'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class OriginVerifier {
    /**
     * Kiểm tra xem origin hiện tại có khớp với domainUrl đã đăng ký không
     * Thứ tự ưu tiên: 1. origin, 2. referrer
     * @param domainUrl - URL domain đã đăng ký (từ config)
     * @returns true nếu origin hoặc referrer khớp, false nếu không khớp
     */
    static verify(domainUrl) {
        try {
            if (!domainUrl) {
                console.warn('[RecSysTracker] Cannot verify: domainUrl is missing');
                return false;
            }
            // bỏ qua verification nếu đang ở local
            if (this.isDevelopment()) {
                return true;
            }
            // Bỏ qua verification khi test với file:// protocol
            if (typeof window !== 'undefined' && window.location) {
                const protocol = window.location.protocol;
                const origin = window.location.origin;
                // Cho phép localhost để test
                if ((origin === null || origin === void 0 ? void 0 : origin.startsWith('https://localhost')) || (origin === null || origin === void 0 ? void 0 : origin.startsWith('http://localhost'))) {
                    console.warn('[RecSysTracker] Skipping origin verification for localhost (testing mode)');
                    return true;
                }
                if (protocol === 'file:' || origin === 'null' || origin === 'file://') {
                    console.warn('[RecSysTracker] Skipping origin verification for file:// protocol (testing mode)');
                    return true;
                }
            }
            // 1. Thử verify bằng origin trước
            const originValid = this.verifyByOrigin(domainUrl);
            if (originValid) {
                return true;
            }
            // 2. Fallback: verify bằng referrer
            const referrerValid = this.verifyByReferrer(domainUrl);
            if (referrerValid) {
                return true;
            }
            // Không có origin hoặc referrer, hoặc cả 2 đều không khớp
            console.warn('[RecSysTracker] Origin verification failed: no valid origin or referrer');
            return false;
        }
        catch (error) {
            console.error('[RecSysTracker] Error during origin verification:', error);
            return false;
        }
    }
    // Verify bằng window.location.origin
    static verifyByOrigin(domainUrl) {
        if (typeof window === 'undefined' || !window.location || !window.location.origin) {
            return false;
        }
        const currentOrigin = window.location.origin;
        const normalizedCurrent = this.normalizeUrl(currentOrigin);
        const normalizedDomain = this.normalizeUrl(domainUrl);
        const isValid = normalizedCurrent === normalizedDomain;
        if (!isValid) {
            console.warn('[RecSysTracker] Origin mismatch:', {
                current: normalizedCurrent,
                expected: normalizedDomain
            });
        }
        return isValid;
    }
    // Verify bằng document.referrer
    // Hỗ trợ so khớp host chính xác hoặc nhiều path (referrer.startsWith(domainUrl))
    static verifyByReferrer(domainUrl) {
        if (typeof document === 'undefined' || !document.referrer) {
            return false;
        }
        try {
            const referrerUrl = new URL(document.referrer);
            const domainUrlObj = new URL(domainUrl);
            // So khớp origin (protocol + host + port)
            const referrerOrigin = this.normalizeUrl(referrerUrl.origin);
            const domainOrigin = this.normalizeUrl(domainUrlObj.origin);
            if (referrerOrigin === domainOrigin) {
                return true;
            }
            // Fallback: Hỗ trợ nhiều path - kiểm tra referrer có bắt đầu với domainUrl không
            const normalizedReferrer = this.normalizeUrl(document.referrer);
            const normalizedDomain = this.normalizeUrl(domainUrl);
            if (normalizedReferrer.startsWith(normalizedDomain)) {
                return true;
            }
            console.warn('[RecSysTracker] Referrer mismatch:', {
                referrer: normalizedReferrer,
                expected: normalizedDomain
            });
            return false;
        }
        catch (error) {
            console.warn('[RecSysTracker] Failed to parse referrer:', error);
            return false;
        }
    }
    // Normalize URL để so sánh (loại bỏ trailing slash, lowercase)
    // Giữ nguyên path nếu có
    static normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Tạo URL chuẩn: protocol + hostname + port (nếu có) + pathname
            let normalized = `${urlObj.protocol}//${urlObj.hostname}`;
            // Thêm port nếu không phải port mặc định
            if (urlObj.port &&
                !((urlObj.protocol === 'http:' && urlObj.port === '80') ||
                    (urlObj.protocol === 'https:' && urlObj.port === '443'))) {
                normalized += `:${urlObj.port}`;
            }
            // Thêm pathname (loại bỏ trailing slash)
            if (urlObj.pathname && urlObj.pathname !== '/') {
                normalized += urlObj.pathname.replace(/\/$/, '');
            }
            return normalized.toLowerCase();
        }
        catch {
            // Nếu không parse được URL, trả về chuỗi gốc lowercase, loại bỏ trailing slash
            return url.toLowerCase().replace(/\/$/, '');
        }
    }
    /**
     * Kiểm tra xem có đang ở môi trường development không
     * (localhost, 127.0.0.1, etc.)
     */
    static isDevelopment() {
        var _a;
        if (typeof window === 'undefined') {
            return false;
        }
        const hostname = ((_a = window.location) === null || _a === void 0 ? void 0 : _a.hostname) || '';
        return (hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.endsWith('.local'));
    }
}

const DEFAULT_TRACK_ENDPOINT_PATH = '/event';
const DEFAULT_CONFIG_ENDPOINT_PATH = '/domain';

// Luồng hoạt động
// 1. SDK khởi tạo
// 2. Gọi loadFromWindow() để lấy domainKey từ window
// 3. Tạo config mặc định với các endpoint dựa trên domainKey
// 4. Gọi fetchRemoteConfig() để lấy cấu hình chi tiết từ server
// 5. Merge cấu hình remote với cấu hình local
// 6. Sử dụng cấu hình đã load để thiết lập tracker
// Class để load và quản lý cấu hình tracker
class ConfigLoader {
    constructor() {
        this.config = null;
        this.domainKey = null;
        // Cập nhật cấu hình thủ công
        // updateConfig(updates: Partial<TrackerConfig>): void {
        //   if (this.config) {
        //     this.config = { ...this.config, ...updates };
        //   }
        // }
    }
    // Load config từ window.__RECSYS_DOMAIN_KEY__
    loadFromWindow() {
        try {
            if (typeof window === 'undefined' || !window.__RECSYS_DOMAIN_KEY__) {
                console.error('[RecSysTracker] window.__RECSYS_DOMAIN_KEY__ not found');
                return null;
            }
            const domainKey = window.__RECSYS_DOMAIN_KEY__;
            if (!domainKey || typeof domainKey !== 'string') {
                console.error('[RecSysTracker] Invalid domain key');
                return null;
            }
            this.domainKey = domainKey;
            // Default config
            this.config = {
                domainKey: domainKey,
                domainUrl: '',
                domainType: 0,
                trackingRules: [],
                returnMethods: [],
                options: {
                    maxRetries: 3,
                    batchSize: 10,
                    batchDelay: 2000,
                    offlineStorage: true,
                },
            };
            return this.config;
        }
        catch (error) {
            console.error('[RecSysTracker] Error loading config:', error);
            return null;
        }
    }
    // Lấy cấu hình từ server (remote)
    async fetchRemoteConfig() {
        if (!this.domainKey) {
            return this.config;
        }
        const baseUrl = "https://recsys-tracker-module.onrender.com";
        try {
            // Bước 1: Gọi 4 API song song để lấy domain, list rules cơ bản, return methods và event types
            const [domainResponse, rulesListResponse, returnMethodsResponse, eventTypesResponse] = await Promise.all([
                fetch(`${baseUrl}${DEFAULT_CONFIG_ENDPOINT_PATH}/${this.domainKey}`),
                fetch(`${baseUrl}/rule/domain/${this.domainKey}`),
                fetch(`${baseUrl}/domain/return-method/${this.domainKey}`),
                fetch(`${baseUrl}/rule/event-type`)
            ]);
            // Kiểm tra response
            if (!domainResponse.ok) {
                return this.config;
            }
            // Parse responses
            const domainData = domainResponse.ok ? await domainResponse.json() : null;
            const rulesListData = rulesListResponse.ok ? await rulesListResponse.json() : [];
            const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];
            const eventTypesData = eventTypesResponse.ok ? await eventTypesResponse.json() : [];
            // Cập nhật config với data từ server
            if (this.config) {
                this.config = {
                    ...this.config,
                    domainUrl: (domainData === null || domainData === void 0 ? void 0 : domainData.Url) || this.config.domainUrl,
                    domainType: (domainData === null || domainData === void 0 ? void 0 : domainData.Type) || this.config.domainType,
                    trackingRules: this.transformRules(rulesListData),
                    returnMethods: this.transformReturnMethods(returnMethodsData),
                    eventTypes: this.transformEventTypes(eventTypesData),
                };
                // Verify origin sau khi có domainUrl từ server
                if (this.config.domainUrl) {
                    const isOriginValid = OriginVerifier.verify(this.config.domainUrl);
                    if (!isOriginValid) {
                        console.error('[RecSysTracker] Origin verification failed. SDK will not function.');
                        this.config = null;
                        return null;
                    }
                }
            }
            return this.config;
        }
        catch (error) {
            return this.config;
        }
    }
    // Transform rules từ server format sang SDK format
    transformRules(rulesData) {
        if (!Array.isArray(rulesData))
            return [];
        return rulesData.map(rule => {
            var _a, _b;
            return ({
                id: ((_a = rule.Id) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = rule.id) === null || _b === void 0 ? void 0 : _b.toString()),
                name: rule.Name || rule.name,
                domainId: rule.DomainID || rule.domainId,
                eventTypeId: rule.EventTypeID || rule.eventTypeId,
                trackingTargetId: rule.TrackingTargetId || rule.trackingTargetId,
                payloadMappings: this.transformPayloadMappings(rule.PayloadMappings || rule.payloadMappings || []),
                conditions: this.transformConditions(rule.Conditions || rule.conditions || []),
                trackingTarget: this.transformTrackingTarget(rule.TrackingTarget || rule.trackingTarget),
            });
        });
    }
    // Transform conditions từ server format sang SDK format
    transformConditions(conditionsData) {
        if (!Array.isArray(conditionsData))
            return [];
        return conditionsData.map(condition => ({
            id: condition.Id || condition.id,
            value: condition.Value || condition.value,
            trackingRuleId: condition.TrackingRuleID || condition.trackingRuleId,
            patternId: condition.PatternId || condition.patternId,
            operatorId: condition.OperatorID || condition.operatorId,
        }));
    }
    // Transform payload mappings từ server format sang SDK format
    transformPayloadMappings(payloadData) {
        if (!Array.isArray(payloadData))
            return [];
        return payloadData.map(payload => ({
            id: payload.Id || payload.id,
            field: payload.Field || payload.field,
            source: payload.Source || payload.source,
            value: payload.Value || payload.value,
            requestUrlPattern: payload.RequestUrlPattern || payload.requestUrlPattern || null,
            requestMethod: payload.RequestMethod || payload.requestMethod || null,
            requestBodyPath: payload.RequestBodyPath || payload.requestBodyPath || null,
            urlPart: payload.UrlPart || payload.urlPart || null,
            urlPartValue: payload.UrlPartValue || payload.urlPartValue || null,
            trackingRuleId: payload.TrackingRuleId || payload.trackingRuleId,
        }));
    }
    // Transform tracking target từ server format sang SDK format
    transformTrackingTarget(targetData) {
        if (!targetData) {
            return {
                id: 0,
                value: '',
                patternId: 0,
                operatorId: 0,
            };
        }
        return {
            id: targetData.Id || targetData.id || 0,
            value: targetData.Value || targetData.value || '',
            patternId: targetData.PatternId || targetData.patternId || 0,
            operatorId: targetData.OperatorId || targetData.operatorId || 0,
        };
    }
    // Transform return methods từ server format sang SDK format
    transformReturnMethods(returnMethodsData) {
        if (!returnMethodsData || !Array.isArray(returnMethodsData))
            return [];
        return returnMethodsData.map(method => ({
            id: method.Id || method.id,
            domainId: method.DomainID || method.domainId,
            operatorId: method.OperatorID || method.operatorId,
            returnType: method.ReturnType || method.returnType,
            value: method.Value || method.value || '',
            configurationName: method.ConfigurationName || method.configurationName,
        }));
    }
    // Transform event types từ server format sang SDK format
    transformEventTypes(eventTypesData) {
        if (!eventTypesData || !Array.isArray(eventTypesData))
            return [];
        return eventTypesData.map(type => ({
            id: type.Id || type.id,
            name: type.Name || type.name,
        }));
    }
    // Lấy cấu hình hiện tại
    getConfig() {
        return this.config;
    }
}

// Error boundary cho xử lý lỗi an toàn trong SDK
class ErrorBoundary {
    constructor(debug = false) {
        this.errorHandler = null;
        this.debug = false;
        this.debug = debug;
    }
    // Set custom error handler
    setErrorHandler(handler) {
        this.errorHandler = handler;
    }
    // Enable hoặc disable debug mode
    setDebug(debug) {
        this.debug = debug;
    }
    // Execute function an toàn với xử lý lỗi
    execute(fn, context = 'unknown') {
        try {
            return fn();
        }
        catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }
    // Execute an async function an toàn với xử lý lỗi
    async executeAsync(fn, context = 'unknown') {
        try {
            return await fn();
        }
        catch (error) {
            this.handleError(error, context);
            return undefined;
        }
    }
    // Wrap một function với error boundary
    // Trả về một function mới thực thi an toàn
    wrap(fn, context = 'unknown') {
        return (...args) => {
            return this.execute(() => fn(...args), context);
        };
    }
    // Wrap một async function với error boundary
    // Trả về một async function mới thực thi an toàn
    wrapAsync(fn, context = 'unknown') {
        return async (...args) => {
            return this.executeAsync(() => fn(...args), context);
        };
    }
    // Handle error internally
    handleError(error, context) {
        if (this.debug) {
            console.error(`[RecSysTracker Error][${context}]`, error);
        }
        // Gọi error handler tùy chỉnh nếu có
        if (this.errorHandler) {
            try {
                this.errorHandler(error, context);
            }
            catch (handlerError) {
                // Prevent error handler from breaking
                if (this.debug) {
                    console.error('[RecSysTracker] Error handler failed:', handlerError);
                }
            }
        }
        // Gửi lỗi đến endpoint từ xa (optional)
        this.reportError(error, context);
    }
    // Gửi lỗi đến endpoint từ xa
    reportError(error, context) {
        // Gửi lỗi không đồng bộ để không ảnh hưởng đến luồng chính
        setTimeout(() => {
            try {
                if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                    const errorData = JSON.stringify({
                        type: 'sdk_error',
                        context,
                        message: error.message,
                        stack: error.stack,
                        timestamp: Date.now(),
                        userAgent: navigator.userAgent,
                    });
                    // Send error data
                    navigator.sendBeacon('/errors', errorData);
                }
            }
            catch (reportError) {
                // Silent fail - don't let error reporting break anything
            }
        }, 0);
    }
}

// Luồng hoạt động
// Khi có sự kiện mới: add() → lưu vào queue → persist vào storage
// Khi gửi: getBatch() → lấy batch events → gửi lên server
// Nếu thành công: removeBatch() → xóa khỏi queue
// Nếu thất bại: markFailed() → tăng retryCount → thử lại sau
// Khi app reload: loadFromStorage() → khôi phục queue → tiếp tục gửi
// Triển khai StorageAdapter sử dụng localStorage
class LocalStorageAdapter {
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        }
        catch (error) {
            // Storage save failed
        }
    }
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            return null;
        }
    }
    remove(key) {
        try {
            localStorage.removeItem(key);
        }
        catch (error) {
            // Storage remove failed
        }
    }
}
// EventBuffer class để quản lý hàng đợi sự kiện
// Lưu trữ các sự kiện tracking tạm thời
// Hỗ trợ offline (lưu vào localStorage)
// Xử lý retry khi gửi thất bại
// Gửi theo batch để tối ưu hiệu năng
class EventBuffer {
    constructor(options) {
        this.queue = [];
        this.storageKey = 'recsys_tracker_queue';
        this.maxQueueSize = 100;
        this.maxRetries = 3;
        this.offlineStorageEnabled = true;
        this.maxQueueSize = (options === null || options === void 0 ? void 0 : options.maxQueueSize) || 100;
        this.maxRetries = (options === null || options === void 0 ? void 0 : options.maxRetries) || 3;
        this.offlineStorageEnabled = (options === null || options === void 0 ? void 0 : options.offlineStorage) !== false;
        this.storage = new LocalStorageAdapter();
        // Load các sự kiện đã lưu từ storage (nếu có)
        this.loadFromStorage();
    }
    // Thêm sự kiện mới vào buffer
    add(event) {
        // Check queue size limit
        if (this.queue.length >= this.maxQueueSize) {
            this.queue.shift();
        }
        console.log('[EventBuffer] Payload được thêm vào queue:', {
            id: event.id,
            eventTypeId: event.eventTypeId,
            trackingRuleId: event.trackingRuleId,
            domainKey: event.domainKey,
            userField: event.userField,
            userValue: event.userValue,
            itemField: event.itemField,
            itemValue: event.itemValue,
            value: event.value,
            timestamp: event.timestamp,
            queueSize: this.queue.length + 1
        });
        this.queue.push(event);
        this.persistToStorage();
    }
    // Lấy các sự kiện để gửi theo batch (chỉ lấy những event đã đến thời gian retry)
    getBatch(size) {
        const now = Date.now();
        const readyEvents = this.queue.filter(event => {
            // Nếu chưa từng retry hoặc đã đến thời gian retry tiếp theo
            return !event.nextRetryAt || event.nextRetryAt <= now;
        });
        return readyEvents.slice(0, size);
    }
    // Xóa các sự kiện khỏi buffer sau khi gửi thành công
    removeBatch(eventIds) {
        this.queue = this.queue.filter(event => !eventIds.includes(event.id));
        this.persistToStorage();
    }
    // Đánh dấu các sự kiện thất bại và tăng số lần thử lại với exponential backoff
    markFailed(eventIds) {
        const now = Date.now();
        this.queue.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.retryCount = (event.retryCount || 0) + 1;
                event.lastRetryAt = now;
                // Exponential backoff: 1s → 2s → 4s → 8s → 16s
                const backoffDelay = Math.min(Math.pow(2, event.retryCount) * 1000, // 2^n seconds
                32000 // Max 32 seconds
                );
                event.nextRetryAt = now + backoffDelay;
                console.log(`[EventBuffer] Event ${event.id} will retry in ${backoffDelay / 1000}s (attempt ${event.retryCount}/${this.maxRetries})`);
            }
        });
        // Xóa các sự kiện vượt quá số lần thử lại tối đa
        this.queue = this.queue.filter(event => (event.retryCount || 0) <= this.maxRetries);
        this.persistToStorage();
    }
    // Lấy tất cả sự kiện trong buffer
    getAll() {
        return [...this.queue];
    }
    // Lấy kích thước hiện tại của queue
    size() {
        return this.queue.length;
    }
    // Kiểm tra xem queue có rỗng không
    isEmpty() {
        return this.queue.length === 0;
    }
    // Xóa tất cả sự kiện khỏi buffer
    clear() {
        this.queue = [];
        this.storage.remove(this.storageKey);
    }
    // Lưu queue vào storage
    persistToStorage() {
        if (!this.offlineStorageEnabled) {
            return;
        }
        try {
            this.storage.save(this.storageKey, this.queue);
        }
        catch (error) {
            // Persist failed
        }
    }
    // Load/khôi phục queue từ storage khi khởi động
    loadFromStorage() {
        if (!this.offlineStorageEnabled) {
            return;
        }
        try {
            const stored = this.storage.load(this.storageKey);
            if (Array.isArray(stored)) {
                this.queue = stored;
            }
        }
        catch (error) {
            // Load from storage failed
        }
    }
}

// Lớp EventDispatcher chịu trách nhiệm gửi events
class EventDispatcher {
    constructor(options) {
        this.domainUrl = null;
        this.timeout = 5000;
        this.headers = {};
        this.endpoint = options.endpoint;
        this.domainUrl = options.domainUrl || null;
        this.timeout = options.timeout || 5000;
        this.headers = options.headers || {};
    }
    // Gửi 1 event đơn lẻ
    async send(event) {
        if (!event) {
            return false;
        }
        // Verify origin trước khi gửi event
        if (this.domainUrl) {
            const isOriginValid = OriginVerifier.verify(this.domainUrl);
            if (!isOriginValid) {
                console.warn('[RecSysTracker] Origin verification failed. Event not sent.');
                return false;
            }
        }
        // Chuyển đổi TrackedEvent sang định dạng CreateEventDto
        const payload = JSON.stringify({
            Timestamp: event.timestamp,
            EventTypeId: event.eventTypeId,
            TrackingRuleId: event.trackingRuleId,
            DomainKey: event.domainKey,
            UserField: event.userField,
            UserValue: event.userValue,
            ItemField: event.itemField,
            ItemValue: event.itemValue,
            Value: event.value
        });
        // Thử từng phương thức gửi theo thứ tự ưu tiên
        const strategies = ['beacon', 'fetch'];
        for (const strategy of strategies) {
            try {
                const success = await this.sendWithStrategy(payload, strategy);
                if (success) {
                    console.log('[EventDispatcher] Payload đã được gửi thành công:', {
                        strategy,
                        eventId: event.id,
                        eventTypeId: event.eventTypeId,
                        trackingRuleId: event.trackingRuleId,
                        domainKey: event.domainKey,
                        userField: event.userField,
                        userValue: event.userValue,
                        itemField: event.itemField,
                        itemValue: event.itemValue,
                        value: event.value,
                        timestamp: event.timestamp,
                        endpoint: this.endpoint
                    });
                    return true;
                }
            }
            catch (error) {
                // Thử phương thức tiếp theo
            }
        }
        // Trả về false nếu tất cả phương thức gửi đều thất bại
        console.error('[EventDispatcher] Tất cả phương thức gửi thất bại cho event:', event.id);
        return false;
    }
    // Gửi nhiều events cùng lúc (gọi send cho từng event)
    async sendBatch(events) {
        if (events.length === 0) {
            return true;
        }
        // Gửi từng event riêng lẻ
        const results = await Promise.all(events.map(event => this.send(event)));
        // Trả về true nếu tất cả events gửi thành công
        return results.every(result => result === true);
    }
    // Gửi payload với phương thức cụ thể
    async sendWithStrategy(payload, strategy) {
        switch (strategy) {
            case 'beacon':
                return this.sendBeacon(payload);
            case 'fetch':
                return this.sendFetch(payload);
            default:
                return false;
        }
    }
    // SendBeacon --> API không đồng bộ, không chặn browser, gửi dữ liệu khi trang unload
    sendBeacon(payload) {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
            throw new Error('sendBeacon not available');
        }
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(this.endpoint, blob);
        if (!success) {
            throw new Error('sendBeacon returned false');
        }
        return true;
    }
    // Fetch với keepalive
    async sendFetch(payload) {
        if (typeof fetch === 'undefined') {
            throw new Error('fetch not available');
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.headers,
                },
                body: payload,
                keepalive: true,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return true;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    // Utility methods
    // Cập nhật URL endpoint động
    setEndpoint(endpoint) {
        this.endpoint = endpoint;
    }
    // Cập nhật domainUrl để verify origin
    setDomainUrl(domainUrl) {
        this.domainUrl = domainUrl;
    }
    // Cập nhật timeout cho requests
    setTimeout(timeout) {
        this.timeout = timeout;
    }
    // Cập nhật custom headers
    setHeaders(headers) {
        this.headers = headers;
    }
}

// Lớp chuẩn hóa metadata
class MetadataNormalizer {
    constructor(sessionTimeout) {
        this.sessionData = null;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionStorageKey = 'recsys_tracker_session';
        if (sessionTimeout) {
            this.sessionTimeout = sessionTimeout;
        }
        this.initSession();
    }
    // Lấy metadata đầy đủ
    getMetadata() {
        return {
            session: this.getSessionData(),
            page: this.getPageMetadata(),
            device: this.getDeviceMetadata(),
            timestamp: Date.now(),
        };
    }
    // Khởi tạo hoặc khôi phục session
    initSession() {
        try {
            const stored = sessionStorage.getItem(this.sessionStorageKey);
            if (stored) {
                const session = JSON.parse(stored);
                // Check if session is still valid
                const timeSinceLastActivity = Date.now() - session.lastActivityTime;
                if (timeSinceLastActivity < this.sessionTimeout) {
                    this.sessionData = session;
                    this.updateSessionActivity();
                    return;
                }
            }
        }
        catch (error) {
            // Session restore failed
        }
        // Tạo session mới
        this.createNewSession();
    }
    // Tạo session mới
    createNewSession() {
        this.sessionData = {
            sessionId: this.generateSessionId(),
            startTime: Date.now(),
            lastActivityTime: Date.now(),
        };
        this.saveSession();
    }
    // Cập nhật thời gian hoạt động cuối cùng của session
    updateSessionActivity() {
        if (this.sessionData) {
            this.sessionData.lastActivityTime = Date.now();
            this.saveSession();
        }
    }
    /**
     * Get current session data
     */
    getSessionData() {
        if (!this.sessionData) {
            this.createNewSession();
        }
        return this.sessionData;
    }
    // Lưu session vào sessionStorage
    saveSession() {
        if (this.sessionData) {
            try {
                sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(this.sessionData));
            }
            catch (error) {
                // Save session failed
            }
        }
    }
    // Tạo ID session mới
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    // Lấy metadata trang hiện tại
    getPageMetadata() {
        const url = new URL(window.location.href);
        const query = {};
        url.searchParams.forEach((value, key) => {
            query[key] = value;
        });
        return {
            url: window.location.href,
            title: document.title,
            referrer: document.referrer,
            path: url.pathname,
            query,
        };
    }
    // Lấy metadata thiết bị
    getDeviceMetadata() {
        const userAgent = navigator.userAgent;
        const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
        const isTablet = /Tablet|iPad/i.test(userAgent);
        const isDesktop = !isMobile && !isTablet;
        return {
            userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenWidth: screen.width,
            screenHeight: screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            isMobile,
            isTablet,
            isDesktop,
        };
    }
    // Tạo ID event duy nhất
    generateEventId() {
        return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
    // Extract value từ URL sử dụng regex pattern
    extractFromUrl(pattern, group = 0) {
        try {
            const regex = new RegExp(pattern);
            const match = window.location.pathname.match(regex);
            return match ? match[group] : null;
        }
        catch (error) {
            return null;
        }
    }
    // Extract value từ DOM attribute
    extractFromElement(element, attribute) {
        try {
            return element.getAttribute(attribute);
        }
        catch (error) {
            return null;
        }
    }
    // Đặt lại session (tạo mới)
    resetSession() {
        try {
            sessionStorage.removeItem(this.sessionStorageKey);
        }
        catch (error) {
            // Reset session failed
        }
        this.createNewSession();
    }
}

class PopupDisplay {
    constructor(domainKey, slotName, apiBaseUrl, config = {}) {
        this.popupTimeout = null;
        this.autoCloseTimeout = null;
        this.autoSlideTimeout = null;
        this.shadowHost = null;
        this.DEFAULT_MIN_DELAY = 10000; // 10s
        this.DEFAULT_MAX_DELAY = 20000; // 20s
        this.AUTO_SLIDE_DELAY = 5000; // 5s auto slide
        this.domainKey = domainKey;
        this.slotName = slotName;
        this.apiBaseUrl = apiBaseUrl;
        this.config = {
            minDelay: config.minDelay || this.DEFAULT_MIN_DELAY,
            maxDelay: config.maxDelay || this.DEFAULT_MAX_DELAY,
            autoCloseDelay: config.autoCloseDelay,
            pages: config.pages || ['*'], // Default show on all pages
        };
    }
    // Bắt đầu schedule popup
    start() {
        this.scheduleNextPopup();
    }
    // Dừng popup
    stop() {
        this.clearTimeouts();
        this.removePopup();
    }
    // Lập lịch hiển thị popup tiếp theo
    scheduleNextPopup() {
        this.clearTimeouts();
        const delay = this.getRandomDelay();
        console.log(`[PopupDisplay] Next popup in ${delay / 1000}s`);
        this.popupTimeout = setTimeout(() => {
            if (this.isPageAllowed(window.location.pathname)) {
                this.showPopup();
            }
            else {
                console.log('[PopupDisplay] Skipped (Page not allowed)');
                this.scheduleNextPopup();
            }
        }, delay);
    }
    // Tính toán delay ngẫu nhiên
    getRandomDelay() {
        const min = this.config.minDelay;
        const max = this.config.maxDelay;
        return Math.floor(Math.random() * (max - min) + min);
    }
    // Kiểm tra page có được phép hiển thị không
    isPageAllowed(currentPath) {
        const allowedPatterns = this.config.pages || [];
        if (allowedPatterns.length === 0 || allowedPatterns.includes('*')) {
            return true;
        }
        return allowedPatterns.some(pattern => {
            if (pattern === '/')
                return currentPath === '/';
            // Hỗ trợ wildcard (vd: /products/*)
            if (pattern.endsWith('/*')) {
                const base = pattern.slice(0, -2);
                return currentPath.startsWith(base);
            }
            return currentPath === pattern;
        });
    }
    // Hiển thị popup
    async showPopup() {
        try {
            const items = await this.fetchRecommendations();
            if (items && items.length > 0) {
                this.renderPopup(items);
                // Auto close nếu có config
                if (this.config.autoCloseDelay) {
                    this.autoCloseTimeout = setTimeout(() => {
                        this.removePopup();
                        this.scheduleNextPopup();
                    }, this.config.autoCloseDelay);
                }
            }
            else {
                // Không có items, schedule lại
                this.scheduleNextPopup();
            }
        }
        catch (error) {
            console.error('[PopupDisplay] Error showing popup:', error);
            this.scheduleNextPopup();
        }
    }
    // Fetch recommendations từ API
    async fetchRecommendations() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/recommendations?domainKey=${this.domainKey}&slot=${this.slotName}`);
            if (!response.ok) {
                throw new Error('API Error');
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error('[PopupDisplay] Error fetching recommendations:', error);
            // Fallback mock data for development
            return [
                {
                    id: 1,
                    name: 'Sản phẩm 1',
                    img: 'https://via.placeholder.com/180x130',
                    price: '199.000đ'
                },
                {
                    id: 2,
                    name: 'Sản phẩm 2',
                    img: 'https://via.placeholder.com/180x130',
                    price: '299.000đ'
                },
                {
                    id: 3,
                    name: 'Sản phẩm 3',
                    img: 'https://via.placeholder.com/180x130',
                    price: '399.000đ'
                }
            ];
        }
    }
    // Render popup với Shadow DOM
    renderPopup(items) {
        // Remove existing popup if any
        this.removePopup();
        // Create shadow host
        const host = document.createElement('div');
        host.id = 'recsys-popup-host';
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        // Add styles
        const style = document.createElement('style');
        style.textContent = this.getPopupStyles();
        shadow.appendChild(style);
        // Create popup structure
        const popup = document.createElement('div');
        popup.className = 'recsys-popup';
        popup.innerHTML = `
      <div class="recsys-header">
        Gợi ý dành cho bạn
        <button class="recsys-close">✕</button>
      </div>
      <div class="recsys-body">
        <button class="recsys-nav recsys-prev">◀</button>
        <div class="recsys-slide"></div>
        <button class="recsys-nav recsys-next">▶</button>
      </div>
    `;
        shadow.appendChild(popup);
        this.shadowHost = host;
        // Setup carousel
        this.setupCarousel(shadow, items);
        // Setup close button
        const closeBtn = shadow.querySelector('.recsys-close');
        closeBtn === null || closeBtn === void 0 ? void 0 : closeBtn.addEventListener('click', () => {
            if (this.autoSlideTimeout) {
                clearTimeout(this.autoSlideTimeout);
                this.autoSlideTimeout = null;
            }
            this.removePopup();
            this.scheduleNextPopup();
        });
    }
    // Setup carousel functionality
    setupCarousel(shadow, items) {
        let currentIndex = 0;
        const slideContainer = shadow.querySelector('.recsys-slide');
        const prevBtn = shadow.querySelector('.recsys-prev');
        const nextBtn = shadow.querySelector('.recsys-next');
        const renderSlide = () => {
            const item = items[currentIndex];
            const name = item.name || item.title || 'Sản phẩm';
            const img = item.img || item.image || '';
            slideContainer.innerHTML = `
        <div class="recsys-item" data-id="${item.id}">
          <img src="${img}" alt="${name}" />
          <div class="recsys-name">${name}</div>
          <div class="recsys-price">${item.price}</div>
        </div>
      `;
        };
        const next = () => {
            currentIndex = (currentIndex + 1) % items.length;
            renderSlide();
            resetAutoSlide();
        };
        const prev = () => {
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            renderSlide();
            resetAutoSlide();
        };
        const resetAutoSlide = () => {
            if (this.autoSlideTimeout) {
                clearTimeout(this.autoSlideTimeout);
            }
            this.autoSlideTimeout = setTimeout(next, this.AUTO_SLIDE_DELAY);
        };
        prevBtn === null || prevBtn === void 0 ? void 0 : prevBtn.addEventListener('click', prev);
        nextBtn === null || nextBtn === void 0 ? void 0 : nextBtn.addEventListener('click', next);
        // Click handler for items
        slideContainer === null || slideContainer === void 0 ? void 0 : slideContainer.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.recsys-item');
            if (itemEl) {
                const itemId = itemEl.getAttribute('data-id');
                console.log('[PopupDisplay] Item clicked:', itemId);
                // TODO: Track click event
            }
        });
        // Start carousel
        renderSlide();
        resetAutoSlide();
    }
    // Remove popup
    removePopup() {
        if (this.shadowHost) {
            this.shadowHost.remove();
            this.shadowHost = null;
        }
    }
    // Clear all timeouts
    clearTimeouts() {
        if (this.popupTimeout) {
            clearTimeout(this.popupTimeout);
            this.popupTimeout = null;
        }
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }
        if (this.autoSlideTimeout) {
            clearTimeout(this.autoSlideTimeout);
            this.autoSlideTimeout = null;
        }
    }
    // Get popup styles
    getPopupStyles() {
        return `
      :host { all: initial; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 340px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 28px rgba(0,0,0,0.25);
        z-index: 2147483647;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
        display: flex;
        flex-direction: column;
        border: 1px solid #e0e0e0;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .recsys-header {
        background: #111;
        color: #fff;
        padding: 12px 14px;
        font-size: 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .recsys-close {
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        opacity: 0.8;
        background: none;
        border: none;
        color: white;
        padding: 0;
      }

      .recsys-close:hover {
        opacity: 1;
      }

      .recsys-body {
        position: relative;
        height: 220px;
        background: #fff;
      }

      .recsys-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 20px;
        background: rgba(255,255,255,0.8);
        border: 1px solid #ddd;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: all 0.2s;
        color: #333;
        padding: 0;
      }

      .recsys-nav:hover {
        background: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }

      .recsys-prev {
        left: 10px;
      }

      .recsys-next {
        right: 10px;
      }

      .recsys-slide {
        text-align: center;
        padding: 15px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .recsys-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .recsys-item img {
        width: 180px;
        height: 130px;
        border-radius: 8px;
        object-fit: cover;
      }

      .recsys-name {
        font-size: 16px;
        font-weight: 600;
        margin: 5px 0 0;
        color: #333;
      }

      .recsys-price {
        font-size: 14px;
        color: #d10000;
        font-weight: bold;
      }
    `;
    }
}

class InlineDisplay {
    constructor(domainKey, slotName, selector, apiBaseUrl, config = {}) {
        this.observer = null;
        this.debounceTimer = null;
        this.domainKey = domainKey;
        this.slotName = slotName;
        this.selector = selector;
        this.apiBaseUrl = apiBaseUrl;
        this.config = {
            pages: config.pages || ['*'], // Default show on all pages
        };
    }
    // Bắt đầu inline display
    start() {
        console.log(`[InlineDisplay] Starting watcher for: "${this.selector}"`);
        // Kiểm tra page có được phép không
        if (!this.isPageAllowed(window.location.pathname)) {
            console.log('[InlineDisplay] Page not allowed');
            return;
        }
        // Quét lần đầu
        this.scanAndRender();
        // Setup MutationObserver để theo dõi DOM changes
        this.setupObserver();
    }
    // Dừng inline display
    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
    // Quét và render tất cả containers
    scanAndRender() {
        const containers = document.querySelectorAll(this.selector);
        containers.forEach(container => {
            this.processContainer(container);
        });
    }
    // Setup MutationObserver để theo dõi DOM changes
    setupObserver() {
        this.observer = new MutationObserver(() => {
            // Debounce để tránh xử lý quá nhiều
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.scanAndRender();
            }, 100);
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
    // Xử lý từng container
    async processContainer(container) {
        // Kiểm tra đã render chưa
        if (!container || container.getAttribute('data-recsys-loaded') === 'true') {
            return;
        }
        // Đánh dấu đã xử lý
        container.setAttribute('data-recsys-loaded', 'true');
        try {
            // Fetch recommendations
            const items = await this.fetchRecommendations();
            if (items && items.length > 0) {
                this.renderWidget(container, items);
            }
            else {
                console.log(`[InlineDisplay] No items for ${this.selector}`);
            }
        }
        catch (error) {
            console.error('[InlineDisplay] Error processing container:', error);
        }
    }
    // Kiểm tra page có được phép hiển thị không
    isPageAllowed(currentPath) {
        const allowedPatterns = this.config.pages || [];
        if (allowedPatterns.length === 0 || allowedPatterns.includes('*')) {
            return true;
        }
        return allowedPatterns.some(pattern => {
            if (pattern === '/')
                return currentPath === '/';
            // Hỗ trợ wildcard
            if (pattern.endsWith('/*')) {
                const base = pattern.slice(0, -2);
                return currentPath.startsWith(base);
            }
            return currentPath === pattern;
        });
    }
    // Fetch recommendations từ API
    async fetchRecommendations() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/recommendations?domainKey=${this.domainKey}&slot=${this.slotName}`);
            if (!response.ok) {
                throw new Error('API Error');
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error('[InlineDisplay] Error fetching recommendations:', error);
            // Fallback mock data for development
            return [
                {
                    id: 1,
                    name: 'Sản phẩm 1',
                    img: 'https://via.placeholder.com/150',
                    price: '199.000đ'
                },
                {
                    id: 2,
                    name: 'Sản phẩm 2',
                    img: 'https://via.placeholder.com/150',
                    price: '299.000đ'
                },
                {
                    id: 3,
                    name: 'Sản phẩm 3',
                    img: 'https://via.placeholder.com/150',
                    price: '399.000đ'
                },
                {
                    id: 4,
                    name: 'Sản phẩm 4',
                    img: 'https://via.placeholder.com/150',
                    price: '499.000đ'
                }
            ];
        }
    }
    // Render widget với Shadow DOM
    renderWidget(container, items) {
        try {
            // Setup Shadow DOM
            let shadow = container.shadowRoot;
            if (!shadow) {
                shadow = container.attachShadow({ mode: 'open' });
            }
            // Clear existing content
            shadow.innerHTML = '';
            // Add styles
            const style = document.createElement('style');
            style.textContent = this.getWidgetStyles();
            shadow.appendChild(style);
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'recsys-wrapper';
            // Create items
            items.forEach(item => {
                const name = item.name || item.title || 'Sản phẩm';
                const img = item.img || item.image || '';
                const itemEl = document.createElement('div');
                itemEl.className = 'recsys-item';
                itemEl.setAttribute('data-id', String(item.id));
                itemEl.innerHTML = `
          <div class="recsys-img-box">
            <img src="${img}" alt="${name}">
          </div>
          <div class="recsys-info">
            <div class="recsys-title">${name}</div>
            <div class="recsys-price">${item.price}</div>
          </div>
        `;
                wrapper.appendChild(itemEl);
            });
            shadow.appendChild(wrapper);
            // Setup click handler
            wrapper.addEventListener('click', (e) => {
                const itemEl = e.target.closest('.recsys-item');
                if (itemEl) {
                    const itemId = itemEl.getAttribute('data-id');
                    console.log('[InlineDisplay] Item clicked:', itemId);
                    // TODO: Track click event
                }
            });
        }
        catch (error) {
            console.error('[InlineDisplay] Error rendering widget:', error);
        }
    }
    // Get widget styles
    getWidgetStyles() {
        return `
      :host {
        display: block;
        all: initial;
        font-family: Arial, sans-serif;
        width: 100%;
      }
      * {
        box-sizing: border-box;
      }

      .recsys-wrapper {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 16px;
        padding: 10px 0;
      }

      .recsys-item {
        border: 1px solid #eee;
        border-radius: 8px;
        overflow: hidden;
        background: #fff;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        flex-direction: column;
      }

      .recsys-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }

      .recsys-img-box {
        width: 100%;
        padding-top: 100%;
        position: relative;
        background: #f9f9f9;
      }

      .recsys-img-box img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .recsys-info {
        padding: 10px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
      }

      .recsys-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .recsys-price {
        font-size: 14px;
        color: #d0021b;
        font-weight: bold;
        margin-top: auto;
      }
    `;
    }
}

class DisplayManager {
    constructor(domainKey, apiBaseUrl = 'http://localhost:3000') {
        this.popupDisplay = null;
        this.inlineDisplay = null;
        this.domainKey = domainKey;
        this.apiBaseUrl = apiBaseUrl;
    }
    // Khởi tạo display methods dựa trên config
    initialize(returnMethods) {
        if (!returnMethods || returnMethods.length === 0) {
            console.log('[DisplayManager] No return methods configured');
            return;
        }
        returnMethods.forEach(method => {
            this.activateDisplayMethod(method);
        });
    }
    // Kích hoạt display method tương ứng
    activateDisplayMethod(method) {
        const { returnType, configurationName, value } = method;
        switch (returnType) {
            case 'POPUP': // Popup
                this.initializePopup(configurationName, value);
                break;
            case 'INLINE-INJECTION': // Inline
                this.initializeInline(configurationName, value);
                break;
            default:
                console.warn(`[DisplayManager] Unknown returnType: ${returnType}`);
        }
    }
    // Khởi tạo Popup Display
    initializePopup(slotName, config) {
        try {
            // Parse config nếu là JSON string, nếu không thì dùng default
            let popupConfig = {};
            if (config) {
                try {
                    popupConfig = JSON.parse(config);
                }
                catch {
                    popupConfig = {};
                }
            }
            this.popupDisplay = new PopupDisplay(this.domainKey, slotName, this.apiBaseUrl, popupConfig);
            this.popupDisplay.start();
            console.log(`[DisplayManager] Popup initialized for slot: ${slotName}`);
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing popup:', error);
        }
    }
    // Khởi tạo Inline Display
    initializeInline(slotName, selector) {
        try {
            if (!selector) {
                console.warn('[DisplayManager] Inline display requires a selector');
                return;
            }
            this.inlineDisplay = new InlineDisplay(this.domainKey, slotName, selector, this.apiBaseUrl);
            this.inlineDisplay.start();
            console.log(`[DisplayManager] Inline initialized for slot: ${slotName}, selector: ${selector}`);
        }
        catch (error) {
            console.error('[DisplayManager] Error initializing inline:', error);
        }
    }
    // Dừng tất cả display methods
    destroy() {
        if (this.popupDisplay) {
            this.popupDisplay.stop();
            this.popupDisplay = null;
        }
        if (this.inlineDisplay) {
            this.inlineDisplay.stop();
            this.inlineDisplay = null;
        }
    }
}

class BasePlugin {
    constructor() {
        this.tracker = null;
        this.active = false;
        this.payloadBuilder = null;
        this.errorBoundary = new ErrorBoundary(true);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                return;
            }
            this.tracker = tracker;
            this.payloadBuilder = tracker.payloadBuilder;
        }, `${this.name}.init`);
    }
    stop() {
        this.errorBoundary.execute(() => {
            this.active = false;
            console.log(`[${this.name}] Plugin stopped`);
        }, `${this.name}.stop`);
    }
    destroy() {
        this.errorBoundary.execute(() => {
            this.stop();
            this.tracker = null;
            console.log(`[${this.name}] Plugin destroyed`);
        }, `${this.name}.destroy`);
    }
    isActive() {
        return this.active;
    }
    ensureInitialized() {
        if (!this.tracker) {
            console.error(`[${this.name}] Plugin not initialized. Call init() first.`);
            return false;
        }
        return true;
    }
    // Wrap event handlers with error boundary
    wrapHandler(handler, handlerName = 'handler') {
        return this.errorBoundary.wrap(handler, `${this.name}.${handlerName}`);
    }
    // Wrap async event handlers with error boundary
    wrapAsyncHandler(handler, handlerName = 'asyncHandler') {
        return this.errorBoundary.wrapAsync(handler, `${this.name}.${handlerName}`);
    }
    // Xử lý thông tin user, item, rating/review_value từ extracted data
    resolvePayloadIdentity(extractedData) {
        // Common user field patterns (prioritized)
        const userFieldPatterns = ['UserId', 'Username'];
        // Common item field patterns (prioritized)
        const itemFieldPatterns = ['ItemId', 'ItemTitle'];
        // Common rating/review_value patterns (prioritized)
        const valuePatterns = ['Value'];
        let userField = 'UserId';
        let userValue = '';
        let itemField = 'ItemId';
        let itemValue = '';
        let value = '';
        // Find first available user field
        for (const key of Object.keys(extractedData)) {
            if (!userValue && userFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                userField = key;
                userValue = extractedData[key];
            }
            if (!itemValue && itemFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                itemField = key;
                itemValue = extractedData[key];
            }
            if (!value && valuePatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
                value = key;
                value = extractedData[key];
            }
            if (userValue && itemValue && value)
                break;
        }
        return { userField, userValue, itemField, itemValue, value };
    }
    /**
     * Phương thức xây dựng và theo dõi payload
     * Extraction → identity resolution → payload construction → tracking
     *
     * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
     * @param rule - Tracking rule with payload mappings
     * @param eventId - Event type ID
     * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
     */
    buildAndTrack(context, rule, eventId, additionalFields) {
        if (!this.tracker) {
            console.warn(`[${this.name}] Cannot track: tracker not initialized`);
            return;
        }
        // 1. Extract data using PayloadBuilder
        const extractedData = this.tracker.payloadBuilder.build(context, rule);
        // 2. Resolve identity fields dynamically
        const { userField, userValue, itemField, itemValue, value } = this.resolvePayloadIdentity(extractedData);
        // 3. Construct payload
        const payload = {
            eventTypeId: eventId,
            trackingRuleId: rule.id,
            userField,
            userValue,
            itemField,
            itemValue,
            value,
            ...additionalFields
        };
        // 4. Track the event
        this.tracker.track(payload);
    }
}

class PluginManager {
    constructor(tracker) {
        this.plugins = new Map();
        this.tracker = tracker;
        this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
    }
    // Register a plugin
    register(plugin) {
        this.errorBoundary.execute(() => {
            if (this.plugins.has(plugin.name)) {
                return;
            }
            plugin.init(this.tracker);
            this.plugins.set(plugin.name, plugin);
        }, 'PluginManager.register');
    }
    // Unregister a plugin
    unregister(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.destroy();
            this.plugins.delete(pluginName);
            console.log(`[PluginManager] Unregistered plugin: ${pluginName}`);
            return true;
        }, 'PluginManager.unregister')) !== null && _a !== void 0 ? _a : false;
    }
    // Start a specific plugin
    start(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.start();
            return true;
        }, 'PluginManager.start')) !== null && _a !== void 0 ? _a : false;
    }
    // Stop a specific plugin
    stop(pluginName) {
        var _a;
        return (_a = this.errorBoundary.execute(() => {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                console.warn(`[PluginManager] Plugin "${pluginName}" not found`);
                return false;
            }
            plugin.stop();
            return true;
        }, 'PluginManager.stop')) !== null && _a !== void 0 ? _a : false;
    }
    // Start all registered plugins
    startAll() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Starting ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                if (!plugin.isActive()) {
                    plugin.start();
                }
            });
        }, 'PluginManager.startAll');
    }
    // Stop all registered plugins
    stopAll() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Stopping ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                if (plugin.isActive()) {
                    plugin.stop();
                }
            });
        }, 'PluginManager.stopAll');
    }
    // Get a plugin by name
    get(pluginName) {
        return this.plugins.get(pluginName);
    }
    // Check if a plugin is registered
    has(pluginName) {
        return this.plugins.has(pluginName);
    }
    // Get all registered plugin names
    getPluginNames() {
        return Array.from(this.plugins.keys());
    }
    // Get plugin status
    getStatus() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            active: plugin.isActive(),
        }));
    }
    // Destroy all plugins and cleanup
    destroy() {
        this.errorBoundary.execute(() => {
            console.log(`[PluginManager] Destroying ${this.plugins.size} plugin(s)...`);
            this.plugins.forEach((plugin) => {
                plugin.destroy();
            });
            this.plugins.clear();
        }, 'PluginManager.destroy');
    }
}

function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    let lastArgs = null;
    return function (...args) {
        const now = Date.now();
        lastArgs = args;
        const remaining = delay - (now - lastCall);
        const context = this;
        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn.apply(context, args);
        }
        else if (!timeoutId) {
            timeoutId = window.setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(context, lastArgs);
            }, remaining);
        }
    };
}
const CUSTOM_ROUTE_EVENT = "recsys_route_change";

class ClickPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'ClickPlugin';
        this.THROTTLE_DELAY = 300;
        // Wrap handler với error boundary ngay trong constructor
        this.throttledHandler = throttle(this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'), this.THROTTLE_DELAY);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[ClickPlugin] initialized for Rule.`);
        }, 'ClickPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            if (this.tracker) {
                document.addEventListener("click", this.throttledHandler, false);
                console.log("[ClickPlugin] started listening for Click events.");
                this.active = true;
            }
        }, 'ClickPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('click', this.throttledHandler);
            }
            super.destroy();
        }, 'ClickPlugin.destroy');
    }
    handleDocumentClick(event) {
        if (!this.tracker)
            return;
        const eventId = this.tracker.getEventTypeId('Click');
        if (!eventId)
            return;
        const config = this.tracker.getConfig();
        if (!config || !config.trackingRules)
            return;
        const clickRules = config.trackingRules.filter(r => r.eventTypeId === eventId);
        if (clickRules.length === 0) {
            return;
        }
        // Loop qua tất cả click rules và check match
        for (const rule of clickRules) {
            const selector = rule.trackingTarget.value;
            if (!selector)
                continue;
            const matchedElement = event.target.closest(selector);
            if (matchedElement) {
                console.log(`[ClickPlugin] Matched rule: ${rule.name}`);
                // Use centralized build and track
                this.buildAndTrack(matchedElement, rule, eventId);
                // Stop after first match
                break;
            }
        }
    }
}

var clickPlugin = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ClickPlugin: ClickPlugin
});

class PageViewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'PageViewPlugin';
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[PageViewPlugin] initialized.`);
        }, 'PageViewPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            const wrappedHandler = this.wrapHandler(this.handlePageChange.bind(this), 'handlePageChange');
            window.addEventListener("popstate", wrappedHandler);
            {
                window.addEventListener(CUSTOM_ROUTE_EVENT, wrappedHandler);
            }
            this.trackCurrentPage(window.location.href);
            console.log("[PageViewPlugin] started listening and tracked initial load.");
            this.active = true;
        }, 'PageViewPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            const wrappedHandler = this.wrapHandler(this.handlePageChange.bind(this), 'handlePageChange');
            window.removeEventListener("popstate", wrappedHandler);
            {
                window.removeEventListener(CUSTOM_ROUTE_EVENT, wrappedHandler);
            }
            super.stop();
        }, 'PageViewPlugin.stop');
    }
    handlePageChange() {
        setTimeout(() => {
            this.trackCurrentPage(window.location.href);
        }, 0);
    }
    trackCurrentPage(currentUrl) {
        var _a, _b;
        if (!this.tracker)
            return;
        const urlObject = new URL(currentUrl);
        const pathname = urlObject.pathname;
        const eventId = this.tracker.getEventTypeId('Page View');
        if (!eventId) {
            console.log('[PageViewPlugin] Page View event type not found in config.');
            return;
        }
        const config = this.tracker.getConfig();
        const pageViewRules = (_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId);
        if (!pageViewRules || pageViewRules.length === 0) {
            console.log('[PageViewPlugin] No page view rules configured.');
            return;
        }
        // Loop qua tất cả rules và tìm rule phù hợp
        for (const rule of pageViewRules) {
            let matchFound = false;
            const selector = ((_b = rule.trackingTarget) === null || _b === void 0 ? void 0 : _b.value) || '';
            // Determine payload extractor logic from rule
            const isRegex = selector.startsWith('^');
            // Regex-based matching (URL pattern)
            if (isRegex) {
                const pattern = new RegExp(selector);
                const match = pathname.match(pattern);
                if (match) {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched regex rule: ${rule.name}`);
                }
            }
            // DOM selector matching (Checking presence of element on page)
            else if (selector && selector !== 'body') {
                if (document.querySelector(selector)) {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched DOM selector rule: ${rule.name}`);
                }
            }
            // Default body matching
            else if (selector === 'body') {
                matchFound = true;
                console.log(`[PageViewPlugin] ✅ Matched default rule: ${rule.name}`);
            }
            if (matchFound) {
                // Use centralized build and track
                this.buildAndTrack(document.body, rule, eventId);
                return;
            }
        }
        console.log('[PageViewPlugin] ⏸️ No matching rule found for current URL/DOM.');
    }
}

var pageViewPlugin = /*#__PURE__*/Object.freeze({
    __proto__: null,
    PageViewPlugin: PageViewPlugin
});

const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };
const CONDITION_PATTERN_ID = { CSS_SELECTOR: 1, URL: 2, DATA_ATTRIBUTE: 3 };
const OPERATOR_ID = { CONTAINS: 1, EQUALS: 2, STARTS_WITH: 3, ENDS_WITH: 4 };
class ReviewPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ReviewPlugin';
        this.handleSubmitBound = this.handleSubmit.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[ReviewPlugin] initialized.`);
        }, 'ReviewPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            console.log("[ReviewPlugin] started listening for Review submissions.");
            this.active = true;
        }, 'ReviewPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            if (this.tracker) {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            }
            super.stop();
        }, 'ReviewPlugin.stop'); // Using stop/destroy consistency?
    }
    handleSubmit(event) {
        var _a;
        console.log("🔥 [ReviewPlugin] Detected SUBMIT event!");
        if (!this.tracker)
            return;
        const form = event.target;
        console.log(`📝 [ReviewPlugin] Checking form: #${form.id} (Classes: ${form.className})`);
        // Trigger ID for Review is typically 3 (or configured)
        const eventId = this.tracker.getEventTypeId('Review') || 3;
        const config = this.tracker.getConfig();
        const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        console.log(`🔎 [ReviewPlugin] Found ${reviewRules.length} rules for TriggerID=${eventId}`);
        if (reviewRules.length === 0)
            return;
        for (const rule of reviewRules) {
            // 1. Check Target
            if (!this.checkTargetMatch(form, rule))
                continue;
            // 2. Check Condition
            if (!this.checkConditions(form, rule))
                continue;
            console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);
            // 3. Auto-detect review content if needed
            const reviewContent = this.autoDetectReviewContent(form);
            console.log(`[ReviewPlugin] Detected review content: "${reviewContent}"`);
            // 4. Build and track using centralized method
            this.buildAndTrack(form, rule, eventId, {
                metadata: {
                    additionalValues: reviewContent,
                    captureMethod: 'form-submit',
                    source: 'review-plugin'
                }
            });
            console.log(`[ReviewPlugin] 📤 Event tracked successfully`);
            return;
        }
        console.log("❌ [ReviewPlugin] No rules matched the current form.");
    }
    checkTargetMatch(form, rule) {
        const target = rule.targetElement;
        if (!target)
            return false;
        const patternId = Number(target.targetEventPatternId);
        if (patternId !== TARGET_PATTERN_ID.CSS_SELECTOR)
            return false;
        try {
            return form.matches(target.targetElementValue);
        }
        catch {
            return false;
        }
    }
    checkConditions(form, rule) {
        const conditions = rule.conditions;
        if (!conditions || conditions.length === 0)
            return true;
        for (const cond of conditions) {
            const pattern = Number(cond.eventPatternId);
            const operator = Number(cond.operatorId);
            const val = cond.value;
            let actual = null;
            let isMet = false;
            switch (pattern) {
                case CONDITION_PATTERN_ID.URL:
                    actual = location.href;
                    break;
                case CONDITION_PATTERN_ID.CSS_SELECTOR:
                    try {
                        isMet = form.matches(val);
                        actual = isMet ? 'true' : 'false';
                    }
                    catch {
                        return false;
                    }
                    break;
                case CONDITION_PATTERN_ID.DATA_ATTRIBUTE:
                    actual = form.getAttribute(val);
                    break;
            }
            if (pattern === CONDITION_PATTERN_ID.CSS_SELECTOR)
                continue;
            if (!this.compareValues(actual, val, operator))
                return false;
        }
        return true;
    }
    autoDetectReviewContent(form) {
        const formData = new FormData(form);
        let content = '';
        for (const [key, val] of formData) {
            const k = key.toLowerCase();
            const vStr = String(val);
            if (k.includes('review') || k.includes('comment') || k.includes('body') || k.includes('content')) {
                if (vStr.length > content.length)
                    content = vStr;
            }
        }
        return content;
    }
    compareValues(actual, expected, op) {
        if (!actual)
            actual = '';
        if (op === OPERATOR_ID.EQUALS)
            return actual == expected;
        if (op === OPERATOR_ID.CONTAINS)
            return actual.includes(expected);
        if (op === OPERATOR_ID.STARTS_WITH)
            return actual.startsWith(expected);
        if (op === OPERATOR_ID.ENDS_WITH)
            return actual.endsWith(expected);
        return false;
    }
}

var reviewPlugin = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ReviewPlugin: ReviewPlugin
});

// CONDITION PATTERNS
const CONDITION_PATTERN = { CSS_SELECTOR: 1, URL: 2, DATA_ATTRIBUTE: 3 };
// OPERATORS
const TARGET_OPERATOR = { CONTAINS: 1, EQUALS: 2, STARTS_WITH: 3, ENDS_WITH: 4 };
class ScrollPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ScrollPlugin';
        // --- STATE MANAGEMENT ---
        this.milestones = [25, 50, 75, 100];
        this.sentMilestones = new Set();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = true;
        this.currentItemContext = null;
        this.activeRule = null;
        this.targetScrollElement = null;
        this.lastScrollProcessTime = 0;
        this.THROTTLE_MS = 200;
        this.handleScrollBound = this.handleScroll.bind(this);
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        this.handleUnloadBound = this.handleUnload.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[ScrollPlugin] initialized.`);
        }, 'ScrollPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            this.resetState();
            const isResolved = this.resolveContextFromRules();
            if (isResolved) {
                const target = this.targetScrollElement || window;
                target.addEventListener('scroll', this.handleScrollBound, { passive: true });
                document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
                window.addEventListener('beforeunload', this.handleUnloadBound);
                console.log(`[ScrollPlugin] Started. Target:`, this.targetScrollElement ? 'Specific Element' : 'Window');
                this.active = true;
            }
            else {
                console.log(`[ScrollPlugin] No matching rule found for this page. Idle.`);
            }
        }, 'ScrollPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            const target = this.targetScrollElement || window;
            target.removeEventListener('scroll', this.handleScrollBound);
            document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
            window.removeEventListener('beforeunload', this.handleUnloadBound);
            super.stop();
        }, 'ScrollPlugin.stop');
    }
    resetState() {
        this.sentMilestones.clear();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = document.visibilityState === 'visible';
        this.currentItemContext = null;
        this.activeRule = null;
        this.targetScrollElement = null;
    }
    resolveContextFromRules() {
        var _a;
        if (!this.tracker)
            return false;
        const eventId = this.tracker.getEventTypeId('Scroll') || 4;
        const config = this.tracker.getConfig();
        const scrollRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
        if (scrollRules.length === 0)
            return false;
        console.log(`📜 [ScrollPlugin] Checking ${scrollRules.length} rules...`);
        for (const rule of scrollRules) {
            const element = this.findTargetElement(rule);
            if (element) {
                const representativeEl = (element instanceof Window) ? document.body : element;
                if (this.checkConditions(representativeEl, rule)) {
                    this.activeRule = rule;
                    this.targetScrollElement = (element instanceof Window) ? null : element;
                    console.log(`✅ [ScrollPlugin] Rule Matched: "${rule.name}"`);
                    this.detectContextForItem(representativeEl);
                    return true;
                }
            }
        }
        return false;
    }
    findTargetElement(rule) {
        const target = rule.targetElement || rule.TargetElement;
        if (!target || !target.targetElementValue || target.targetElementValue === 'document' || target.targetElementValue === 'window') {
            return window;
        }
        const selector = target.targetElementValue || target.Value;
        try {
            const el = document.querySelector(selector);
            return el;
        }
        catch {
            return null;
        }
    }
    detectContextForItem(element) {
        console.log("🔍 [ScrollPlugin] Scanning for context...");
        const contextInfo = this.scanSurroundingContext(element);
        if (contextInfo.id) {
            this.currentItemContext = {
                id: contextInfo.id,
                name: contextInfo.name || 'Unknown Item',
                type: contextInfo.type || 'item',
                confidence: 1,
                source: contextInfo.source,
                context: 'dom_context'
            };
        }
        else {
            this.currentItemContext = this.createSyntheticItem();
        }
        console.log("🎯 [ScrollPlugin] Resolved Context:", this.currentItemContext);
    }
    checkConditions(element, rule) {
        const conditions = rule.Conditions || rule.conditions;
        if (!conditions || conditions.length === 0)
            return true;
        for (const condition of conditions) {
            const patternId = condition.EventPatternID || condition.eventPatternId || 1;
            const operatorId = condition.OperatorID || condition.operatorId || 5;
            const expectedValue = condition.Value || condition.value || '';
            let actualValue = null;
            let isMet = false;
            switch (patternId) {
                case CONDITION_PATTERN.URL:
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has(expectedValue))
                        actualValue = urlParams.get(expectedValue);
                    else
                        actualValue = window.location.href;
                    break;
                case CONDITION_PATTERN.CSS_SELECTOR:
                    try {
                        isMet = element.matches(expectedValue);
                        if (!isMet)
                            return false;
                        continue;
                    }
                    catch {
                        return false;
                    }
                case CONDITION_PATTERN.DATA_ATTRIBUTE:
                    actualValue = element.getAttribute(expectedValue);
                    break;
                default: actualValue = '';
            }
            isMet = this.compareValues(actualValue, expectedValue, operatorId);
            if (!isMet)
                return false;
        }
        return true;
    }
    compareValues(actual, expected, operatorId) {
        if (actual === null)
            actual = '';
        switch (operatorId) {
            case TARGET_OPERATOR.EQUALS: return actual === expected;
            case TARGET_OPERATOR.CONTAINS: return actual.includes(expected);
            case TARGET_OPERATOR.STARTS_WITH: return actual.startsWith(expected);
            case TARGET_OPERATOR.ENDS_WITH: return actual.endsWith(expected);
            default: return actual === expected;
        }
    }
    scanSurroundingContext(element) {
        const getAttrs = (el) => {
            if (!el)
                return null;
            const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
            if (id)
                return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
            return null;
        };
        const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
        const ancestorData = getAttrs(ancestor);
        if (ancestorData)
            return { ...ancestorData, source: 'ancestor' };
        let currentParent = element.parentElement;
        let levels = 0;
        while (currentParent && levels < 5) {
            const candidates = currentParent.querySelectorAll('[data-item-id], [data-product-id], [data-id]');
            if (candidates.length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    if (!element.contains(candidate)) {
                        const data = getAttrs(candidate);
                        if (data)
                            return { ...data, source: `scope_level_${levels + 1}` };
                    }
                }
            }
            currentParent = currentParent.parentElement;
            levels++;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('productId');
        if (urlId)
            return { id: urlId, source: 'url_param' };
        return { id: undefined, source: 'none' };
    }
    handleScroll() {
        const now = Date.now();
        if (now - this.lastScrollProcessTime < this.THROTTLE_MS)
            return;
        this.lastScrollProcessTime = now;
        let scrollTop, docHeight, clientHeight;
        if (this.targetScrollElement instanceof HTMLElement) {
            scrollTop = this.targetScrollElement.scrollTop;
            docHeight = this.targetScrollElement.scrollHeight;
            clientHeight = this.targetScrollElement.clientHeight;
        }
        else {
            scrollTop = window.scrollY || document.documentElement.scrollTop;
            docHeight = document.documentElement.scrollHeight;
            clientHeight = window.innerHeight;
        }
        const currentPercent = Math.min(100, Math.round(((scrollTop + clientHeight) / docHeight) * 100));
        if (currentPercent > this.maxScrollDepth)
            this.maxScrollDepth = currentPercent;
        this.milestones.forEach(milestone => {
            if (currentPercent >= milestone && !this.sentMilestones.has(milestone)) {
                this.sendScrollEvent(milestone);
                this.sentMilestones.add(milestone);
            }
        });
    }
    sendScrollEvent(depth) {
        var _a;
        if (!this.tracker)
            return;
        const rule = this.activeRule || this.createDefaultRule('default-scroll', 'Default Scroll');
        const currentActiveSeconds = this.calculateActiveTime();
        // Extract via PayloadBuilder
        const extracted = this.tracker.payloadBuilder.build(this.currentItemContext, rule);
        // Build Payload
        const payload = {
            eventTypeId: rule.eventTypeId || 4, // Default Scroll ID
            trackingRuleId: rule.id,
            userField: 'userId',
            userValue: extracted['userId'] || extracted['User'] || '',
            itemField: 'itemId',
            itemValue: extracted['itemId'] || extracted['Item'] || ((_a = this.currentItemContext) === null || _a === void 0 ? void 0 : _a.id) || 'N/A',
            // Metadata
            metadata: {
                depth_percentage: depth,
                time_on_page: currentActiveSeconds,
                url: window.location.href,
                ...extracted // Merge extracted
            }
        };
        this.tracker.track(payload);
    }
    handleUnload() {
        var _a;
        if (!this.tracker)
            return;
        if (this.isTabVisible)
            this.totalActiveTime += Date.now() - this.startTime;
        const finalTime = parseFloat((this.totalActiveTime / 1000).toFixed(1));
        if (finalTime < 1)
            return;
        const rule = this.activeRule || this.createDefaultRule('summary', 'Page Summary');
        if (!this.currentItemContext)
            this.currentItemContext = this.createSyntheticItem();
        // Extract
        const extracted = this.tracker.payloadBuilder.build(this.currentItemContext, rule);
        const payload = {
            eventTypeId: rule.eventTypeId || 4,
            trackingRuleId: rule.id,
            userField: 'userId',
            userValue: extracted['userId'] || '',
            itemField: 'itemId',
            itemValue: extracted['itemId'] || ((_a = this.currentItemContext) === null || _a === void 0 ? void 0 : _a.id) || 'N/A',
            metadata: {
                max_scroll_depth: this.maxScrollDepth,
                total_time_on_page: finalTime,
                is_bounce: this.maxScrollDepth < 25 && finalTime < 5,
                event: 'page_summary'
            }
        };
        this.tracker.track(payload);
    }
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.totalActiveTime += Date.now() - this.startTime;
            this.isTabVisible = false;
        }
        else {
            this.startTime = Date.now();
            this.isTabVisible = true;
        }
    }
    calculateActiveTime() {
        let currentSessionTime = 0;
        if (this.isTabVisible)
            currentSessionTime = Date.now() - this.startTime;
        const totalMs = this.totalActiveTime + currentSessionTime;
        return parseFloat((totalMs / 1000).toFixed(1));
    }
    createSyntheticItem() {
        return {
            id: 'page_scroll_' + Date.now(),
            name: document.title || 'General Page',
            type: 'page_view',
            confidence: 1,
            source: 'synthetic_page'
        };
    }
    createDefaultRule(id, name) {
        return {
            id, name, eventTypeId: 4,
            targetElement: { targetElementValue: 'document', targetEventPatternId: 1, targetOperatorId: 5 },
            conditions: [], payloadMappings: [] // Empty mappings
        };
    }
}

var scrollPlugin = /*#__PURE__*/Object.freeze({
    __proto__: null,
    ScrollPlugin: ScrollPlugin
});

class ElementExtractor {
    extract(mapping, context) {
        const startElement = (context instanceof HTMLElement) ? context : document.body;
        const selector = mapping.value; // The selector e.g. ".title"
        if (!selector)
            return null;
        try {
            // 1. Tìm element trong phạm vi context
            let target = startElement.querySelector(selector);
            // 2. Nếu không tìm thấy và context không phải là body, tìm trong toàn bộ document
            if (!target && startElement !== document.body) {
                target = document.querySelector(selector);
            }
            // 3. Radar / Proximity Scan
            // Nếu exact selector fails, dùng "Radar" logic. 
            // Dùng Value để biết css selector... bắt ngay selector đó
            // Hoặc bắt xung quanh gần nhất nếu fail
            if (!target) {
                target = this.findClosestBySelector(startElement, selector);
            }
            if (target) {
                return this.getValueFromElement(target);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    getValueFromElement(element) {
        if (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement) {
            return element.value;
        }
        return element.innerText || element.textContent || null;
    }
    findClosestBySelector(startElement, selector) {
        // Try going up parents and searching down
        let parent = startElement.parentElement;
        let levels = 0;
        while (parent && levels < 3) {
            const found = parent.querySelector(selector);
            if (found)
                return found;
            parent = parent.parentElement;
            levels++;
        }
        return null;
    }
}

class PathMatcher {
    /**
     * Parse pattern like '/api/user/:id' into regex and segment config
     */
    static compile(pattern) {
        const keys = [];
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
    static match(url, pattern) {
        // Normalize Path from URL
        let path = url.split('?')[0];
        try {
            if (path.startsWith('http')) {
                const urlObj = new URL(path);
                path = urlObj.pathname;
            }
        }
        catch { }
        // Ensure path starts with /
        if (!path.startsWith('/'))
            path = '/' + path;
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
    static matchStaticSegments(url, pattern) {
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

/**
 * NetworkExtractor handles:
 * 1. Extracting data from network request/response (extract method)
 * 2. Network tracking via XHR/Fetch hooking (enableTracking/disableTracking)
 * 3. Matching network requests against rules and dispatching events
 */
class NetworkExtractor {
    constructor() {
        this.isTrackingActive = false;
        this.trackerConfig = null;
    }
    /**
     * Extract data from network request/response based on mapping
     * This is called by PayloadBuilder when processing network_request mappings
     */
    extract(mapping, context) {
        var _a;
        if (!context)
            return null;
        // Validate Context Type mapping if needed, or assume caller provides correct context
        // Check if mapping matches context URL (basic validation)
        if (mapping.requestUrlPattern && context.url) {
            if (!this.matchesUrl(context.url, mapping.requestUrlPattern)) {
                return null;
            }
        }
        const source = (mapping.source || '').toLowerCase();
        const path = mapping.value || mapping.requestBodyPath; // Backward compat or direct value
        if (!path)
            return null;
        if (source === 'requestbody' || source === 'request_body') {
            return this.traverseObject(context.reqBody, path);
        }
        if (source === 'responsebody' || source === 'response_body') {
            return this.traverseObject(context.resBody, path);
        }
        if (source === 'network_request') {
            // Smart inference based on HTTP method
            const method = (_a = context.method) === null || _a === void 0 ? void 0 : _a.toUpperCase();
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

class StorageExtractor {
    extract(mapping, _context) {
        try {
            const source = (mapping.source || '').toLowerCase();
            const keyPath = mapping.value;
            if (!keyPath)
                return null;
            if (source === 'local_storage') {
                return this.extractFromStorage(window.localStorage, keyPath);
            }
            if (source === 'session_storage') {
                return this.extractFromStorage(window.sessionStorage, keyPath);
            }
            if (source === 'cookie') {
                return this.extractFromCookie(keyPath);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    extractFromStorage(storage, keyPath) {
        if (!storage || !keyPath)
            return null;
        const cleanKey = keyPath.trim();
        // Split key.path
        const parts = cleanKey.split('.');
        const rootKey = parts[0];
        const rawVal = storage.getItem(rootKey);
        if (!rawVal)
            return null;
        if (parts.length === 1)
            return rawVal;
        return this.getNestedValue(rawVal, parts.slice(1).join('.'));
    }
    extractFromCookie(keyPath) {
        if (typeof document === 'undefined' || !document.cookie)
            return null;
        const parts = keyPath.trim().split('.');
        const cookieName = parts[0];
        const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
        if (!match)
            return null;
        const cookieVal = decodeURIComponent(match[2]);
        if (parts.length === 1)
            return cookieVal;
        return this.getNestedValue(cookieVal, parts.slice(1).join('.'));
    }
    getNestedValue(jsonString, path) {
        try {
            let obj = JSON.parse(jsonString);
            const keys = path.split('.');
            for (const key of keys) {
                if (obj && typeof obj === 'object' && key in obj) {
                    obj = obj[key];
                }
                else {
                    return null;
                }
            }
            return (typeof obj === 'object') ? JSON.stringify(obj) : String(obj);
        }
        catch {
            return null;
        }
    }
}

class UrlExtractor {
    extract(mapping, _context) {
        try {
            const urlPart = mapping.urlPart || '';
            const urlPartValue = mapping.urlPartValue;
            if (!urlPart)
                return null;
            const currentUrl = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
            // 1. Query Param
            if (urlPart === 'query_param') {
                if (!urlPartValue)
                    return null;
                return currentUrl.searchParams.get(urlPartValue);
            }
            // 2. Pathname Segment
            if (urlPart === 'pathname') {
                if (!urlPartValue)
                    return null;
                const index = parseInt(urlPartValue, 10);
                if (isNaN(index))
                    return null;
                const segments = currentUrl.pathname.split('/').filter(s => s.length > 0);
                // Adjust for 0-index or 1-index based on convention. 
                // Assuming 0-index for internal array, but user might pass 1-based index? 
                // Let's assume 0-indexed based on typical dev usage, or handle bounds.
                if (index >= 0 && index < segments.length) {
                    return segments[index];
                }
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
}

class PayloadBuilder {
    constructor() {
        this.extractors = new Map();
        this.trackerConfig = null;
        this.elementExtractor = new ElementExtractor();
        this.networkExtractor = new NetworkExtractor();
        this.storageExtractor = new StorageExtractor();
        this.urlExtractor = new UrlExtractor();
        this.registerExtractors();
    }
    registerExtractors() {
        // Element
        this.extractors.set('element', this.elementExtractor);
        // Network
        this.extractors.set('request_body', this.networkExtractor);
        this.extractors.set('requestbody', this.networkExtractor);
        this.extractors.set('response_body', this.networkExtractor);
        this.extractors.set('responsebody', this.networkExtractor);
        this.extractors.set('network_request', this.networkExtractor);
        // Url
        this.extractors.set('url', this.urlExtractor);
        // Storage
        this.extractors.set('cookie', this.storageExtractor);
        this.extractors.set('local_storage', this.storageExtractor);
        this.extractors.set('session_storage', this.storageExtractor);
    }
    // Tạo payload dựa trên rule và context
    build(context, rule) {
        const payload = {};
        if (!rule || !rule.payloadMappings || rule.payloadMappings.length === 0) {
            return payload;
        }
        for (const mapping of rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            let val = null;
            // Chọn Extractor dựa trên source
            const extractor = this.extractors.get(source);
            if (extractor) {
                val = extractor.extract(mapping, context);
            }
            if (this.isValid(val)) {
                payload[mapping.field] = val;
            }
        }
        return payload;
    }
    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    setConfig(config) {
        this.trackerConfig = config;
        this.checkAndEnableNetworkTracking();
    }
    /**
     * Check if config has network rules and enable tracking if needed
     */
    checkAndEnableNetworkTracking() {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        const hasNetworkRules = this.trackerConfig.trackingRules.some((rule) => rule.payloadMappings && rule.payloadMappings.some((m) => {
            const source = (m.source || '').toLowerCase();
            return source === 'request_body';
        }));
        if (hasNetworkRules && !this.networkExtractor.isTracking()) {
            this.enableNetworkTracking();
        }
        else if (!hasNetworkRules && this.networkExtractor.isTracking()) {
            this.disableNetworkTracking();
        }
    }
    /**
     * Enable network tracking
     */
    enableNetworkTracking() {
        if (!this.trackerConfig) {
            console.warn('[PayloadBuilder] Cannot enable network tracking: config not set');
            return;
        }
        this.networkExtractor.enableTracking(this.trackerConfig, (rule, extractedData, context) => {
            // Callback when network request matches a rule
            // This can be extended to dispatch events or perform other actions
            console.log('[PayloadBuilder] Network match:', {
                rule: rule.name,
                data: extractedData,
                url: context.url,
                method: context.method
            });
        });
    }
    /**
     * Disable network tracking
     */
    disableNetworkTracking() {
        this.networkExtractor.disableTracking();
    }
    /**
     * Check if network tracking is currently active
     */
    isNetworkTrackingActive() {
        return this.networkExtractor.isTracking();
    }
    /**
     * Get the network extractor instance for advanced usage
     */
    getNetworkExtractor() {
        return this.networkExtractor;
    }
    isValid(val) {
        return val !== null && val !== undefined && val !== '';
    }
}

// Hàm tiện ích: Parse JSON an toàn (tránh văng lỗi nếu chuỗi không hợp lệ)
function safeParse(data) {
    try {
        if (typeof data === 'string')
            return JSON.parse(data);
        return data;
    }
    catch (e) {
        return data;
    }
}
/**
 * NetworkPlugin: Plugin chịu trách nhiệm theo dõi các yêu cầu mạng (XHR & Fetch).
 * Nó tự động chặn (intercept) các request, so sánh với Rules cấu hình,
 * và trích xuất dữ liệu nếu trùng khớp.
 */
class NetworkPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'NetworkPlugin';
    }
    /**
     * Khởi động plugin.
     * Bắt đầu ghi đè (hook) XHR và Fetch để lắng nghe request.
     */
    start() {
        if (this.active)
            return;
        this.hookXhr();
        this.hookFetch();
        this.active = true;
        console.log(`[${this.name}] Started - Intercepting Network Requests`);
    }
    /**
     * Dừng plugin.
     * Khôi phục (restore) lại XHR và Fetch gốc của trình duyệt.
     */
    stop() {
        if (!this.active)
            return;
        this.restoreXhr();
        this.restoreFetch();
        this.active = false;
        console.log(`[${this.name}] Stopped`);
    }
    /**
     * Ghi đè XMLHttpRequest để theo dõi request cũ.
     */
    hookXhr() {
        this.originalXmlOpen = XMLHttpRequest.prototype.open;
        this.originalXmlSend = XMLHttpRequest.prototype.send;
        const plugin = this;
        // Ghi đè phương thức open để lấy thông tin method và url
        XMLHttpRequest.prototype.open = function (method, url) {
            this._networkTrackInfo = { method, url, startTime: Date.now() };
            return plugin.originalXmlOpen.apply(this, arguments);
        };
        // Ghi đè phương thức send để lấy body gửi đi và body trả về
        XMLHttpRequest.prototype.send = function (body) {
            const info = this._networkTrackInfo;
            if (info) {
                // Lắng nghe sự kiện load để bắt response
                this.addEventListener('load', () => {
                    plugin.handleRequest(info.url, info.method, body, this.response);
                });
            }
            return plugin.originalXmlSend.apply(this, arguments);
        };
    }
    /**
     * Khôi phục XMLHttpRequest về nguyên bản.
     */
    restoreXhr() {
        if (this.originalXmlOpen)
            XMLHttpRequest.prototype.open = this.originalXmlOpen;
        if (this.originalXmlSend)
            XMLHttpRequest.prototype.send = this.originalXmlSend;
    }
    /**
     * Ghi đè window.fetch để theo dõi request hiện đại.
     */
    hookFetch() {
        this.originalFetch = window.fetch;
        const plugin = this;
        window.fetch = async function (...args) {
            var _a;
            const [resource, config] = args;
            const url = typeof resource === 'string' ? resource : resource.url;
            const method = ((_a = config === null || config === void 0 ? void 0 : config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
            const body = config === null || config === void 0 ? void 0 : config.body;
            // Gọi fetch gốc
            const response = await plugin.originalFetch.apply(this, args);
            // Clone response để đọc dữ liệu mà không làm hỏng luồng chính
            const clone = response.clone();
            clone.text().then((text) => {
                plugin.handleRequest(url, method, body, text);
            }).catch(() => { });
            return response;
        };
    }
    /**
     * Khôi phục window.fetch về nguyên bản.
     */
    restoreFetch() {
        if (this.originalFetch)
            window.fetch = this.originalFetch;
    }
    /**
     * Xử lý thông tin request đã chặn được.
     * So khớp URL với các Rule trong Config và trích xuất dữ liệu.
     * @param url URL của request
     * @param method Phương thức (GET, POST, ...)
     * @param reqBody Body gửi đi (nếu có)
     * @param resBody Body trả về (nếu có)
     */
    handleRequest(url, method, reqBody, resBody) {
        this.errorBoundary.execute(() => {
            if (!this.tracker)
                return;
            const config = this.tracker.getConfig();
            if (!config || !config.trackingRules)
                return;
            const reqData = safeParse(reqBody);
            const resData = safeParse(resBody);
            const networkContext = {
                reqBody: reqData,
                resBody: resData,
                method: method,
                url: url
            };
            for (const rule of config.trackingRules) {
                if (!rule.payloadMappings || rule.payloadMappings.length === 0)
                    continue;
                const extractedData = this.tracker.payloadBuilder.build(networkContext, rule);
                if (Object.keys(extractedData).length > 0) {
                    // Prepare event to send
                    // Nếu có dữ liệu trích xuất được, tiến hành gửi tracking event
                    if (Object.keys(extractedData).length > 0) {
                        // Use centralized build and track
                        this.buildAndTrack(networkContext, rule, rule.eventTypeId, {
                            metadata: {
                                additionalValues: JSON.stringify(extractedData),
                                method: method,
                                url: url,
                                captureMethod: 'network-intercept'
                            }
                        });
                        console.groupCollapsed(`%c[TRACKER] Network Match: (${method} ${url})`, "color: orange");
                        console.log("Rule:", rule.name);
                        console.log("Extracted:", extractedData);
                        console.groupEnd();
                    }
                }
            }
        }, 'NetworkPlugin.handleRequest');
    }
}

class RatingUtils {
    /**
     * Hàm Main: Phân tích DOM để lấy rating
     */
    static processRating(container, triggerElement, eventType) {
        let rawValue = 0;
        let maxValue = 5;
        // BƯỚC 1: TRÍCH XUẤT GIÁ TRỊ (EXTRACTION)
        // Chiến thuật 1: Nếu click trực tiếp vào item (sao/nút), ưu tiên lấy value từ chính nó
        if (eventType === 'click') {
            rawValue = this.extractValueFromTarget(container, triggerElement);
        }
        // Chiến thuật 2: Nếu là submit form hoặc Chiến thuật 1 thất bại (click vào viền chẳng hạn)
        // Quét toàn bộ container xem cái nào đang "checked" hoặc "active"
        if (rawValue === 0) {
            rawValue = this.extractValueFromContainerState(container);
        }
        // BƯỚC 2: PHÁT HIỆN THANG ĐIỂM (SCALE DETECTION)
        const isBinary = this.detectBinaryContext(container, triggerElement);
        if (isBinary) {
            maxValue = 1; // Hệ nhị phân
            // Nếu click nút Like/Upvote thì rawValue = 1
            if (eventType === 'click' && this.isPositiveAction(triggerElement)) {
                rawValue = 1;
            }
            // Nếu submit form, rawValue đã được lấy ở bước 1 (từ input checked)
        }
        else {
            // Hệ chấm điểm (5, 10, 100)
            maxValue = this.detectMaxScale(container, rawValue);
        }
        // BƯỚC 3: LẤY REVIEW TEXT
        const reviewText = this.extractReviewText(container);
        // BƯỚC 4: CHUẨN HÓA
        const normalized = this.normalizeScore(rawValue, maxValue, isBinary);
        return {
            originalValue: rawValue,
            maxValue: maxValue,
            normalizedValue: normalized,
            reviewText: reviewText,
            type: isBinary ? 'binary' : (maxValue > 5 ? 'numeric' : 'star'),
            captureMethod: eventType === 'submit' ? 'form_submit' : 'click_item'
        };
    }
    // --- CÁC HÀM "THÁM TỬ" (HEURISTICS) ---
    static extractValueFromTarget(container, target) {
        var _a;
        let current = target;
        // Leo ngược từ target lên container (tối đa 5 cấp để tránh loop vô hạn)
        let depth = 0;
        while (current && current !== container.parentElement && depth < 5) {
            // Check 1: Data Attributes (Phổ biến nhất)
            const val = current.getAttribute('data-value') || current.getAttribute('value') || current.getAttribute('aria-valuenow');
            if (val) {
                const num = parseFloat(val);
                if (!isNaN(num))
                    return num;
            }
            // Check 2: Index (Sao thứ mấy trong danh sách?)
            // Áp dụng nếu element hiện tại là item trong list (li, span, button)
            if (['LI', 'SPAN', 'DIV', 'BUTTON', 'I', 'SVG'].includes(current.tagName)) {
                const siblings = Array.from(((_a = current.parentElement) === null || _a === void 0 ? void 0 : _a.children) || []).filter(el => el.tagName === current.tagName || el.className.includes('star') || el.className.includes('rate'));
                // Nếu có ít nhất 2 anh em giống nhau, khả năng cao là list sao
                if (siblings.length >= 2 && siblings.length <= 12) {
                    const index = siblings.indexOf(current);
                    if (index !== -1)
                        return index + 1;
                }
            }
            // Check 3: Accessibility Attribute (aria-posinset="4")
            const pos = current.getAttribute('aria-posinset');
            if (pos)
                return parseFloat(pos);
            current = current.parentElement;
            depth++;
        }
        return 0;
    }
    static extractValueFromContainerState(container) {
        // 1. Tìm Input Radio/Checkbox đang checked (Chuẩn HTML)
        const specificSelector = `
            input[type="radio"][name*="rate"]:checked, 
            input[type="radio"][name*="rating"]:checked, 
            input[type="radio"][name*="score"]:checked,
            input[type="radio"][name*="star"]:checked
        `;
        let checked = container.querySelector(specificSelector);
        // Fallback: Nếu không tìm thấy cái nào có tên cụ thể, thì mới tìm radio bất kỳ (phòng hờ dev đặt tên lạ)
        if (!checked) {
            checked = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
        }
        if (checked && checked.value) {
            const val = parseFloat(checked.value);
            // Một số web để value="on" (checkbox) hoặc string lạ, ta bỏ qua
            if (!isNaN(val))
                return val;
        }
        // 2. Tìm Class Active/Selected (Chuẩn CSS Custom)
        // Tìm các class thường dùng để highlight sao
        const activeSelectors = ['.active', '.selected', '.checked', '.filled', '.highlighted', '[aria-checked="true"]', '.rating', 'rating-stars', '.star', '.star-rating'];
        const activeItems = container.querySelectorAll(activeSelectors.join(', '));
        if (activeItems.length > 0) {
            // Logic: Nếu 4 sao sáng -> 4 điểm
            // Nhưng cẩn thận: check xem item cuối cùng có data-value="8" không?
            const lastItem = activeItems[activeItems.length - 1];
            const dataVal = lastItem.getAttribute('data-value');
            if (dataVal) {
                const val = parseFloat(dataVal);
                if (!isNaN(val))
                    return val;
            }
            return activeItems.length;
        }
        // 3. Dropdown Select
        const select = container.querySelector('select');
        if (select && select.value)
            return parseFloat(select.value);
        return 0;
    }
    static extractReviewText(container) {
        // Tìm textarea hoặc input text có tên liên quan review/comment
        const inputs = container.querySelectorAll('textarea, input[type="text"]');
        for (const input of Array.from(inputs)) {
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            // Nếu tên trường có chữ review, comment, detail, đánh giá...
            if (['review', 'comment', 'detail', 'message', 'body', 'content', 'đánh giá', 'nhận xét'].some(k => name.includes(k) || id.includes(k) || placeholder.includes(k))) {
                return input.value || '';
            }
        }
        // Fallback: Lấy textarea đầu tiên tìm thấy
        const firstTextarea = container.querySelector('textarea');
        return firstTextarea ? (firstTextarea.value || '') : '';
    }
    static detectMaxScale(container, currentVal) {
        // 1. Check aria-valuemax (Chuẩn nhất)
        const ariaMax = container.getAttribute('aria-valuemax');
        if (ariaMax)
            return parseFloat(ariaMax);
        const childMax = container.querySelector('[aria-valuemax]');
        if (childMax)
            return parseFloat(childMax.getAttribute('aria-valuemax') || '5');
        // 2. Đếm số lượng item con (Stars)
        // Lọc các element con có class chứa 'star' hoặc 'rate' hoặc là svg/img
        const stars = container.querySelectorAll('.star, .fa-star, [class*="rating-item"], [role="radio"]');
        if (stars.length >= 3 && stars.length <= 10)
            return stars.length;
        // 3. Fallback theo logic số học
        if (currentVal > 5) {
            if (currentVal <= 10)
                return 10;
            if (currentVal <= 20)
                return 20; // Thang 20 điểm
            return 100; // Thang 100 điểm
        }
        return 5; // Mặc định an toàn
    }
    static detectBinaryContext(container, target) {
        // Gom tất cả text/class để scan keyword
        const contextStr = (container.className + ' ' + target.className + ' ' + (target.getAttribute('aria-label') || '') + ' ' + (target.id || '')).toLowerCase();
        // Keywords đặc trưng của Binary Rating
        const keywords = ['like', 'dislike', 'thumb', 'vote', 'useful', 'hữu ích', 'thích'];
        // Check nếu container chỉ có đúng 2 nút bấm -> Khả năng cao là binary
        const buttons = container.querySelectorAll('button, a[role="button"], input[type="button"]');
        const isTwoButtons = buttons.length === 2;
        return keywords.some(k => contextStr.includes(k)) || (isTwoButtons && contextStr.includes('rate'));
    }
    static isPositiveAction(target) {
        const str = (target.className + ' ' + target.textContent + ' ' + target.id + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
        // Nếu có chữ 'dis' (dislike) hoặc 'down' (thumb-down) -> Negative
        if (str.includes('dis') || str.includes('down') || str.includes('không'))
            return false;
        // Nếu có chữ 'up', 'like', 'good', 'yes' -> Positive
        return str.includes('up') || str.includes('like') || str.includes('good') || str.includes('yes') || str.includes('hữu ích');
    }
    static normalizeScore(raw, max, isBinary) {
        if (raw <= 0)
            return 0;
        if (isBinary) {
            // Binary: Positive = 5 sao, Negative = 1 sao
            return raw >= 1 ? 5 : 1;
        }
        // Range Normalization: (Value / Max) * 5
        let normalized = (raw / max) * 5;
        // Làm tròn đến 0.5 (vd: 4.3 -> 4.5, 4.2 -> 4.0)
        normalized = Math.round(normalized * 2) / 2;
        // Kẹp giá trị trong khoảng 1-5
        return Math.min(5, Math.max(1, normalized));
    }
}

class RatingPlugin extends BasePlugin {
    constructor() {
        super();
        this.name = 'RatingPlugin';
        this.throttledClickHandler = throttle(this.wrapHandler(this.handleInteraction.bind(this, 'click'), 'handleClick'), 500);
        this.submitHandler = this.wrapHandler(this.handleInteraction.bind(this, 'submit'), 'handleSubmit');
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            console.log(`[RatingPlugin] initialized.`);
        }, 'RatingPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            // 1. Listen for Click (Interactive Rating: Stars, Likes)
            document.addEventListener("click", this.throttledClickHandler, true);
            // 2. Listen for Submit (Traditional Forms)
            document.addEventListener("submit", this.submitHandler, true);
            console.log("[RatingPlugin] started listening for Rating interactions.");
            this.active = true;
        }, 'RatingPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledClickHandler, true);
            document.removeEventListener("submit", this.submitHandler, true);
            super.stop();
        }, 'RatingPlugin.stop');
    }
    handleInteraction(eventType, event) {
        var _a;
        if (!this.tracker)
            return;
        // Trigger ID = 2 for Rating (Standard)
        const eventId = this.tracker.getEventTypeId('Rating') || 2;
        const config = this.tracker.getConfig();
        const rules = (_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId);
        if (!rules || rules.length === 0)
            return;
        const target = event.target;
        if (!target)
            return;
        try {
            for (const rule of rules) {
                const selector = rule.trackingTarget.value;
                if (!selector)
                    continue;
                const matchedElement = target.closest(selector);
                if (matchedElement) {
                    // Determine Container
                    const container = matchedElement.closest('form') ||
                        matchedElement.closest('.rating-container') ||
                        matchedElement.closest('.review-box') ||
                        matchedElement.parentElement ||
                        document.body;
                    // Process Rating
                    const result = RatingUtils.processRating(container, matchedElement, eventType);
                    // Filter garbage
                    if (result.originalValue === 0 && !result.reviewText) {
                        continue;
                    }
                    console.log(`[RatingPlugin] 🎯 Captured [${eventType}]: Raw=${result.originalValue}/${result.maxValue} -> Norm=${result.normalizedValue}`);
                    // Build Payload using centralized method
                    this.buildAndTrack(matchedElement, rule, eventId, {
                        metadata: {
                            additionalValues: result.reviewText || String(result.normalizedValue),
                            rawRateValue: result.originalValue,
                            rateMax: result.maxValue,
                            rateType: result.type,
                            captureMethod: result.captureMethod,
                            normalizedValue: result.normalizedValue,
                            reviewText: result.reviewText
                        }
                    });
                    break;
                }
            }
        }
        catch (error) {
            console.warn('[RatingPlugin] Error processing interaction:', error);
        }
    }
}

var ratingPlugin = /*#__PURE__*/Object.freeze({
    __proto__: null,
    RatingPlugin: RatingPlugin
});

// RecSysTracker - Main SDK class
class RecSysTracker {
    constructor() {
        this.eventDispatcher = null;
        this.displayManager = null;
        this.config = null;
        this.userId = null;
        this.isInitialized = false;
        this.sendInterval = null;
        this.configLoader = new ConfigLoader();
        this.errorBoundary = new ErrorBoundary();
        this.eventBuffer = new EventBuffer();
        this.metadataNormalizer = new MetadataNormalizer();
        this.pluginManager = new PluginManager(this);
        this.payloadBuilder = new PayloadBuilder();
    }
    // Khởi tạo SDK - tự động gọi khi tải script
    async init() {
        return this.errorBoundary.executeAsync(async () => {
            if (this.isInitialized) {
                return;
            }
            // Load config từ window
            this.config = this.configLoader.loadFromWindow();
            if (!this.config) {
                return;
            }
            // Khởi tạo EventDispatcher
            const baseUrl = "https://recsys-tracker-module.onrender.com";
            this.eventDispatcher = new EventDispatcher({
                endpoint: `${baseUrl}${DEFAULT_TRACK_ENDPOINT_PATH}`,
            });
            // Fetch remote config và verify origin
            const remoteConfig = await this.configLoader.fetchRemoteConfig();
            if (remoteConfig) {
                this.config = remoteConfig;
                // Cập nhật domainUrl cho EventDispatcher để verify origin khi gửi event
                if (this.eventDispatcher && this.config.domainUrl) {
                    this.eventDispatcher.setDomainUrl(this.config.domainUrl);
                }
                console.log(this.config);
                // Khởi tạo Display Manager nếu có returnMethods
                if (this.config.returnMethods && this.config.returnMethods.length > 0) {
                    const apiBaseUrl = "https://recsys-tracker-module.onrender.com";
                    this.displayManager = new DisplayManager(this.config.domainKey, apiBaseUrl);
                    this.displayManager.initialize(this.config.returnMethods);
                    console.log('[RecSysTracker] Display methods initialized');
                }
                // Tự động khởi tạo plugins dựa trên rules
                this.autoInitializePlugins();
            }
            else {
                // Nếu origin verification thất bại, không khởi tạo SDK
                console.error('[RecSysTracker] Failed to initialize SDK: origin verification failed');
                this.config = null;
                this.eventDispatcher = null;
                return;
            }
            // Setup batch sending
            this.setupBatchSending();
            // Setup page unload handler
            this.setupUnloadHandler();
            this.isInitialized = true;
        }, 'init');
    }
    // Tự động khởi tạo plugins dựa trên tracking rules
    async autoInitializePlugins() {
        var _a;
        if (!((_a = this.config) === null || _a === void 0 ? void 0 : _a.trackingRules) || this.config.trackingRules.length === 0) {
            return;
        }
        // Get dynamic IDs
        const clickId = this.getEventTypeId('Click');
        const rateId = this.getEventTypeId('Rating');
        const reviewId = this.getEventTypeId('Review');
        const pageViewId = this.getEventTypeId('Page View');
        const scrollId = this.getEventTypeId('Scroll');
        // Check specific rules (chỉ check nếu tìm thấy ID)
        const hasClickRules = clickId ? this.config.trackingRules.some(rule => rule.eventTypeId === clickId) : false;
        const hasRateRules = rateId ? this.config.trackingRules.some(rule => rule.eventTypeId === rateId) : false;
        const hasReviewRules = reviewId ? this.config.trackingRules.some(rule => rule.eventTypeId === reviewId) : false;
        const hasPageViewRules = pageViewId ? this.config.trackingRules.some(rule => rule.eventTypeId === pageViewId) : false;
        const hasScrollRules = scrollId ? this.config.trackingRules.some(rule => rule.eventTypeId === scrollId) : false;
        // Chỉ tự động đăng ký nếu chưa có plugin nào được đăng ký
        if (this.pluginManager.getPluginNames().length === 0) {
            const pluginPromises = [];
            if (hasClickRules) {
                const clickPromise = Promise.resolve().then(function () { return clickPlugin; }).then(({ ClickPlugin }) => {
                    this.use(new ClickPlugin());
                    console.log('[RecSysTracker] Auto-registered ClickPlugin based on tracking rules');
                });
                pluginPromises.push(clickPromise);
            }
            if (hasRateRules) {
                const ratingPromise = Promise.resolve().then(function () { return ratingPlugin; }).then(({ RatingPlugin }) => {
                    this.use(new RatingPlugin());
                    console.log('[RecSysTracker] Auto-registered RatingPlugin based on tracking rules');
                });
                pluginPromises.push(ratingPromise);
            }
            if (hasReviewRules) {
                const scrollPromise = Promise.resolve().then(function () { return reviewPlugin; }).then(({ ReviewPlugin }) => {
                    this.use(new ReviewPlugin());
                    console.log('[RecSysTracker] Auto-registered ScrollPlugin');
                });
                pluginPromises.push(scrollPromise);
            }
            if (hasPageViewRules) {
                const pageViewPromise = Promise.resolve().then(function () { return pageViewPlugin; }).then(({ PageViewPlugin }) => {
                    this.use(new PageViewPlugin());
                    console.log('[RecSysTracker] Auto-registered PageViewPlugin based on tracking rules');
                });
                pluginPromises.push(pageViewPromise);
            }
            if (hasScrollRules) {
                const scrollPromise = Promise.resolve().then(function () { return scrollPlugin; }).then(({ ScrollPlugin }) => {
                    this.use(new ScrollPlugin());
                    console.log('[RecSysTracker] Auto-registered ScrollPlugin');
                });
                pluginPromises.push(scrollPromise);
            }
            // Check for Network Rules
            const hasNetworkRules = this.config.trackingRules.some(rule => {
                var _a;
                return (_a = rule.payloadMappings) === null || _a === void 0 ? void 0 : _a.some(mapping => {
                    var _a;
                    const source = (_a = mapping.source) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                    return source === 'requestbody' ||
                        source === 'responsebody' ||
                        source === 'request_body' ||
                        source === 'response_body' ||
                        source === 'network_request';
                });
            });
            if (hasNetworkRules) {
                this.use(new NetworkPlugin());
                console.log('[RecSysTracker] Auto-registered NetworkPlugin based on tracking rules');
            }
            // Chờ tất cả plugin được đăng ký trước khi khởi động
            if (pluginPromises.length > 0) {
                await Promise.all(pluginPromises);
            }
            if (this.pluginManager.getPluginNames().length > 0) {
                this.startPlugins();
                console.log('[RecSysTracker] Auto-started plugins');
            }
        }
    }
    // Track custom event
    track(eventData) {
        this.errorBoundary.execute(() => {
            if (!this.isInitialized || !this.config) {
                return;
            }
            const trackedEvent = {
                id: this.metadataNormalizer.generateEventId(),
                timestamp: new Date(),
                eventTypeId: eventData.eventTypeId,
                trackingRuleId: eventData.trackingRuleId,
                domainKey: this.config.domainKey,
                userField: eventData.userField,
                userValue: eventData.userValue,
                itemField: eventData.itemField,
                itemValue: eventData.itemValue,
                ...(eventData.value !== undefined && { value: eventData.value }),
            };
            this.eventBuffer.add(trackedEvent);
        }, 'track');
    }
    // Setup batch sending of events
    setupBatchSending() {
        var _a, _b, _c, _d;
        const batchDelay = ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.batchDelay) || 2000;
        const batchSize = ((_d = (_c = this.config) === null || _c === void 0 ? void 0 : _c.options) === null || _d === void 0 ? void 0 : _d.batchSize) || 10;
        this.sendInterval = window.setInterval(() => {
            this.errorBoundary.execute(() => {
                if (this.eventBuffer.isEmpty()) {
                    return;
                }
                const batch = this.eventBuffer.getBatch(batchSize);
                this.sendBatch(batch);
            }, 'batchSending');
        }, batchDelay);
    }
    // Send a batch of events
    async sendBatch(events) {
        if (!this.eventDispatcher || events.length === 0) {
            return;
        }
        try {
            const success = await this.eventDispatcher.sendBatch(events);
            if (success) {
                const eventIds = events.map(e => e.id);
                this.eventBuffer.removeBatch(eventIds);
            }
            else {
                const eventIds = events.map(e => e.id);
                this.eventBuffer.markFailed(eventIds);
            }
        }
        catch (error) {
            const eventIds = events.map(e => e.id);
            this.eventBuffer.markFailed(eventIds);
        }
    }
    // Setup page unload handler để gửi remaining events
    setupUnloadHandler() {
        const sendOnUnload = () => {
            this.errorBoundary.execute(() => {
                if (this.eventBuffer.isEmpty() || !this.eventDispatcher) {
                    return;
                }
                // Send all remaining events dùng sendBeacon
                const allEvents = this.eventBuffer.getAll();
                this.eventDispatcher.sendBatch(allEvents);
            }, 'unload');
        };
        // Gửi sự kiện khi trang unload
        window.addEventListener('beforeunload', sendOnUnload);
        window.addEventListener('pagehide', sendOnUnload);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                sendOnUnload();
            }
        });
    }
    // Flush tất cả events ngay lập tức
    async flush() {
        return this.errorBoundary.executeAsync(async () => {
            if (this.eventBuffer.isEmpty()) {
                return;
            }
            const allEvents = this.eventBuffer.getAll();
            await this.sendBatch(allEvents);
        }, 'flush');
    }
    // Lấy config hiện tại
    getConfig() {
        return this.config;
    }
    // Helper để lấy event type id từ name
    getEventTypeId(name) {
        if (!this.config || !this.config.eventTypes) {
            return undefined;
        }
        const type = this.config.eventTypes.find(t => t.name === name);
        return type ? type.id : undefined;
    }
    // Set user ID
    setUserId(userId) {
        this.userId = userId;
    }
    // Get current user ID
    getUserId() {
        return this.userId;
    }
    // Destroy SDK instance
    destroy() {
        this.errorBoundary.execute(() => {
            var _a;
            if (this.sendInterval) {
                clearInterval(this.sendInterval);
            }
            // Stop all plugins
            this.pluginManager.destroy();
            // Flush remaining events
            if (!this.eventBuffer.isEmpty()) {
                const allEvents = this.eventBuffer.getAll();
                (_a = this.eventDispatcher) === null || _a === void 0 ? void 0 : _a.sendBatch(allEvents);
            }
            // Destroy display manager
            if (this.displayManager) {
                this.displayManager.destroy();
                this.displayManager = null;
            }
            this.isInitialized = false;
        }, 'destroy');
    }
    // Plugin Management Methods
    // Lấy plugin manager instance
    getPluginManager() {
        return this.pluginManager;
    }
    // Lấy display manager instance
    getDisplayManager() {
        return this.displayManager;
    }
    // Register 1 plugin
    use(plugin) {
        this.pluginManager.register(plugin);
        return this;
    }
    // Start tất cả plugins đã register
    startPlugins() {
        this.pluginManager.startAll();
    }
    // Stop tất cả plugins đã register
    stopPlugins() {
        this.pluginManager.stopAll();
    }
}
// Tự động tạo instance toàn cục và khởi tạo
let globalTracker = null;
if (typeof window !== 'undefined') {
    // Tạo global instance
    globalTracker = new RecSysTracker();
    // Tự động khởi tạo khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            globalTracker === null || globalTracker === void 0 ? void 0 : globalTracker.init();
        });
    }
    else {
        // DOM đã được tải
        globalTracker.init();
    }
    // Gán vào window để truy cập toàn cục
    window.RecSysTracker = globalTracker;
    // Expose classes for testing
    if (globalTracker) {
        window.RecSysTracker.ConfigLoader = ConfigLoader;
    }
}

exports.BasePlugin = BasePlugin;
exports.ClickPlugin = ClickPlugin;
exports.ConfigLoader = ConfigLoader;
exports.DisplayManager = DisplayManager;
exports.PageViewPlugin = PageViewPlugin;
exports.PluginManager = PluginManager;
exports.RatingPlugin = RatingPlugin;
exports.RecSysTracker = RecSysTracker;
exports.ReviewPlugin = ReviewPlugin;
exports.ScrollPlugin = ScrollPlugin;
exports.default = RecSysTracker;
//# sourceMappingURL=recsys-tracker.cjs.js.map
