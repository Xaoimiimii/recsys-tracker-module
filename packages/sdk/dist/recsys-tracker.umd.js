(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.RecSysTracker = {}));
})(this, (function (exports) { 'use strict';

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
                    console.warn(`[${this.name}] Plugin already initialized`);
                    return;
                }
                this.tracker = tracker;
                this.payloadBuilder = tracker.payloadBuilder;
                console.log(`[${this.name}] Plugin initialized`);
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
            const { userField, userValue, itemField, itemValue } = this.resolvePayloadIdentity(extractedData);
            // 3. Construct payload
            const payload = {
                eventTypeId: eventId,
                trackingRuleId: rule.id,
                userField,
                userValue,
                itemField,
                itemValue,
                value: additionalFields === null || additionalFields === void 0 ? void 0 : additionalFields.value,
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
                    console.warn(`[PluginManager] Plugin "${plugin.name}" already registered`);
                    return;
                }
                plugin.init(this.tracker);
                this.plugins.set(plugin.name, plugin);
                console.log(`[PluginManager] Registered plugin: ${plugin.name}`);
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

    let aiItemDetectorInstance = null;
    class AIItemDetector {
        constructor() {
            this.itemCache = new Map();
            this.domObserver = null;
            if (aiItemDetectorInstance) {
                return aiItemDetectorInstance;
            }
            this.init();
            aiItemDetectorInstance = this;
        }
        init() {
            console.log('[Recsys AI] 🤖 AI Item Detector initialized');
            this.setupDOMMutationObserver();
        }
        detectItemFromClick(event) {
            const element = event.target;
            console.log('[Recsys AI] 🔍 Analyzing clicked element...');
            const domItem = this.detectItemFromDOM(element);
            if (domItem)
                return domItem;
            const textItem = this.detectItemFromText(element);
            if (textItem)
                return textItem;
            const mediaItem = this.detectItemFromMedia(element);
            if (mediaItem)
                return mediaItem;
            const structuredItem = this.detectItemFromStructuredData(element);
            if (structuredItem)
                return structuredItem;
            return this.detectItemFromPosition(element);
        }
        detectItemFromDOM(element) {
            console.log('[Recsys AI] 🔍 Analyzing DOM context (Self/Parent Check)...');
            let current = element;
            for (let i = 0; i < 5; i++) {
                if (!current)
                    break;
                const itemData = this.extractItemDataFromElement(current);
                if (itemData) {
                    return itemData;
                }
                current = current.parentElement;
            }
            return null;
        }
        detectItemFromChildren(parentElement) {
            var _a;
            console.log('[Recsys AI] 🔍 Analyzing Item Card Children...');
            const itemSelectors = ['[data-item-id]', '[data-id]',
                '[data-song-id]', '[data-track-id]', '[data-video-id]',
                '[data-product-id]', '[data-sku]', '[data-listing-id]',
                '[data-article-id]', '[data-post-id]', '[data-thread-id]',
                '[data-user-id]', '[data-author-id]',
                '[data-content-id]'
            ];
            for (const selector of itemSelectors) {
                const childElement = parentElement.querySelector(selector);
                if (childElement) {
                    const itemData = this.extractItemDataFromElement(childElement);
                    if (itemData) {
                        console.log('[Recsys AI] ✅ Found item in Child Element via Data Attribute:', itemData);
                        return itemData;
                    }
                }
            }
            const prominentChildren = parentElement.querySelectorAll('a, button, [role="link"], [role="button"]');
            for (const child of Array.from(prominentChildren)) {
                const itemData = this.extractItemDataFromElement(child);
                if (itemData) {
                    console.log('[Recsys AI] ✅ Found item in Prominent Child Element:', itemData);
                    return itemData;
                }
            }
            const titleElement = parentElement.querySelector('h1, h2, h3, h4, [data-title]');
            const title = (_a = titleElement === null || titleElement === void 0 ? void 0 : titleElement.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (title) {
                console.log('[Recsys AI] 💡 Detected item via Title Fallback:', title);
                return {
                    id: this.generateHashId(title),
                    name: title,
                    type: 'content',
                    confidence: 0.6,
                    source: 'title_fallback'
                };
            }
            return null;
        }
        detectItemFromText(element) {
            console.log('[Recsys AI] 🔍 Analyzing text content...');
            const textContext = this.getTextContext(element, 2);
            if (!textContext)
                return null;
            const patterns = {
                song: [
                    /(["'])(.+?)\1\s*(?:-|-|by)\s*(.+)/i,
                    /(.+?)\s*(?:-|-)\s*(.+)/i,
                    /Track\s*\d+[:\s]*(.+)/i,
                    /(.+?)\s*\(feat\.\s*(.+)\)/i,
                ],
                album: [
                    /Album[:\s]*(.+)/i,
                    /(.+?)\s*(?:album|LP|EP)/i,
                ],
                artist: [
                    /Artist[:\s]*(.+)/i,
                    /by\s*(.+)/i,
                ],
                product: [
                    /(Mã|SKU|Code|Item)\s*[:#]\s*([A-Z0-9-]+)/i,
                    /(Product|Sản phẩm)\s*[:\s]*(.+)/i,
                ],
                article: [
                    /(Bài viết|Post|News)\s*[:\s]*(.+)/i,
                    /Published\s*(?:by|on)\s*(.+)/i,
                ],
            };
            for (const [type, typePatterns] of Object.entries(patterns)) {
                for (const pattern of typePatterns) {
                    const match = textContext.match(pattern);
                    if (match) {
                        const itemName = (match[2] || match[1] || '').trim();
                        if (!itemName)
                            continue;
                        const idValue = (type === 'product' && itemName.length < 50) ? itemName : this.generateHashId(itemName);
                        console.log(`[Recsys AI] ✅ Detected ${type}: ${itemName}`);
                        return {
                            id: idValue,
                            name: itemName,
                            type: type,
                            confidence: 0.7,
                            source: 'text_pattern',
                            context: textContext.substring(0, 100)
                        };
                    }
                }
            }
            const keywords = {
                song: ['play', 'listen', 'track', 'song', 'music', 'audio'],
                video: ['watch', 'view', 'video', 'movie', 'film', 'trailer'],
                product: ['buy', 'purchase', 'shop', 'product', 'item', 'add to cart', 'giá', 'mua hàng', 'price'],
                article: ['read more', 'continue reading', 'bài viết', 'tin tức', 'blog post', 'tác giả'],
                user: ['follow', 'profile', 'người dùng', 'tài khoản', 'friend'],
                comment: ['like', 'share', 'comment', 'bình luận'],
            };
            const lowerText = textContext.toLowerCase();
            for (const [type, words] of Object.entries(keywords)) {
                if (words.some(word => lowerText.includes(word))) {
                    const words = textContext.split(/\s+/).slice(0, 5).join(' ');
                    if (words.length > 3) {
                        return {
                            id: this.generateHashId(words),
                            name: words,
                            type: type,
                            confidence: 0.5,
                            source: 'keyword_match',
                            context: textContext.substring(0, 100)
                        };
                    }
                }
            }
            return null;
        }
        detectItemFromLimitedText(element) {
            const textContext = this.getTextContext(element, 1);
            if (!textContext)
                return null;
            const MAX_CONTEXT_LENGTH = 120;
            if (textContext.length > MAX_CONTEXT_LENGTH) {
                console.log('[Recsys AI] Text fallback ignored: Context too long (>' + MAX_CONTEXT_LENGTH + ').');
                return null;
            }
            const patterns = {
                song: [
                    /(["'])(.+?)\1\s*(?:-|-|by)\s*(.+)/i,
                    /(.+?)\s*(?:-|-)\s*(.+)/i,
                    /Track\s*\d+[:\s]*(.+)/i,
                    /(.+?)\s*\(feat\.\s*(.+)\)/i,
                ],
                product: [
                    /(Mã|SKU|Code|Item)\s*[:#]\s*([A-Z0-9-]+)/i,
                    /(Product|Sản phẩm)\s*[:\s]*(.+)/i,
                ],
                article: [
                    /(Bài viết|Post|News)\s*[:\s]*(.+)/i,
                    /Published\s*(?:by|on)\s*(.+)/i,
                ],
                album: [
                    /Album[:\s]*(.+)/i,
                    /(.+?)\s*(?:album|LP|EP)/i,
                ],
                artist: [
                    /Artist[:\s]*(.+)/i,
                    /by\s*(.+)/i,
                ]
            };
            for (const [type, typePatterns] of Object.entries(patterns)) {
                for (const pattern of typePatterns) {
                    const match = textContext.match(pattern);
                    if (match) {
                        const itemName = (match[2] || match[1] || '').trim();
                        if (!itemName)
                            continue;
                        const idValue = (type === 'product' && itemName.length < 50) ? itemName : this.generateHashId(itemName);
                        return {
                            id: idValue,
                            name: itemName,
                            type: type,
                            confidence: 0.5,
                            source: 'text_pattern_limited',
                            context: textContext
                        };
                    }
                }
            }
            const keywords = {
                song: ['play', 'listen', 'track', 'song', 'music', 'audio'],
                video: ['watch', 'view', 'video', 'movie', 'film', 'trailer'],
                product: ['buy', 'purchase', 'shop', 'product', 'item', 'add to cart', 'giá', 'mua hàng', 'price'],
                article: ['read more', 'continue reading', 'bài viết', 'tin tức', 'blog post', 'tác giả'],
                user: ['follow', 'profile', 'người dùng', 'tài khoản', 'friend'],
                comment: ['like', 'share', 'comment', 'bình luận'],
            };
            const lowerText = textContext.toLowerCase();
            for (const [type, words] of Object.entries(keywords)) {
                if (words.some(word => lowerText.includes(word))) {
                    const words = textContext.split(/\s+/).slice(0, 5).join(' ');
                    if (words.length > 3) {
                        return {
                            id: this.generateHashId(words),
                            name: words,
                            type: type,
                            confidence: 0.3,
                            source: 'keyword_match_limited',
                            context: textContext
                        };
                    }
                }
            }
            return null;
        }
        detectItemFromMedia(element) {
            const mediaElement = this.findNearbyMedia(element);
            if (!mediaElement)
                return null;
            const castedMedia = mediaElement;
            let mediaData = {
                type: mediaElement.tagName.toLowerCase(),
                src: castedMedia.src || castedMedia.currentSrc || '',
                alt: castedMedia.alt || castedMedia.getAttribute('alt') || '',
                title: castedMedia.title || castedMedia.getAttribute('title') || ''
            };
            if (mediaElement.tagName === 'IMG') {
                const imageInfo = this.analyzeImage(mediaElement);
                if (imageInfo) {
                    return {
                        id: this.generateHashId(mediaData.src + mediaData.alt),
                        name: imageInfo.name || mediaData.alt || this.extractNameFromSrc(mediaData.src),
                        type: 'media',
                        confidence: 0.6,
                        source: 'image_analysis',
                        metadata: { ...mediaData, ...imageInfo }
                    };
                }
            }
            if (mediaElement.tagName === 'VIDEO') {
                const videoInfo = this.analyzeVideo(mediaElement);
                if (videoInfo) {
                    return {
                        id: this.generateHashId(mediaData.src + Date.now()),
                        name: videoInfo.title || 'Video Content',
                        type: 'video',
                        confidence: 0.6,
                        source: 'video_analysis',
                        metadata: { ...mediaData, ...videoInfo }
                    };
                }
            }
            return null;
        }
        detectItemFromStructuredData(element) {
            const microdata = this.extractMicrodata(element);
            if (microdata)
                return microdata;
            const jsonLdData = this.extractJsonLdData();
            if (jsonLdData) {
                const matchingItem = this.findMatchingItemInJsonLd(jsonLdData, element);
                if (matchingItem)
                    return matchingItem;
            }
            const ogData = this.extractOpenGraphData();
            if (ogData) {
                return {
                    id: this.generateHashId(ogData.title),
                    name: ogData.title,
                    type: ogData.type || 'content',
                    confidence: 0.8,
                    source: 'open_graph',
                    metadata: ogData
                };
            }
            return null;
        }
        detectItemFromPosition(element) {
            var _a;
            const rect = element.getBoundingClientRect();
            const position = {
                x: Math.round(rect.left + window.scrollX),
                y: Math.round(rect.top + window.scrollY),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
            const positionId = `${position.x}_${position.y}_${position.width}_${position.height}`;
            const contentHash = this.hashString(element.textContent || '');
            return {
                id: `pos_${positionId}_${contentHash}`,
                name: this.extractNameFromPosition(element),
                type: 'ui_element',
                confidence: 0.3,
                source: 'position_based',
                metadata: {
                    position: position,
                    elementType: element.tagName.toLowerCase(),
                    textPreview: ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 50)) || ''
                }
            };
        }
        extractItemDataFromElement(element) {
            var _a;
            const dataAttrs = ['data-item-id', 'data-id',
                'data-song-id', 'data-track-id', 'data-video-id',
                'data-product-id', 'data-sku', 'data-listing-id',
                'data-article-id', 'data-post-id', 'data-thread-id',
                'data-user-id', 'data-author-id',
                'data-content-id'
            ];
            const htmlElement = element;
            for (const attr of dataAttrs) {
                const value = element.getAttribute(attr);
                if (value) {
                    const itemTitle = htmlElement.title || htmlElement.getAttribute('title');
                    const itemAlt = htmlElement.getAttribute('alt');
                    return {
                        id: value,
                        name: element.getAttribute('data-item-name') ||
                            element.getAttribute('data-name') ||
                            itemTitle ||
                            itemAlt ||
                            'Unnamed Item',
                        type: this.inferTypeFromAttribute(attr),
                        confidence: 0.9,
                        source: 'data_attribute',
                        metadata: { attribute: attr }
                    };
                }
            }
            if (element.tagName === 'ARTICLE' || element.getAttribute('role') === 'article') {
                const title = element.querySelector('h1, h2, h3, [role="heading"]');
                if (title) {
                    return {
                        id: this.generateHashId(title.textContent + element.innerHTML.length),
                        name: (_a = title.textContent) === null || _a === void 0 ? void 0 : _a.trim(),
                        type: 'article',
                        confidence: 0.7,
                        source: 'semantic_html'
                    };
                }
            }
            return null;
        }
        getTextContext(element, depth = 2) {
            var _a, _b, _c;
            let context = '';
            let current = element;
            for (let i = 0; i <= depth; i++) {
                if (!current)
                    break;
                const text = (_a = current.textContent) === null || _a === void 0 ? void 0 : _a.trim();
                if (text && text.length > 0 && text.length < 500) {
                    context += text + ' ';
                }
                if (current.previousElementSibling) {
                    const prevText = (_b = current.previousElementSibling.textContent) === null || _b === void 0 ? void 0 : _b.trim();
                    if (prevText && prevText.length < 200) {
                        context = prevText + ' ' + context;
                    }
                }
                if (current.nextElementSibling) {
                    const nextText = (_c = current.nextElementSibling.textContent) === null || _c === void 0 ? void 0 : _c.trim();
                    if (nextText && nextText.length < 200) {
                        context += ' ' + nextText;
                    }
                }
                current = current.parentElement;
            }
            return context.trim() || null;
        }
        findNearbyMedia(element, maxDistance = 3) {
            if (element.tagName === 'IMG' || element.tagName === 'VIDEO' ||
                element.tagName === 'AUDIO' || element.tagName === 'FIGURE') {
                return element;
            }
            const mediaChild = element.querySelector('img, video, audio, figure, [data-media]');
            if (mediaChild)
                return mediaChild;
            let current = element;
            for (let i = 0; i < maxDistance; i++) {
                if (!current)
                    break;
                if (current.parentElement) {
                    const parentMedia = current.parentElement.querySelector('img, video, audio');
                    if (parentMedia)
                        return parentMedia;
                }
                const siblings = [];
                if (current.previousElementSibling)
                    siblings.push(current.previousElementSibling);
                if (current.nextElementSibling)
                    siblings.push(current.nextElementSibling);
                for (const sibling of siblings) {
                    const siblingMedia = sibling.querySelector('img, video, audio');
                    if (siblingMedia)
                        return siblingMedia;
                }
                current = current.parentElement;
            }
            return null;
        }
        analyzeImage(imgElement) {
            const src = imgElement.src || '';
            const alt = imgElement.alt || '';
            let name = alt;
            if (!name && src) {
                name = this.extractNameFromSrc(src);
            }
            let type = 'image';
            const patterns = [
                /(album|cover|artwork).*\.(jpg|jpeg|png|gif)/i,
                /(song|track|music).*\.(jpg|jpeg|png|gif)/i,
                /(artist|band).*\.(jpg|jpeg|png|gif)/i,
                /(thumbnail|thumb).*\.(jpg|jpeg|png|gif)/i,
            ];
            for (const pattern of patterns) {
                if (pattern.test(src) || pattern.test(alt)) {
                    if (pattern.toString().includes('album'))
                        type = 'album_art';
                    if (pattern.toString().includes('song'))
                        type = 'song_image';
                    if (pattern.toString().includes('artist'))
                        type = 'artist_image';
                    break;
                }
            }
            return {
                name: name,
                type: type,
                dimensions: {
                    naturalWidth: imgElement.naturalWidth,
                    naturalHeight: imgElement.naturalHeight,
                    clientWidth: imgElement.clientWidth,
                    clientHeight: imgElement.clientHeight
                }
            };
        }
        analyzeVideo(videoElement) {
            const src = videoElement.src || videoElement.currentSrc || '';
            const duration = videoElement.duration || 0;
            return {
                title: videoElement.getAttribute('data-title') ||
                    videoElement.title ||
                    this.extractNameFromSrc(src),
                duration: duration,
                isPlaying: !videoElement.paused,
                currentTime: videoElement.currentTime || 0
            };
        }
        extractNameFromSrc(src) {
            var _a;
            if (!src)
                return '';
            const filename = ((_a = src.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('?')[0]) || '';
            const name = filename.replace(/\.[^/.]+$/, '');
            let cleanName = name.replace(/[-_]/g, ' ');
            try {
                cleanName = decodeURIComponent(cleanName);
            }
            catch (e) {
                // Ignore
            }
            return cleanName;
        }
        extractMicrodata(element) {
            const itemprops = element.querySelectorAll('[itemprop]');
            if (itemprops.length === 0)
                return null;
            const data = {};
            Array.from(itemprops).forEach(el => {
                var _a;
                const prop = el.getAttribute('itemprop');
                const value = el.getAttribute('content') ||
                    el.getAttribute('src') ||
                    ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim());
                if (prop && value) {
                    data[prop] = value;
                }
            });
            if (Object.keys(data).length > 0) {
                return {
                    id: data.url || data.identifier || this.generateHashId(JSON.stringify(data)),
                    name: data.name || data.title || 'Microdata Item',
                    type: data['@type'] || 'Thing',
                    confidence: 0.85,
                    source: 'microdata',
                    metadata: data
                };
            }
            return null;
        }
        extractJsonLdData() {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const allData = [];
            Array.from(scripts).forEach(script => {
                try {
                    const data = JSON.parse(script.textContent || '{}');
                    if (Array.isArray(data)) {
                        allData.push(...data);
                    }
                    else {
                        allData.push(data);
                    }
                }
                catch (e) {
                    console.error('[Recsys AI] Failed to parse JSON-LD:', e);
                }
            });
            return allData.length > 0 ? allData : null;
        }
        findMatchingItemInJsonLd(jsonLdData, element) {
            var _a;
            const elementText = (_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
            if (!elementText)
                return null;
            for (const item of jsonLdData) {
                if (item.name && item.name.toLowerCase().includes(elementText.substring(0, 20))) {
                    return {
                        id: item['@id'] || item.identifier || this.generateHashId(item.name),
                        name: item.name,
                        type: item['@type'] || 'CreativeWork',
                        confidence: 0.9,
                        source: 'json_ld',
                        metadata: item
                    };
                }
            }
            return null;
        }
        extractOpenGraphData() {
            const metaTags = document.querySelectorAll('meta[property^="og:"]');
            const data = {};
            Array.from(metaTags).forEach(tag => {
                var _a;
                const property = (_a = tag.getAttribute('property')) === null || _a === void 0 ? void 0 : _a.replace('og:', '');
                const content = tag.getAttribute('content');
                if (property && content) {
                    data[property] = content;
                }
            });
            return Object.keys(data).length > 0 ? data : null;
        }
        extractNameFromPosition(element) {
            var _a, _b;
            const text = (_a = element.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            if (text && text.length > 0 && text.length < 100) {
                return text;
            }
            const htmlElement = element;
            const heading = htmlElement.closest('h1, h2, h3, h4, h5, h6, [role="heading"]');
            if (heading)
                return ((_b = heading.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || 'UI Element';
            const label = element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                element.getAttribute('alt');
            if (label)
                return label;
            return `Element at (${htmlElement.offsetLeft}, ${htmlElement.offsetTop})`;
        }
        inferTypeFromAttribute(attr) {
            if (attr.includes('song') || attr.includes('track'))
                return 'song';
            if (attr.includes('video'))
                return 'video';
            if (attr.includes('product') || attr.includes('sku') || attr.includes('listing'))
                return 'product';
            if (attr.includes('article') || attr.includes('post') || attr.includes('thread'))
                return 'article';
            if (attr.includes('user') || attr.includes('author'))
                return 'user';
            if (attr.includes('content'))
                return 'content';
            return 'item';
        }
        generateHashId(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        }
        hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        }
        setupDOMMutationObserver() {
            this.domObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        this.scanNewContent(Array.from(mutation.addedNodes));
                    }
                });
            });
            this.domObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        scanNewContent(nodes) {
            nodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node;
                    const items = element.querySelectorAll('[data-item-id], [data-song-id], [data-track-id]');
                    items.forEach(item => {
                        const itemData = this.extractItemDataFromElement(item);
                        if (itemData) {
                            this.itemCache.set(itemData.id, itemData);
                        }
                    });
                }
            });
        }
        detectItem(eventOrElement) {
            if (!eventOrElement)
                return null;
            if (eventOrElement instanceof Event) {
                return this.detectItemFromClick(eventOrElement);
            }
            else if (eventOrElement instanceof Element) {
                let itemData = this.extractItemDataFromElement(eventOrElement);
                if (itemData)
                    return itemData;
                itemData = this.detectItemFromChildren(eventOrElement);
                if (itemData)
                    return itemData;
                console.log('[Recsys AI] ⚠️ Failed to find Item ID in DOM/Children. Falling back.');
                let fallbackItemData = this.detectItemFromLimitedText(eventOrElement) ||
                    this.detectItemFromPosition(eventOrElement);
                if (fallbackItemData) {
                    fallbackItemData.source = 'fallback_' + fallbackItemData.source;
                }
                return fallbackItemData;
            }
            return null;
        }
    }
    function getAIItemDetector() {
        if (!aiItemDetectorInstance) {
            aiItemDetectorInstance = new AIItemDetector();
        }
        return aiItemDetectorInstance;
    }

    const STORAGE_KEYS = {
        ANON_USER_ID: 'recsys_anon_id',
        USER_ID: 'recsys_user_id',
        SESSION_ID: 'recsys_session',
        IDENTIFIERS: 'recsys_identifiers',
        LAST_USER_ID: 'recsys_last_user_id'
    };
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
            this.detector = null;
            this.THROTTLE_DELAY = 300;
            // Wrap handler với error boundary ngay trong constructor
            this.throttledHandler = throttle(this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'), this.THROTTLE_DELAY);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.detector = getAIItemDetector();
                console.log(`[ClickPlugin] initialized for Rule.`);
            }, 'ClickPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (this.tracker && this.detector) {
                    document.addEventListener("click", this.throttledHandler, false);
                    console.log("[ClickPlugin] started Rule-based listening (Throttled).");
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
            if (!this.tracker || !this.detector)
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
            this.detector = null;
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.detector = getAIItemDetector();
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
            if (!this.tracker || !this.detector)
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
                    // AI/Structured Data detection context
                    const structuredItem = this.detector.detectItemFromStructuredData(document.body) ||
                        this.detector.extractOpenGraphData();
                    // Use centralized build and track
                    this.buildAndTrack(structuredItem, rule, eventId);
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

    let identityManagerInstance = null;
    class UserIdentityManager {
        constructor() {
            this.identifiers = {};
            this.sessionId = '';
            this.currentUserId = null;
            this.isLoggedIn = false;
            this.initialized = false;
            this.authRequests = new Set();
            this.tracker = null;
            if (identityManagerInstance) {
                return identityManagerInstance;
            }
            this.identifiers = this.loadIdentifiers();
            this.sessionId = this.generateSessionId();
            identityManagerInstance = this;
            window.identityManager = this;
            window.recsysIdentityManager = this;
        }
        setTracker(tracker) {
            this.tracker = tracker;
        }
        initialize() {
            if (this.initialized)
                return;
            const persistedUserId = this.getPersistedUserId();
            if (persistedUserId && !persistedUserId.startsWith('anon_')) {
                this.currentUserId = persistedUserId;
                this.isLoggedIn = true;
                console.log(`[RECSYS] Restored logged-in user: ${persistedUserId}`);
                this.identifiers.detectedUserId = persistedUserId;
                this.saveIdentifiers();
            }
            else {
                this.currentUserId = this.findOrCreateUserId();
            }
            this.setupEnhancedNetworkMonitoring();
            this.startMonitoring();
            this.initialized = true;
            console.log(`[RECSYS] Identity Manager initialized. Current user: ${this.currentUserId}, Logged in: ${this.isLoggedIn}`);
        }
        getPersistedUserId() {
            if (this.identifiers.detectedUserId && typeof this.identifiers.detectedUserId === 'string' && !this.identifiers.detectedUserId.startsWith('anon_')) {
                return this.identifiers.detectedUserId;
            }
            const storedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
            if (storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null' && !storedUserId.startsWith('anon_')) {
                return storedUserId;
            }
            const anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
            if (anonId) {
                return anonId;
            }
            return null;
        }
        findOrCreateUserId() {
            const userId = this.extractUserIdFromCookies() ||
                this.extractUserIdFromLocalStorage() ||
                this.extractUserIdFromJWT(localStorage.getItem('token'));
            if (userId && !userId.startsWith('anon_')) {
                this.handleDetectedUserId(userId, 'initial_lookup');
                this.isLoggedIn = true;
                return userId;
            }
            let anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
            if (!anonId) {
                anonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, anonId);
            }
            this.isLoggedIn = false;
            return anonId;
        }
        getUserId() {
            if (this.currentUserId) {
                return this.currentUserId;
            }
            return this.findOrCreateUserId();
        }
        getStableUserId() {
            return this.currentUserId || this.getUserId();
        }
        getRealUserId() {
            if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
                return this.currentUserId;
            }
            return this.getUserId();
        }
        refreshUserId() {
            const oldUserId = this.currentUserId;
            const newUserId = this.findOrCreateUserId();
            if (oldUserId !== newUserId) {
                const wasLoggedIn = this.isLoggedIn;
                this.isLoggedIn = !newUserId.startsWith('anon_');
                console.log(`[RECSYS] User ID changed: ${oldUserId} -> ${newUserId}, Login status: ${wasLoggedIn} -> ${this.isLoggedIn}`);
                this.currentUserId = newUserId;
                window.dispatchEvent(new CustomEvent('recsys:userIdChanged', {
                    detail: {
                        oldUserId,
                        newUserId,
                        wasLoggedIn,
                        isNowLoggedIn: this.isLoggedIn,
                        sessionId: this.sessionId
                    }
                }));
            }
            return newUserId;
        }
        setupEnhancedNetworkMonitoring() {
            const self = this;
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const [resource] = args;
                const url = typeof resource === 'string' ? resource : resource.url;
                if (url && (url.includes('/auth') || url.includes('/login') || url.includes('/signin'))) {
                    self.authRequests.add(url);
                }
                try {
                    const response = await originalFetch(...args);
                    const clonedResponse = response.clone();
                    if (url && self.authRequests.has(url)) {
                        setTimeout(() => { self.processAuthResponse(url, clonedResponse); }, 100);
                    }
                    return response;
                }
                catch (error) {
                    console.log('❌ Fetch error:', error);
                    throw error;
                }
            };
            if (window.XMLHttpRequest) {
                const originalOpen = XMLHttpRequest.prototype.open;
                const originalSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function (method, url) {
                    this._url = url;
                    this._method = method;
                    if (url && (url.includes('/auth') || url.includes('/login') || url.includes('/signin'))) {
                        this._isAuthRequest = true;
                    }
                    return originalOpen.apply(this, arguments);
                };
                XMLHttpRequest.prototype.send = function (_body) {
                    const xhr = this;
                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            if (xhr._isAuthRequest) {
                                setTimeout(() => { self.processXHRAuthResponse(xhr); }, 100);
                            }
                            setTimeout(() => { self.checkResponseForUserData(xhr); }, 150);
                        }
                    });
                    return originalSend.apply(this, arguments);
                };
            }
            this.setupLocalStorageMonitor();
            this.setupCookieMonitor();
        }
        async processAuthResponse(_url, response) {
            try {
                const data = await response.json();
                const userId = this.extractUserIdFromObject(data);
                if (userId) {
                    this.handleDetectedUserId(userId, 'auth_response');
                }
                else {
                    setTimeout(() => { this.checkAllSourcesForUserId(); }, 1000);
                }
            }
            catch (e) { }
        }
        processXHRAuthResponse(xhr) {
            try {
                const data = JSON.parse(xhr.responseText);
                const userId = this.extractUserIdFromObject(data);
                if (userId) {
                    this.handleDetectedUserId(userId, 'xhr_auth_response');
                }
            }
            catch (e) { }
        }
        checkResponseForUserData(xhr) {
            try {
                const data = JSON.parse(xhr.responseText);
                const userId = this.extractUserIdFromObject(data);
                if (userId && !this.authRequests.has(xhr._url)) {
                    this.handleDetectedUserId(userId, 'api_response');
                }
            }
            catch (e) { /* Ignore */ }
        }
        // --- LOGIN HANDLERS ---
        handleDetectedUserId(userId, _source) {
            if (this.currentUserId && !this.currentUserId.startsWith('anon_')) {
                console.log(`[RECSYS] User already authenticated as ${this.currentUserId}. Ignoring ${userId} from ${_source}`);
                return;
            }
            if (userId && !userId.startsWith('anon_')) {
                const oldUserId = this.currentUserId;
                const wasAnonymous = oldUserId && oldUserId.startsWith('anon_');
                if (wasAnonymous) {
                    console.log(`[RECSYS CAPTURE] User logged in: ${oldUserId} -> ${userId} (Source: ${_source})`);
                    this.onUserLoginDetected(oldUserId, userId, _source);
                }
                else if (oldUserId !== userId) {
                    console.log(`[RECSYS CAPTURE] User ID updated: ${oldUserId} -> ${userId} (Source: ${_source})`);
                }
                this.currentUserId = userId;
                this.isLoggedIn = true;
                localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
                this.identifiers.detectedUserId = userId;
                this.identifiers.detectionMethod = _source;
                this.identifiers.detectionTime = new Date().toISOString();
                this.saveIdentifiers();
                // Sync to Tracker if available
                if (this.tracker) {
                    this.tracker.setUserId(userId);
                }
            }
        }
        onUserLoginDetected(anonymousId, userId, _source) {
            this.sendLoginEvent(anonymousId, userId, _source);
            window.dispatchEvent(new CustomEvent('recsys:userLoggedIn', {
                detail: {
                    userId: userId,
                    anonymousId: anonymousId,
                    detectionMethod: _source,
                    sessionId: this.sessionId,
                    timestamp: new Date().toISOString()
                }
            }));
        }
        sendLoginEvent(anonymousId, userId, _source) {
            console.log(`[RECSYS CAPTURE] Login event prepared for User ID: ${userId} (from ${anonymousId}).`);
        }
        checkAllSourcesForUserId() {
            const cookieUserId = this.extractUserIdFromCookies();
            if (cookieUserId) {
                this.handleDetectedUserId(cookieUserId, 'cookies_after_login');
                return;
            }
            const lsUserId = this.extractUserIdFromLocalStorage();
            if (lsUserId) {
                this.handleDetectedUserId(lsUserId, 'localStorage_after_login');
                return;
            }
            setTimeout(() => { this.checkCommonUserEndpoints(); }, 2000);
            this.startPostLoginPolling();
        }
        startPostLoginPolling() {
            let attempts = 0;
            const maxAttempts = 10;
            const poll = () => {
                attempts++;
                const cookieId = this.extractUserIdFromCookies();
                const lsId = this.extractUserIdFromLocalStorage();
                if (cookieId) {
                    this.handleDetectedUserId(cookieId, 'polling_cookies');
                    return;
                }
                if (lsId) {
                    this.handleDetectedUserId(lsId, 'polling_localStorage');
                    return;
                }
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000);
                }
            };
            setTimeout(poll, 1000);
        }
        checkCommonUserEndpoints() {
            const endpoints = ['/user/profile', '/api/me', '/user/me', '/account/info'];
            endpoints.forEach(endpoint => {
                fetch(endpoint, { method: 'GET', credentials: 'include' })
                    .then(res => res.json())
                    .then(data => {
                    const userId = this.extractUserIdFromObject(data);
                    if (userId) {
                        this.handleDetectedUserId(userId, `endpoint_${endpoint}`);
                    }
                }).catch(() => { });
            });
        }
        setupLocalStorageMonitor() {
            const self = this;
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = function (key, value) {
                originalSetItem.call(this, key, value);
                if (self.isUserRelatedKey(key)) {
                    window.dispatchEvent(new CustomEvent('storage', {
                        detail: { key, newValue: value, storageArea: this }
                    }));
                }
            };
            window.addEventListener('storage', ((e) => {
                if (this.isUserRelatedKey(e.key)) {
                    setTimeout(() => {
                        const userId = this.extractUserIdFromLocalStorage();
                        if (userId && !userId.startsWith('anon_')) {
                            this.handleDetectedUserId(userId, 'localStorage_event');
                        }
                    }, 100);
                }
            }));
        }
        setupCookieMonitor() {
            let lastCookieString = document.cookie;
            setInterval(() => {
                const currentCookieString = document.cookie;
                if (currentCookieString !== lastCookieString) {
                    lastCookieString = currentCookieString;
                    const userId = this.extractUserIdFromCookies();
                    if (userId && !userId.startsWith('anon_')) {
                        this.handleDetectedUserId(userId, 'cookies_polling');
                    }
                }
            }, 2000);
        }
        isUserRelatedKey(key) {
            if (!key)
                return false;
            const keywords = ['user', 'auth', 'token', 'session', 'login', 'profile', 'id', 'account'];
            return keywords.some(kw => key.toLowerCase().includes(kw.toLowerCase()));
        }
        extractUserIdFromCookies() {
            const cookies = document.cookie.split(';');
            const cookieMap = {};
            cookies.forEach(cookie => {
                const parts = cookie.trim().split('=');
                const key = parts[0];
                const value = parts.slice(1).join('=');
                if (key && value)
                    cookieMap[key] = decodeURIComponent(value);
            });
            const possibleKeys = ['userId', 'user_id', 'uid', 'user-id', 'auth_user_id', STORAGE_KEYS.USER_ID];
            for (const key of possibleKeys) {
                if (cookieMap[key] && cookieMap[key] !== 'undefined') {
                    return cookieMap[key];
                }
            }
            const jwtKeys = ['token', 'access_token', 'jwt', 'auth_token'];
            for (const key of jwtKeys) {
                if (cookieMap[key]) {
                    const userId = this.extractUserIdFromJWT(cookieMap[key]);
                    if (userId)
                        return userId;
                }
            }
            return null;
        }
        extractUserIdFromLocalStorage() {
            try {
                const possibleKeys = [
                    'user_id', 'userId', 'uid', 'customer_id',
                    'user', 'userData', 'auth', 'currentUser', 'userInfo', 'profile', 'account',
                    STORAGE_KEYS.USER_ID
                ];
                for (const key of possibleKeys) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        try {
                            const parsed = JSON.parse(value);
                            const id = this.extractUserIdFromObject(parsed);
                            if (id)
                                return id;
                        }
                        catch (e) {
                            if (value.length < 100 && !value.includes('.')) {
                                return value;
                            }
                        }
                    }
                }
                const tokenKeys = ['token', 'access_token', 'jwt', 'auth_token'];
                for (const key of tokenKeys) {
                    const token = localStorage.getItem(key);
                    if (token) {
                        const userId = this.extractUserIdFromJWT(token);
                        if (userId)
                            return userId;
                    }
                }
            }
            catch (e) {
                return null;
            }
            return null;
        }
        extractUserIdFromJWT(token) {
            if (!token || !token.includes('.'))
                return null;
            try {
                const payload = token.split('.')[1];
                const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
                return decoded.sub || decoded.userId || decoded.id || decoded.user_id || decoded.UserId;
            }
            catch (e) {
                return null;
            }
        }
        extractUserIdFromObject(obj) {
            if (!obj || typeof obj !== 'object')
                return null;
            const idKeys = ['id', 'userId', 'user_id', 'uid', '_id', 'userID', 'UserId', 'UserID'];
            for (const key of idKeys) {
                if (obj[key] && obj[key] !== 'undefined' && obj[key] !== 'null') {
                    return String(obj[key]);
                }
            }
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found = this.extractUserIdFromObject(obj[key]);
                    if (found)
                        return found;
                }
            }
            return null;
        }
        generateSessionId() {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        }
        loadIdentifiers() {
            try {
                const stored = localStorage.getItem(STORAGE_KEYS.IDENTIFIERS);
                return stored ? JSON.parse(stored) : {};
            }
            catch (e) {
                return {};
            }
        }
        saveIdentifiers() {
            try {
                localStorage.setItem(STORAGE_KEYS.IDENTIFIERS, JSON.stringify(this.identifiers));
            }
            catch (e) { /* Ignore */ }
        }
        startMonitoring() {
            setInterval(() => {
                if (!this.isLoggedIn || (this.currentUserId && this.currentUserId.startsWith('anon_'))) {
                    const newUserId = this.findOrCreateUserId();
                    if (newUserId !== this.currentUserId && !newUserId.startsWith('anon_')) {
                        console.log(`[RECSYS] Monitoring detected login: ${this.currentUserId} -> ${newUserId}`);
                        this.handleDetectedUserId(newUserId, 'monitoring');
                    }
                }
            }, 5000);
        }
        getUserInfo() {
            return {
                userId: this.currentUserId,
                isLoggedIn: this.isLoggedIn,
                sessionId: this.sessionId,
                detectionMethod: this.identifiers.detectionMethod,
                detectionTime: this.identifiers.detectionTime,
                isAnonymous: this.currentUserId ? this.currentUserId.startsWith('anon_') : true
            };
        }
        logout() {
            const oldUserId = this.currentUserId;
            this.currentUserId = null;
            this.isLoggedIn = false;
            localStorage.removeItem(STORAGE_KEYS.USER_ID);
            const newAnonId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, newAnonId);
            this.currentUserId = newAnonId;
            console.log(`[RECSYS] User logged out: ${oldUserId} -> ${newAnonId}`);
            window.dispatchEvent(new CustomEvent('recsys:userLoggedOut', {
                detail: {
                    oldUserId,
                    newUserId: newAnonId,
                    sessionId: this.sessionId
                }
            }));
        }
    }
    function getUserIdentityManager() {
        if (!identityManagerInstance) {
            identityManagerInstance = new UserIdentityManager();
        }
        return identityManagerInstance;
    }

    const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };
    const CONDITION_PATTERN_ID = { URL_PARAM: 1, CSS_SELECTOR: 2, DOM_ATTRIBUTE: 3, DATA_ATTRIBUTE: 4 };
    const OPERATOR_ID = { CONTAINS: 1, NOT_CONTAINS: 2, STARTS_WITH: 3, ENDS_WITH: 4, EQUALS: 5, EXISTS: 7, NOT_EXISTS: 8 };
    class ReviewPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ReviewPlugin';
            this.detector = null;
            this.identityManager = null;
            this.handleSubmitBound = this.handleSubmit.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.detector = getAIItemDetector();
                this.identityManager = getUserIdentityManager();
                this.identityManager.initialize();
                console.log(`[ReviewPlugin] initialized.`);
            }, 'ReviewPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                document.addEventListener('submit', this.handleSubmitBound, { capture: true });
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
            // Trigger ID for Review is typically 5 (or configured)
            const eventId = this.tracker.getEventTypeId('Review') || 5;
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
                // 3. Construct Payload
                const payload = this.constructPayload(form, rule, eventId);
                // 4. Send Event
                this.tracker.track(payload);
                console.log(payload);
                return;
            }
            console.log("❌ [ReviewPlugin] No rules matched the current form.");
        }
        constructPayload(form, rule, eventId) {
            // Extract via PayloadBuilder
            const mappedData = this.tracker.payloadBuilder.build(form, rule);
            console.log("🧩 [ReviewPlugin] Mapped Data from Config:", mappedData);
            // Basic Payload
            const payload = {
                eventTypeId: eventId,
                trackingRuleId: Number(rule.id),
                userField: 'UserId',
                userValue: '',
                itemField: 'ItemId',
                itemValue: '',
                value: ''
            };
            const potentialUserKeys = ['userId', 'userName', 'userUID'];
            const potentialItemKeys = ['itemId', 'itemName', 'itemUID'];
            // Map Extracted Data
            for (const key of potentialUserKeys) {
                if (mappedData[key]) {
                    payload.userField = key;
                    payload.userValue = mappedData[key];
                    break;
                }
            }
            for (const key of potentialItemKeys) {
                if (mappedData[key]) {
                    payload.itemField = key;
                    payload.itemValue = mappedData[key];
                    break;
                }
            }
            const content = mappedData.review_text || mappedData.content || mappedData.value || mappedData.review;
            if (content) {
                payload.value = content;
            }
            // --- FALLBACK ITEM ID ---
            if (!payload.itemValue) {
                console.log("⚠️ [ReviewPlugin] Missing ItemId from config. Trying Auto-detect...");
                const radarScan = this.scanSurroundingContext(form);
                if (radarScan.id) {
                    payload.itemValue = radarScan.id;
                }
                else if (this.detector) {
                    const aiItem = this.detector.detectItem(form);
                    if (aiItem && aiItem.id && aiItem.id !== 'N/A (Failed)') {
                        payload.itemValue = aiItem.id;
                    }
                }
            }
            // --- FALLBACK USER ID ---
            if (!payload.userValue && this.identityManager) {
                console.log("⚠️ [ReviewPlugin] Missing UserId from config. Trying IdentityManager...");
                const realId = this.identityManager.getRealUserId();
                const stableId = this.identityManager.getStableUserId();
                if (realId && !realId.startsWith('anon_')) {
                    payload.userValue = realId;
                }
                else if (stableId) {
                    payload.userValue = stableId;
                }
            }
            // --- FALLBACK REVIEW CONTENT ---
            if (!payload.value) {
                const autoContent = this.autoDetectReviewContent(form);
                if (autoContent) {
                    console.log("⚠️ [ReviewPlugin] Auto-detected review content from form fields.");
                    payload.value = autoContent;
                }
            }
            return payload;
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
                    case CONDITION_PATTERN_ID.URL_PARAM:
                        const p = new URLSearchParams(location.search);
                        actual = p.get(val);
                        break;
                    case CONDITION_PATTERN_ID.CSS_SELECTOR:
                        try {
                            isMet = form.matches(val);
                            if (operator === OPERATOR_ID.EXISTS && !isMet)
                                return false;
                            if (operator === OPERATOR_ID.NOT_EXISTS && isMet)
                                return false;
                            actual = isMet ? 'true' : 'false';
                        }
                        catch {
                            return false;
                        }
                        break;
                    case CONDITION_PATTERN_ID.DOM_ATTRIBUTE:
                        actual = form.id;
                        break;
                    case CONDITION_PATTERN_ID.DATA_ATTRIBUTE:
                        actual = form.getAttribute(val);
                        break;
                }
                if (pattern === CONDITION_PATTERN_ID.CSS_SELECTOR && (operator === OPERATOR_ID.EXISTS || operator === OPERATOR_ID.NOT_EXISTS))
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
        scanSurroundingContext(element) {
            const getAttrs = (el) => {
                if (!el)
                    return null;
                const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
                if (id)
                    return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
                return null;
            };
            const ancestor = element.closest('[data-item-id], [data-product-id]');
            if (ancestor) {
                const data = getAttrs(ancestor);
                if (data)
                    return { ...data, source: 'ancestor_attribute' };
            }
            const textContainers = Array.from(element.querySelectorAll('label, legend, h3, h4, .product-title'));
            for (const container of textContainers) {
                const text = container.textContent || '';
                const idMatch = text.match(/\((P-[A-Z0-9-]+)\)/i);
                if (idMatch && idMatch[1])
                    return { id: idMatch[1], source: 'text_heuristic_brackets' };
                const codeMatch = text.match(/(?:code|sku|id|mã)[:\s]+([A-Z0-9-]+)/i);
                if (codeMatch && codeMatch[1])
                    return { id: codeMatch[1], source: 'text_heuristic_label' };
            }
            const params = new URLSearchParams(window.location.search);
            const urlId = params.get('id') || params.get('productId') || params.get('product_id');
            if (urlId)
                return { id: urlId, source: 'url_param' };
            return {};
        }
        compareValues(actual, expected, op) {
            if (!actual)
                actual = '';
            if (op === OPERATOR_ID.EQUALS)
                return actual == expected;
            if (op === OPERATOR_ID.CONTAINS)
                return actual.includes(expected);
            if (op === OPERATOR_ID.NOT_CONTAINS)
                return !actual.includes(expected);
            if (op === OPERATOR_ID.STARTS_WITH)
                return actual.startsWith(expected);
            if (op === OPERATOR_ID.ENDS_WITH)
                return actual.endsWith(expected);
            if (op === OPERATOR_ID.EXISTS)
                return actual !== '' && actual !== null;
            if (op === OPERATOR_ID.NOT_EXISTS)
                return actual === '' || actual === null;
            return false;
        }
    }

    var reviewPlugin = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ReviewPlugin: ReviewPlugin
    });

    // CONDITION PATTERNS
    const CONDITION_PATTERN = {
        URL_PARAM: 1, CSS_SELECTOR: 2, DOM_ATTRIBUTE: 3, DATA_ATTRIBUTE: 4,
    };
    // OPERATORS
    const TARGET_OPERATOR = {
        CONTAINS: 1, NOT_CONTAINS: 2, STARTS_WITH: 3, ENDS_WITH: 4, EQUALS: 5, NOT_EQUALS: 6, EXISTS: 8, NOT_EXISTS: 9
    };
    class ScrollPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ScrollPlugin';
            this.identityManager = null;
            this.detector = null;
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
                this.identityManager = getUserIdentityManager();
                this.identityManager.initialize();
                this.detector = getAIItemDetector();
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
            if (!this.tracker || !this.detector)
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
            var _a;
            let detected = (_a = this.detector) === null || _a === void 0 ? void 0 : _a.detectItem(element);
            if (!detected || !detected.id || detected.id === 'N/A (Failed)') {
                console.log("🔍 [ScrollPlugin] AI failed. Scanning radar...");
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
            }
            else {
                this.currentItemContext = detected;
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
                    case CONDITION_PATTERN.URL_PARAM:
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.has(expectedValue))
                            actualValue = urlParams.get(expectedValue);
                        else
                            actualValue = window.location.href;
                        break;
                    case CONDITION_PATTERN.CSS_SELECTOR:
                        try {
                            isMet = element.matches(expectedValue);
                            if (this.isNegativeOperator(operatorId)) {
                                if (!isMet)
                                    continue;
                                return false;
                            }
                            if (!isMet)
                                return false;
                            continue;
                        }
                        catch {
                            return false;
                        }
                    case CONDITION_PATTERN.DOM_ATTRIBUTE:
                        actualValue = element.id;
                        break;
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
                case TARGET_OPERATOR.NOT_EQUALS: return actual !== expected;
                case TARGET_OPERATOR.CONTAINS: return actual.includes(expected);
                case TARGET_OPERATOR.NOT_CONTAINS: return !actual.includes(expected);
                case TARGET_OPERATOR.STARTS_WITH: return actual.startsWith(expected);
                case TARGET_OPERATOR.ENDS_WITH: return actual.endsWith(expected);
                case TARGET_OPERATOR.EXISTS: return actual !== '' && actual !== null;
                case TARGET_OPERATOR.NOT_EXISTS: return actual === '' || actual === null;
                default: return actual === expected;
            }
        }
        isNegativeOperator(opId) {
            return opId === TARGET_OPERATOR.NOT_EQUALS || opId === TARGET_OPERATOR.NOT_CONTAINS || opId === TARGET_OPERATOR.NOT_EXISTS;
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
            this.enrichUserIdentity(payload);
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
            this.enrichUserIdentity(payload);
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
        enrichUserIdentity(payload) {
            if (this.identityManager) {
                const uid = this.identityManager.getRealUserId() || this.identityManager.getStableUserId();
                // Don't override if extracted from builder? 
                if (uid && !uid.startsWith('anon_') && !payload.userValue)
                    payload.userValue = uid;
                const uInfo = this.identityManager.getUserInfo();
                if (uInfo.sessionId) {
                    if (!payload.metadata)
                        payload.metadata = {};
                    payload.metadata.sessionId = uInfo.sessionId;
                }
            }
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

    class NetworkExtractor {
        extract(mapping, context) {
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
                // Smart inference if source is generic 'network_request'
                // Try Request first, then Response? Or based on Method?
                // User logic: "Logic similar to tracker.js 'inferSource'..."
                let val = this.traverseObject(context.reqBody, path);
                if (this.isValid(val))
                    return val;
                val = this.traverseObject(context.resBody, path);
                if (this.isValid(val))
                    return val;
            }
            return null;
        }
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
        // Singleton / Shared instances
        constructor() {
            this.extractors = new Map();
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
        isValid(val) {
            return val !== null && val !== undefined && val !== '';
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
            this.detector = null;
            this.throttledClickHandler = throttle(this.wrapHandler(this.handleInteraction.bind(this, 'click'), 'handleClick'), 500);
            this.submitHandler = this.wrapHandler(this.handleInteraction.bind(this, 'submit'), 'handleSubmit');
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.detector = getAIItemDetector();
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
                console.log("[RatingPlugin] started listening (Universal Mode).");
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
            var _a, _b;
            if (!this.tracker || !this.detector)
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
                        // Detect Item ID
                        let structuredItem = null;
                        if (!((_b = rule.trackingTarget.value) === null || _b === void 0 ? void 0 : _b.startsWith('^'))) {
                            structuredItem = this.detector.detectItem(container);
                        }
                        // Build Payload using centralized method
                        this.buildAndTrack(structuredItem || matchedElement, rule, eventId, {
                            value: result.reviewText || String(result.normalizedValue),
                            metadata: {
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
                // Chờ tất cả plugin được đăng ký trước khi khởi động
                if (pluginPromises.length > 0) {
                    await Promise.all(pluginPromises);
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

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=recsys-tracker.umd.js.map
