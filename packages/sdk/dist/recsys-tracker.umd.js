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
            const baseUrl = "http://localhost:3000";
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
                ratingValue: event.ratingValue,
                reviewValue: event.reviewValue,
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
                RatingValue: event.ratingValue,
                ReviewValue: event.reviewValue
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
                            ratingValue: event.ratingValue,
                            reviewValue: event.reviewValue,
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
            this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                if (this.tracker) {
                    console.warn(`[${this.name}] Plugin already initialized`);
                    return;
                }
                this.tracker = tracker;
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

    // import { IRecsysContext, TrackingRule, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData, IPayloadBuilder } from '../interfaces/recsys-context.interface';
    // import { getUserIdentityManager } from '../utils/user-identity-manager';
    // import { getAIItemDetector } from '../utils/ai-item-detector';
    // import { RecSysTracker } from '../../..';
    // import { PayloadExtractor } from '../../../types';
    class TrackerContextAdapter {
        constructor(tracker) {
            this.config = {
                getRules: (eventTypeId) => {
                    const config = this.tracker.getConfig();
                    if (!(config === null || config === void 0 ? void 0 : config.trackingRules))
                        return [];
                    return config.trackingRules
                        .filter(rule => rule.eventTypeId === eventTypeId);
                },
            };
            /**
             * [FIX QUAN TRỌNG]
             * Thay vì hard-code logic build payload ở đây, ta trỏ nó về
             * instance payloadBuilder của tracker (Class PayloadBuilder xịn đã viết).
             * Dùng getter và ép kiểu để TypeScript hiểu nó hỗ trợ Overload.
             */
            this.eventBuffer = {
                enqueue: (payload) => {
                    // 1. Map Event Type từ Plugin sang ENUM của Database
                    let eventType = 'page_view';
                    switch (payload.event) {
                        case 'item_click':
                            eventType = 'click';
                            break;
                        case 'rate_submit':
                            eventType = 'rating';
                            break; // FormPlugin cũ
                        case 'review':
                            eventType = 'review';
                            break; // ReviewPlugin mới
                        case 'scroll_depth':
                            eventType = 'scroll';
                            break;
                        case 'page_view':
                            eventType = 'page_view';
                            break;
                        default: eventType = 'page_view';
                    }
                    // 2. Chuẩn bị object phẳng (Flat Data)
                    const trackData = {
                        eventType,
                        // Map User/Item Value
                        userValue: String(payload.userId || ''),
                        userField: 'user_id', // Mặc định hoặc lấy từ metadata nếu cần
                        itemValue: String(payload.itemId || ''),
                        itemField: 'item_id', // Mặc định
                    };
                    // 3. Map Rating & Review Value từ Metadata
                    if (payload.metadata) {
                        // Trường hợp 1: Review Plugin mới (Review nằm trong content)
                        if (eventType === 'review' && payload.metadata.content) {
                            trackData.reviewValue = String(payload.metadata.content);
                        }
                        // Trường hợp 2: Form Plugin cũ (Rate + Review chung)
                        // Map vào RatingValue
                        if (payload.metadata.rateValue !== undefined) {
                            const rateVal = Number(payload.metadata.rateValue);
                            if (!isNaN(rateVal)) {
                                trackData.ratingValue = rateVal;
                            }
                        }
                        // Map vào ReviewValue (nếu form đó có cả review text)
                        if (payload.metadata.reviewText) {
                            trackData.reviewValue = String(payload.metadata.reviewText);
                        }
                    }
                    // 4. Chỉ gửi nếu có ItemID hợp lệ (tùy logic bên bạn)
                    if (trackData.itemValue && !trackData.itemValue.startsWith('N/A')) {
                        this.tracker.track(trackData);
                    }
                },
            };
            this.tracker = tracker;
        }
        get payloadBuilder() {
            // Dùng (this.tracker as any) để tránh lỗi nếu RecSysTracker chưa kịp cập nhật type
            return this.tracker.payloadBuilder;
        }
        updateIdentity(newUserId) {
            console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
            this.tracker.setUserId(newUserId);
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
            this.context = null;
            this.detector = null;
            this.THROTTLE_DELAY = 300;
            // Wrap handler với error boundary ngay trong constructor
            this.throttledHandler = throttle(this.wrapHandler(this.handleDocumentClick.bind(this), 'handleDocumentClick'), this.THROTTLE_DELAY);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.context = new TrackerContextAdapter(tracker);
                this.detector = getAIItemDetector();
                console.log(`[ClickPlugin] initialized for Rule + AI-based tracking.`);
            }, 'ClickPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (this.context && this.detector) {
                    document.addEventListener("click", this.throttledHandler, false);
                    console.log("[ClickPlugin] started Rule + AI-based listening (Throttled).");
                    this.active = true;
                }
            }, 'ClickPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                document.removeEventListener("click", this.throttledHandler, false);
                super.stop();
            }, 'ClickPlugin.stop');
        }
        handleDocumentClick(event) {
            if (!this.context || !this.detector || !this.tracker)
                return;
            const eventId = this.tracker.getEventTypeId('Click');
            if (!eventId)
                return;
            const clickRules = this.context.config.getRules(eventId);
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
                    const payload = this.context.payloadBuilder.build(matchedElement, rule);
                    this.context.eventBuffer.enqueue(payload);
                    // Stop after first match (hoặc có thể tiếp tục nếu muốn track nhiều rules)
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
            this.context = null;
            this.detector = null;
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.context = new TrackerContextAdapter(tracker);
                this.detector = getAIItemDetector();
                console.log(`[PageViewPlugin] initialized for Rule + AI tracking.`);
            }, 'PageViewPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (!this.context || !this.detector)
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
            var _a;
            if (!this.context || !this.detector || !this.tracker)
                return;
            const urlObject = new URL(currentUrl);
            const pathname = urlObject.pathname;
            const eventId = this.tracker.getEventTypeId('Page View');
            if (!eventId) {
                console.log('[PageViewPlugin] Page View event type not found in config.');
                return;
            }
            const pageViewRules = this.context.config.getRules(eventId);
            if (pageViewRules.length === 0) {
                console.log('[PageViewPlugin] No page view rules configured.');
                return;
            }
            // Loop qua tất cả rules và tìm rule phù hợp
            for (const rule of pageViewRules) {
                let matchFound = false;
                let matchData = null;
                const selector = ((_a = rule.trackingTarget) === null || _a === void 0 ? void 0 : _a.value) || '';
                // Determine payload extractor from rule data
                const isRegex = selector.startsWith('^');
                const extractorSource = isRegex ? 'regex_group' : 'ai_detect';
                // Regex-based matching (URL pattern)
                if (extractorSource === 'regex_group' && selector && selector.startsWith('^')) {
                    const pattern = new RegExp(selector);
                    const match = pathname.match(pattern);
                    if (match) {
                        matchFound = true;
                        matchData = { regexMatch: match };
                        console.log(`[PageViewPlugin] ✅ Matched regex rule: ${rule.name}`);
                    }
                }
                // DOM selector matching
                else if (selector && selector !== 'body') {
                    if (document.querySelector(selector)) {
                        matchFound = true;
                        console.log(`[PageViewPlugin] ✅ Matched DOM selector rule: ${rule.name}`);
                    }
                }
                // Default body matching with AI
                else if (selector === 'body' && extractorSource === 'ai_detect') {
                    matchFound = true;
                    console.log(`[PageViewPlugin] ✅ Matched default AI rule: ${rule.name}`);
                }
                if (matchFound) {
                    let structuredItem = null;
                    // AI detection if needed
                    if (extractorSource === 'ai_detect') {
                        structuredItem = this.detector.detectItemFromStructuredData(document.body) ||
                            this.detector.extractOpenGraphData();
                    }
                    const payload = this.context.payloadBuilder.build(structuredItem, rule, matchData || undefined);
                    this.context.eventBuffer.enqueue(payload);
                    // Stop after first match (hoặc tiếp tục nếu muốn track nhiều rules)
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
            this.trackerContext = null;
            if (identityManagerInstance) {
                return identityManagerInstance;
            }
            this.identifiers = this.loadIdentifiers();
            this.sessionId = this.generateSessionId();
            identityManagerInstance = this;
            window.identityManager = this;
            window.recsysIdentityManager = this;
        }
        setTrackerContext(context) {
            this.trackerContext = context;
            this.setupIdentitySynchronization();
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
        // Đã đổi tên 'source' thành '_source'
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
            }
        }
        // Đã đổi tên 'source' thành '_source'
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
        setupIdentitySynchronization() {
            if (!this.trackerContext)
                return;
            window.addEventListener('recsys:userLoggedIn', ((event) => {
                const customEvent = event;
                const newUserId = customEvent.detail.userId;
                const source = customEvent.detail.detectionMethod;
                if (newUserId) {
                    this.trackerContext.updateIdentity(newUserId);
                    console.log(`[Context Sync] User ID synced from IdentityManager (${source}).`);
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

    // Target Element chỉ cho phép CSS Selector
    const TARGET_PATTERN_ID = { CSS_SELECTOR: 1 };
    // Condition Patterns
    const CONDITION_PATTERN_ID = {
        URL_PARAM: 1,
        CSS_SELECTOR: 2,
        DOM_ATTRIBUTE: 3,
        DATA_ATTRIBUTE: 4
    };
    const OPERATOR_ID = {
        CONTAINS: 1,
        NOT_CONTAINS: 2,
        STARTS_WITH: 3,
        ENDS_WITH: 4,
        EQUALS: 5,
        EXISTS: 7,
        NOT_EXISTS: 8
    };
    class ReviewPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ReviewPlugin';
            this.context = null;
            this.detector = null;
            this.identityManager = null;
            this.handleSubmitBound = this.handleSubmit.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.context = new TrackerContextAdapter(tracker);
                this.detector = getAIItemDetector();
                this.identityManager = getUserIdentityManager();
                this.identityManager.initialize();
                if (this.context)
                    this.identityManager.setTrackerContext(this.context);
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
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
                super.stop();
            }, 'ReviewPlugin.stop');
        }
        handleSubmit(event) {
            console.log("🔥 [ReviewPlugin] Detected SUBMIT event!");
            if (!this.context || !this.tracker)
                return;
            const form = event.target;
            console.log(`📝 [ReviewPlugin] Checking form: #${form.id} (Classes: ${form.className})`);
            // Giả sử Trigger ID cho Review là 5
            const reviewRules = this.context.config.getRules(5);
            console.log(`🔎 [ReviewPlugin] Found ${reviewRules.length} rules for TriggerID=5`);
            if (reviewRules.length === 0) {
                console.warn("⚠️ [ReviewPlugin] No rules found! Check ConfigLoader or TriggerID.");
                return;
            }
            for (const rule of reviewRules) {
                // 1. Check Target (Bắt buộc CSS Selector)
                if (!this.checkTargetMatch(form, rule))
                    continue;
                // 2. Check Condition (Optional)
                if (!this.checkConditions(form, rule))
                    continue;
                console.log(`✅ [ReviewPlugin] Match Rule: "${rule.name}"`);
                // 3. XÂY DỰNG PAYLOAD (Core Logic)
                const payload = this.constructPayload(form, rule);
                // 4. Gửi Event
                this.tracker.track(payload);
                console.log(payload);
                return;
            }
            console.log("❌ [ReviewPlugin] No rules matched the current form.");
        }
        /**
         * Logic xây dựng Payload theo thứ tự ưu tiên:
         * Config (PayloadBuilder) -> Fallback (AI/Radar/Identity)
         */
        constructPayload(form, rule) {
            const mappedData = this.context.payloadBuilder.build(rule.payloadMappings || [], form);
            console.log("🧩 [ReviewPlugin] Mapped Data from Config:", mappedData);
            // Khởi tạo payload cơ bản
            const payload = {
                eventTypeId: 5,
                trackingRuleId: Number(rule.id),
                userField: 'UserId',
                userValue: '',
                itemField: 'ItemId',
                itemValue: '',
                ratingValue: undefined,
                reviewValue: ''
            };
            const potentialUserKeys = ['userId', 'userName', 'userUID'];
            const potentialItemKeys = ['itemId', 'itemName', 'itemUID'];
            // B. Mapping dữ liệu từ Config vào Payload
            // if (mappedData.userId) payload.userId = mappedData.userId;
            // if (mappedData.itemId) payload.itemId = mappedData.itemId;
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
            // [FIX] Xử lý review_text
            const content = mappedData.review_text || mappedData.content || mappedData.value || mappedData.review;
            if (content) {
                payload.reviewValue = content;
            }
            // C. [PRIORITY 2] Fallback Logic (Chỉ chạy khi thiếu dữ liệu)
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
            // Nếu user quên map field review_text, thử tự tìm
            if (!payload.reviewValue) {
                const autoContent = this.autoDetectReviewContent(form);
                if (autoContent) {
                    console.log("⚠️ [ReviewPlugin] Auto-detected review content from form fields.");
                    payload.reviewValue = autoContent;
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
            // Cast any để tránh lỗi TS iterator nếu không có type lib mới
            for (const [key, val] of formData) {
                const k = key.toLowerCase();
                const vStr = String(val);
                // Tìm các input có tên chứa 'review', 'comment', 'body' và lấy chuỗi dài nhất
                if (k.includes('review') || k.includes('comment') || k.includes('body') || k.includes('content')) {
                    if (vStr.length > content.length)
                        content = vStr;
                }
            }
            return content;
        }
        scanSurroundingContext(element) {
            // 1. ANCESTOR SCAN (Ưu tiên cao nhất: Tìm attribute chuẩn)
            const ancestor = element.closest('[data-item-id], [data-product-id]');
            if (ancestor) {
                return {
                    id: ancestor.getAttribute('data-item-id') || ancestor.getAttribute('data-product-id'),
                    name: ancestor.getAttribute('data-item-name') || ancestor.getAttribute('data-name'),
                    source: 'ancestor_attribute'
                };
            }
            // 2. [MỚI] TEXT HEURISTIC SCAN (Tìm trong Label/Title của Form)
            // Tìm các thẻ chứa text tiềm năng bên trong form
            const textContainers = Array.from(element.querySelectorAll('label, legend, h3, h4, .product-title'));
            for (const container of textContainers) {
                const text = container.textContent || '';
                // Regex 1: Tìm pattern nằm trong ngoặc đơn, ví dụ: (P-JSON-999)
                // Giải thích Regex: \( trùng ngoặc mở, (P-[A-Z0-9-]+) bắt nhóm ID bắt đầu bằng P-, \) trùng ngoặc đóng
                const idMatch = text.match(/\((P-[A-Z0-9-]+)\)/i);
                if (idMatch && idMatch[1]) {
                    console.log(`🧠 [ReviewPlugin] Found ID inside text "${text}"`);
                    return {
                        id: idMatch[1],
                        source: 'text_heuristic_brackets'
                    };
                }
                // Regex 2: Tìm pattern sau dấu hai chấm, ví dụ: "Mã SP: SP123"
                const codeMatch = text.match(/(?:code|sku|id|mã)[:\s]+([A-Z0-9-]+)/i);
                if (codeMatch && codeMatch[1]) {
                    return {
                        id: codeMatch[1],
                        source: 'text_heuristic_label'
                    };
                }
            }
            // 3. URL SCAN (Cuối cùng mới tìm trên URL)
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

    // [1] Copy ENUMS từ FormPlugin sang để dùng chung chuẩn
    // const TARGET_PATTERN = {
    //     CSS_SELECTOR: 1,    
    //     DOM_ATTRIBUTE: 2,
    //     DATA_ATTRIBUTE: 3
    // };
    const CONDITION_PATTERN$1 = {
        URL_PARAM: 1,
        CSS_SELECTOR: 2,
        DOM_ATTRIBUTE: 3,
        DATA_ATTRIBUTE: 4,
    };
    const TARGET_OPERATOR$1 = {
        CONTAINS: 1,
        NOT_CONTAINS: 2,
        STARTS_WITH: 3,
        ENDS_WITH: 4,
        EQUALS: 5,
        NOT_EQUALS: 6,
        EXISTS: 8,
        NOT_EXISTS: 9
    };
    class ScrollPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ScrollPlugin';
            this.context = null;
            this.identityManager = null;
            this.detector = null;
            // --- STATE QUẢN LÝ SCROLL & TIME ---
            this.milestones = [25, 50, 75, 100];
            this.sentMilestones = new Set();
            this.maxScrollDepth = 0;
            // --- STATE QUẢN LÝ THỜI GIAN ---
            this.startTime = Date.now();
            this.totalActiveTime = 0;
            this.isTabVisible = true;
            // State Context
            this.currentItemContext = null;
            this.activeRule = null;
            this.targetScrollElement = null; // Element đang được track scroll
            // --- THROTTLE CONFIG ---
            this.lastScrollProcessTime = 0;
            this.THROTTLE_MS = 200;
            this.handleScrollBound = this.handleScroll.bind(this);
            this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
            this.handleUnloadBound = this.handleUnload.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.context = new TrackerContextAdapter(tracker);
                this.identityManager = getUserIdentityManager();
                this.identityManager.initialize();
                this.detector = getAIItemDetector();
                if (this.context) {
                    this.identityManager.setTrackerContext(this.context);
                }
                console.log(`[ScrollPlugin] initialized.`);
            }, 'ScrollPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                this.resetState();
                // [NÂNG CẤP] Logic chọn Rule thông minh hơn
                const isResolved = this.resolveContextFromRules();
                if (isResolved) {
                    // Chỉ lắng nghe nếu tìm thấy Rule phù hợp
                    const target = this.targetScrollElement || window;
                    target.addEventListener('scroll', this.handleScrollBound, { passive: true }); // passive để mượt
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
        /**
         * [NÂNG CẤP] Duyệt qua danh sách Rule để tìm Rule phù hợp nhất
         * Check Target Match & Check Conditions
         */
        resolveContextFromRules() {
            if (!this.context || !this.detector)
                return false;
            // 1. Lấy tất cả Rule SCROLL (ID = 4)
            const scrollRules = this.context.config.getRules(4);
            if (scrollRules.length === 0)
                return false;
            console.log(`📜 [ScrollPlugin] Checking ${scrollRules.length} rules...`);
            // Tìm Rule đầu tiên thỏa mãn cả Target và Condition
            for (const rule of scrollRules) {
                // A. Check xem Element đích có tồn tại không
                // Với Scroll, Target Element chính là container cần track cuộn (hoặc body)
                const element = this.findTargetElement(rule);
                if (element) {
                    // B. Check Conditions (URL, Param, State...)
                    // Lưu ý: checkConditions cần truyền 1 HTMLElement để check attribute/class
                    // Nếu track window, ta dùng document.body làm đại diện để check
                    const representativeEl = (element instanceof Window) ? document.body : element;
                    if (this.checkConditions(representativeEl, rule)) {
                        this.activeRule = rule;
                        this.targetScrollElement = (element instanceof Window) ? null : element;
                        console.log(`✅ [ScrollPlugin] Rule Matched: "${rule.name}"`);
                        // C. Sau khi chốt Rule, bắt đầu Detect Item ID dựa trên Element đó
                        this.detectContextForItem(representativeEl);
                        return true;
                    }
                }
            }
            return false;
        }
        // Helper: Tìm Element dựa trên Rule Config
        findTargetElement(rule) {
            const target = rule.targetElement || rule.TargetElement;
            // Nếu không config target, hoặc target là "document"/"window" -> Track Window
            if (!target || !target.targetElementValue || target.targetElementValue === 'document' || target.targetElementValue === 'window') {
                return window;
            }
            // Nếu có selector cụ thể (VD: .scrollable-sidebar)
            const selector = target.targetElementValue || target.Value;
            try {
                const el = document.querySelector(selector);
                return el; // Trả về null nếu không thấy
            }
            catch {
                return null;
            }
        }
        // [NÂNG CẤP] Detect Item ID (Dùng lại logic Tam Trụ của FormPlugin)
        detectContextForItem(element) {
            var _a;
            // 1. Dùng AI
            let detected = (_a = this.detector) === null || _a === void 0 ? void 0 : _a.detectItem(element);
            // 2. Nếu AI fail, dùng Radar (Full version)
            if (!detected || !detected.id || detected.id === 'N/A (Failed)') {
                console.log("🔍 [ScrollPlugin] AI failed. Scanning radar...");
                // Dùng hàm quét full (Ancestors + Siblings + URL)
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
                    // Fallback: Tạo Synthetic Item
                    this.currentItemContext = this.createSyntheticItem();
                }
            }
            else {
                this.currentItemContext = detected;
            }
            console.log("🎯 [ScrollPlugin] Resolved Context:", this.currentItemContext);
        }
        // --- LOGIC CHECK CONDITIONS (Port từ FormPlugin sang) ---
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
                    case CONDITION_PATTERN$1.URL_PARAM: // 1
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.has(expectedValue))
                            actualValue = urlParams.get(expectedValue);
                        else
                            actualValue = window.location.href;
                        break;
                    case CONDITION_PATTERN$1.CSS_SELECTOR: // 2
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
                    case CONDITION_PATTERN$1.DOM_ATTRIBUTE: // 3
                        actualValue = element.id;
                        break;
                    case CONDITION_PATTERN$1.DATA_ATTRIBUTE: // 4
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
                case TARGET_OPERATOR$1.EQUALS: return actual === expected;
                case TARGET_OPERATOR$1.NOT_EQUALS: return actual !== expected;
                case TARGET_OPERATOR$1.CONTAINS: return actual.includes(expected);
                case TARGET_OPERATOR$1.NOT_CONTAINS: return !actual.includes(expected);
                case TARGET_OPERATOR$1.STARTS_WITH: return actual.startsWith(expected);
                case TARGET_OPERATOR$1.ENDS_WITH: return actual.endsWith(expected);
                case TARGET_OPERATOR$1.EXISTS: return actual !== '' && actual !== null;
                case TARGET_OPERATOR$1.NOT_EXISTS: return actual === '' || actual === null;
                default: return actual === expected;
            }
        }
        isNegativeOperator(opId) {
            return opId === TARGET_OPERATOR$1.NOT_EQUALS || opId === TARGET_OPERATOR$1.NOT_CONTAINS || opId === TARGET_OPERATOR$1.NOT_EXISTS;
        }
        // --- DOM RADAR (Full Version - Port từ FormPlugin) ---
        scanSurroundingContext(element) {
            const getAttrs = (el) => {
                if (!el)
                    return null;
                const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
                if (id)
                    return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
                return null;
            };
            // 1. Ancestors
            const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
            const ancestorData = getAttrs(ancestor);
            if (ancestorData)
                return { ...ancestorData, source: 'ancestor' };
            // 2. Siblings (Scope Scan)
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
            // 3. URL
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('productId');
            if (urlId)
                return { id: urlId, source: 'url_param' };
            return { id: undefined, source: 'none' };
        }
        // --- SCROLL HANDLER (Giữ nguyên logic cũ) ---
        handleScroll() {
            const now = Date.now();
            if (now - this.lastScrollProcessTime < this.THROTTLE_MS)
                return;
            this.lastScrollProcessTime = now;
            // Xử lý scroll trên Window hoặc Element cụ thể
            let scrollTop, docHeight, clientHeight;
            if (this.targetScrollElement instanceof HTMLElement) {
                // Scroll trên div
                scrollTop = this.targetScrollElement.scrollTop;
                docHeight = this.targetScrollElement.scrollHeight;
                clientHeight = this.targetScrollElement.clientHeight;
            }
            else {
                // Scroll trên window
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
        // --- CÁC HÀM GỬI EVENT (Update type safety) ---
        sendScrollEvent(depth) {
            if (!this.context)
                return;
            const rule = this.activeRule || this.createDefaultRule('default-scroll', 'Default Scroll');
            const currentActiveSeconds = this.calculateActiveTime();
            const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
            payload.event = 'scroll_depth';
            payload.metadata = {
                ...(payload.metadata || {}),
                depth_percentage: depth,
                time_on_page: currentActiveSeconds,
                url: window.location.href
            };
            this.enrichUserIdentity(payload);
            this.context.eventBuffer.enqueue(payload);
        }
        handleUnload() {
            if (!this.context)
                return;
            if (this.isTabVisible)
                this.totalActiveTime += Date.now() - this.startTime;
            const finalTime = parseFloat((this.totalActiveTime / 1000).toFixed(1));
            if (finalTime < 1)
                return;
            const rule = this.activeRule || this.createDefaultRule('summary', 'Page Summary');
            if (!this.currentItemContext)
                this.currentItemContext = this.createSyntheticItem();
            const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
            payload.event = 'page_summary';
            payload.metadata = {
                max_scroll_depth: this.maxScrollDepth,
                total_time_on_page: finalTime,
                is_bounce: this.maxScrollDepth < 25 && finalTime < 5
            };
            this.enrichUserIdentity(payload);
            this.debugPersistent('PAGE_SUMMARY', payload);
            this.context.eventBuffer.enqueue(payload);
        }
        // --- HELPERS (Giữ nguyên) ---
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
                if (uid && !uid.startsWith('anon_'))
                    payload.userId = uid;
                const uInfo = this.identityManager.getUserInfo();
                if (uInfo.sessionId)
                    payload.sessionId = uInfo.sessionId;
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
                id, name, triggerEventId: 4,
                targetElement: { targetElementValue: 'document', targetEventPatternId: 1, targetOperatorId: 5 },
                conditions: [], payload: []
            };
        }
        debugPersistent(tag, data) {
            const logEntry = { time: new Date().toISOString(), tag, data, url: window.location.href };
            const history = JSON.parse(localStorage.getItem('SDK_DEBUG_LOGS') || '[]');
            history.unshift(logEntry);
            localStorage.setItem('SDK_DEBUG_LOGS', JSON.stringify(history.slice(0, 10)));
        }
    }

    var scrollPlugin = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ScrollPlugin: ScrollPlugin
    });

    // packages/sdk/src/core/services/payload-builder.ts
    class PayloadBuilder {
        constructor() {
            this.COMMON_CONTAINERS = [
                'user', 'userInfo', 'userData', 'profile', 'auth', 'session', 'account', 'identity',
                'customer', 'member', 'state'
            ];
        }
        /**
         * Hàm build đa năng: Hỗ trợ cả 2 kiểu gọi (Legacy & Mapping)
         * Để đơn giản hóa trong context này, ta tập trung vào logic Mapping.
         * Trong thực tế cần implement cả logic Legacy nếu các plugin cũ vẫn dùng.
         */
        build(arg1, arg2, arg3) {
            // KIỂM TRA: Nếu tham số đầu tiên là Mảng -> Chạy logic Mapping (New)
            if (Array.isArray(arg1)) {
                // Check if context is network data (NetworkPlugin) or HTMLElement (Click/Form Plugin)
                // arg2 could be HTMLElement OR { req, res }
                return this.buildFromMappings(arg1, arg2);
            }
            // NGƯỢC LẠI: Chạy logic Legacy (FormPlugin, ScrollPlugin...)
            return this.buildLegacy(arg1, arg2, arg3);
        }
        buildFromMappings(mappings, contextData) {
            const result = {};
            if (!mappings || !Array.isArray(mappings))
                return result;
            for (const map of mappings) {
                let extractedValue = null;
                // Chuẩn hóa key source về chữ thường để so sánh
                const source = (map.source || '').toLowerCase();
                switch (source) {
                    case 'cookie':
                        extractedValue = this.extractFromCookie(map.value);
                        break;
                    case 'local_storage':
                        extractedValue = this.extractFromStorage(window.localStorage, map.value);
                        break;
                    case 'session_storage':
                        extractedValue = this.extractFromStorage(window.sessionStorage, map.value);
                        break;
                    case 'url_param':
                        extractedValue = this.extractFromUrl(map.value);
                        break;
                    case 'element':
                        if (contextData && contextData instanceof HTMLElement) {
                            extractedValue = this.extractFromElement(contextData, map.value);
                        }
                        break;
                    case 'network_request':
                        // Context data should be { reqBody, resBody }
                        extractedValue = this.extractFromNetwork(contextData, map.value);
                        break;
                }
                if (this.isValidValue(extractedValue)) {
                    result[map.field] = extractedValue;
                }
            }
            return result;
        }
        // --- [LEGACY LOGIC] Xử lý Rule & AI Detection (Cho Form/Scroll Plugin) ---
        buildLegacy(element, rule, _extraData) {
            // Tạo payload cơ bản
            const payload = {
                event: 'unknown', // Sẽ được plugin ghi đè (vd: rate_submit)
                url: window.location.href,
                timestamp: Date.now(),
                ruleName: (rule === null || rule === void 0 ? void 0 : rule.name) || 'unknown_rule',
                userId: '', // Sẽ được enrich bởi IdentityManager sau
                itemId: 'N/A (Failed)',
                metadata: {}
            };
            // Gán thông tin từ AI Detection (nếu có)
            if (element && typeof element === 'object' && 'id' in element) {
                const aiResult = element;
                if (aiResult.id && aiResult.id !== 'N/A (Failed)') {
                    payload.itemId = aiResult.id;
                    payload.itemName = aiResult.name;
                    payload.itemType = aiResult.type;
                    payload.confidence = aiResult.confidence;
                    payload.source = aiResult.source;
                    if (aiResult.metadata)
                        payload.metadata = { ...payload.metadata, ...aiResult.metadata };
                }
            }
            return payload;
        }
        // --- CÁC HÀM TRÍCH XUẤT ---
        /**
         * [NEW] Lấy dữ liệu từ DOM Element (CSS Selector)
         * Selector được tìm trong phạm vi contextElement (Form) trước, nếu không thấy thì tìm toàn document
         */
        extractFromElement(context, selector) {
            try {
                if (!selector)
                    return null;
                // Tìm element: Ưu tiên trong form, fallback ra toàn trang
                let targetEl = context.querySelector(selector);
                if (!targetEl) {
                    targetEl = document.querySelector(selector);
                }
                if (!targetEl)
                    return null;
                // 1. Nếu là Input/Textarea/Select -> Lấy value
                if (targetEl instanceof HTMLInputElement ||
                    targetEl instanceof HTMLTextAreaElement ||
                    targetEl instanceof HTMLSelectElement) {
                    return targetEl.value;
                }
                // 2. Nếu là thẻ thường -> Lấy text content
                return targetEl.innerText || targetEl.textContent || null;
            }
            catch {
                return null;
            }
        }
        extractFromUrl(paramName) {
            try {
                const params = new URLSearchParams(window.location.search);
                return params.get(paramName);
            }
            catch {
                return null;
            }
        }
        extractFromStorage(storage, keyConfig) {
            try {
                if (!keyConfig)
                    return null;
                const cleanKey = keyConfig.trim().replace(/^\.+|\.+$/g, ''); // Sanitization
                if (!cleanKey)
                    return null;
                // 1. Direct Lookup
                const directVal = this.lookupPath(storage, cleanKey);
                if (this.isValidValue(directVal))
                    return directVal;
                // 2. Smart Container Lookup (Fallback)
                if (!cleanKey.includes('.')) {
                    for (const container of this.COMMON_CONTAINERS) {
                        const fallbackPath = `${container}.${cleanKey}`;
                        const fallbackVal = this.lookupPath(storage, fallbackPath);
                        if (this.isValidValue(fallbackVal))
                            return fallbackVal;
                    }
                }
                return null;
            }
            catch {
                return null;
            }
        }
        lookupPath(storage, path) {
            const parts = path.split('.');
            const rootKey = parts[0];
            const rawItem = storage.getItem(rootKey);
            if (!rawItem)
                return null;
            if (parts.length === 1)
                return rawItem;
            return this.getNestedValue(rawItem, parts.slice(1).join('.'));
        }
        extractFromCookie(path) {
            try {
                if (!document.cookie || !path)
                    return null;
                const cleanPath = path.trim().replace(/^\.+|\.+$/g, '');
                if (!cleanPath)
                    return null;
                const parts = cleanPath.split('.');
                const cookieName = parts[0];
                const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
                if (!match)
                    return null;
                const cookieValue = decodeURIComponent(match[2]);
                if (parts.length === 1)
                    return cookieValue;
                return this.getNestedValue(cookieValue, parts.slice(1).join('.'));
            }
            catch {
                return null;
            }
        }
        getNestedValue(jsonString, path) {
            try {
                let obj = JSON.parse(jsonString);
                const keys = path.split('.');
                for (const key of keys) {
                    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
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
        isValidValue(val) {
            return val !== null && val !== undefined && val !== '' && val !== 'null' && val !== 'undefined';
        }
        /**
         * [NEW] Extract info from Network Request/Response
         * Context: { reqBody: any, resBody: any, method: string }
         * Path format: "request.field" or "response.field" or just "field" (infer)
         */
        extractFromNetwork(context, pathConfig) {
            try {
                if (!context || !pathConfig)
                    return null;
                const { reqBody, resBody, method } = context;
                // Logic similar to tracker.js 'inferSource' but guided by pathConfig if possible
                // pathConfig example: "response.userId" or "request.payload.id"
                // If pathConfig doesn't start with request/response, try both.
                let val = null;
                if (pathConfig.startsWith('request.')) {
                    val = this.traverseObject(reqBody, pathConfig.replace('request.', ''));
                }
                else if (pathConfig.startsWith('response.')) {
                    val = this.traverseObject(resBody, pathConfig.replace('response.', ''));
                }
                else {
                    // Unknown source, try inference based on Method like tracker.js
                    // GET -> Response
                    // POST/PUT -> Request ?? Response
                    if (method === 'GET') {
                        val = this.traverseObject(resBody, pathConfig);
                    }
                    else {
                        // Try request first
                        val = this.traverseObject(reqBody, pathConfig);
                        if (!this.isValidValue(val)) {
                            val = this.traverseObject(resBody, pathConfig);
                        }
                    }
                }
                return val;
            }
            catch {
                return null;
            }
        }
        /**
         * [NEW] Helper to traverse generic object (for Network Plugin)
         */
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
                if (current === null || current === undefined)
                    return null;
                return (typeof current === 'object') ? JSON.stringify(current) : String(current);
            }
            catch {
                return null;
            }
        }
    }

    const TARGET_PATTERN = {
        CSS_SELECTOR: 1,
        DOM_ATTRIBUTE: 2,
        DATA_ATTRIBUTE: 3,
    };
    const CONDITION_PATTERN = {
        URL_PARAM: 1,
        CSS_SELECTOR: 2,
        DOM_ATTRIBUTE: 3,
        DATA_ATTRIBUTE: 4,
    };
    const TARGET_OPERATOR = {
        CONTAINS: 1,
        NOT_CONTAINS: 2,
        STARTS_WITH: 3,
        ENDS_WITH: 4,
        EQUALS: 5,
        NOT_EQUALS: 6,
        EXISTS: 7,
        NOT_EXISTS: 8
    };
    class FormPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'FormPlugin';
            this.context = null;
            this.detector = null;
            this.identityManager = null;
            this.handleSubmitBound = this.handleSubmit.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                this.context = new TrackerContextAdapter(tracker);
                this.detector = getAIItemDetector();
                this.identityManager = getUserIdentityManager();
                this.identityManager.initialize();
                if (this.context) {
                    this.identityManager.setTrackerContext(this.context);
                }
                console.log(`[FormPlugin] initialized with UserIdentityManager.`);
                console.log(`[FormPlugin] initialized.`);
            }, 'FormPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                // Lắng nghe sự kiện submit toàn cục
                document.addEventListener('submit', this.handleSubmitBound, { capture: true });
                console.log("[FormPlugin] started listening for form submissions.");
                this.active = true;
            }, 'FormPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
                super.stop();
            }, 'FormPlugin.stop');
        }
        handleSubmit(event) {
            console.log("🔥 [DEBUG] Sự kiện Submit đã được bắt!");
            if (!this.context || !this.detector || !this.tracker)
                return;
            const form = event.target;
            const formId = form.id;
            console.log(`📝 [DEBUG] Form đang submit có ID: "${formId}"`);
            // 1. Lấy rules RATE (Dynamic ID)
            const eventId = this.tracker.getEventTypeId('Rating');
            if (!eventId) {
                console.log('[FormPlugin] Rating event type not found in config.');
                return;
            }
            const rateRules = this.context.config.getRules(eventId);
            console.log(`🔎 [DEBUG] Tìm thấy ${rateRules.length} rule(s) cho sự kiện RATE.`);
            if (rateRules.length === 0) {
                return;
            }
            for (const rule of rateRules) {
                const isTargetMatch = this.checkTargetMatch(form, rule);
                if (isTargetMatch) {
                    // B. Kiểm tra Conditions (Dùng CONDITION_PATTERN)
                    const isConditionMatch = this.checkConditions(form, rule);
                    if (isConditionMatch) {
                        console.log(`✅ [DEBUG] Rule "${rule.name}" Matched (Target & Conditions)!`);
                        // C. Extract & Process Data
                        const { rateValue, reviewText, detectedId } = this.extractFormData(form, rule);
                        let structuredItem = this.detector.detectItem(form);
                        // Logic Tam Trụ (Hidden Input -> AI -> Radar)
                        if (detectedId) {
                            structuredItem = {
                                ...(structuredItem || {}),
                                id: detectedId,
                                confidence: 1,
                                source: 'form_hidden_input',
                                context: 'form_internal',
                                name: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.name) || 'Unknown Item',
                                type: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.type) || 'item'
                            };
                        }
                        else {
                            const isGarbageId = !structuredItem || !structuredItem.id || structuredItem.id === 'N/A (Failed)';
                            if (isGarbageId) {
                                const contextInfo = this.scanSurroundingContext(form);
                                if (contextInfo.id) {
                                    structuredItem = {
                                        ...(structuredItem || {}),
                                        id: contextInfo.id,
                                        confidence: 1,
                                        source: contextInfo.source,
                                        context: 'dom_context',
                                        name: contextInfo.name || (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.name) || 'Unknown Item',
                                        type: contextInfo.type || (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.type) || 'item',
                                        metadata: (structuredItem === null || structuredItem === void 0 ? void 0 : structuredItem.metadata) || {}
                                    };
                                }
                            }
                        }
                        // D. Build & Send Payload
                        const payload = this.context.payloadBuilder.build(structuredItem, rule);
                        this.enrichPayload(payload, structuredItem, { rateValue, reviewText });
                        this.context.eventBuffer.enqueue(payload);
                        return;
                    }
                    else {
                        console.log(`⚠️ Match Target nhưng FAIL Conditions của Rule: ${rule.name}`);
                    }
                }
            }
        }
        /**
         * Hàm kiểm tra xem Form hiện tại có khớp với Rule không
         * Hỗ trợ mọi Operator (Equals, Contains, Regex...) và Pattern (CSS, ID...)
         */
        checkTargetMatch(form, rule) {
            const target = rule.targetElement || rule.TargetElement;
            if (!target)
                return false;
            const patternId = target.targetEventPatternId || target.EventPatternID || 1;
            const operatorId = target.targetOperatorId || target.OperatorID || 5;
            const expectedValue = target.targetElementValue || target.Value || '';
            let actualValue = null;
            switch (patternId) {
                case TARGET_PATTERN.CSS_SELECTOR: // 1
                    try {
                        const isMatch = form.matches(expectedValue);
                        if (operatorId === TARGET_OPERATOR.NOT_EQUALS || operatorId === TARGET_OPERATOR.NOT_EXISTS)
                            return !isMatch;
                        return isMatch;
                    }
                    catch {
                        return false;
                    }
                case TARGET_PATTERN.DOM_ATTRIBUTE: // 2
                    actualValue = form.id;
                    break;
                case TARGET_PATTERN.DATA_ATTRIBUTE: // 3
                    actualValue = form.getAttribute('data-form-name') || form.getAttribute('name') || '';
                    break;
                // Đã xóa case REGEX_FIELDS
                default:
                    try {
                        return form.matches(expectedValue);
                    }
                    catch {
                        return false;
                    }
            }
            return this.compareValues(actualValue, expectedValue, operatorId);
        }
        /**
         * CHECK CONDITIONS: Dùng CONDITION_PATTERN
         */
        checkConditions(form, rule) {
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
                    case CONDITION_PATTERN.URL_PARAM: // 1
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.has(expectedValue)) {
                            actualValue = urlParams.get(expectedValue);
                        }
                        else {
                            actualValue = window.location.href;
                        }
                        break;
                    case CONDITION_PATTERN.CSS_SELECTOR: // 2
                        try {
                            isMet = form.matches(expectedValue);
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
                    case CONDITION_PATTERN.DOM_ATTRIBUTE: // 3
                        actualValue = form.id;
                        break;
                    case CONDITION_PATTERN.DATA_ATTRIBUTE: // 4
                        actualValue = form.getAttribute(expectedValue);
                        break;
                    default:
                        actualValue = '';
                }
                isMet = this.compareValues(actualValue, expectedValue, operatorId);
                if (!isMet) {
                    console.log(`❌ Condition Failed: Pattern ${patternId}, Expect "${expectedValue}" vs Actual "${actualValue}"`);
                    return false;
                }
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
                // Đã xóa case REGEX
                case TARGET_OPERATOR.EXISTS: return actual !== '' && actual !== null;
                case TARGET_OPERATOR.NOT_EXISTS: return actual === '' || actual === null;
                default: return actual === expected;
            }
        }
        isNegativeOperator(opId) {
            return opId === TARGET_OPERATOR.NOT_EQUALS ||
                opId === TARGET_OPERATOR.NOT_CONTAINS ||
                opId === TARGET_OPERATOR.NOT_EXISTS;
        }
        /**
         * DOM RADAR: Quét ngữ cảnh xung quanh theo phương pháp lan truyền
         * 1. Check bản thân -> 2. Check tổ tiên -> 3. Check phạm vi (Parent Scope)
         */
        scanSurroundingContext(element) {
            // Helper lấy data attribute
            const getAttrs = (el) => {
                if (!el)
                    return null;
                const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
                if (id) {
                    return {
                        id,
                        name: el.getAttribute('data-item-name') || el.getAttribute('data-name') || undefined,
                        type: el.getAttribute('data-item-type') || undefined
                    };
                }
                return null;
            };
            console.log("📡 [DOM Radar] Bắt đầu quét xung quanh form...");
            // BƯỚC 1: Quét Tổ Tiên (Ancestors - Form nằm trong thẻ Item)
            // Dùng closest để tìm ngược lên trên
            const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
            const ancestorData = getAttrs(ancestor);
            if (ancestorData) {
                console.log("   => Tìm thấy ở Tổ tiên (Ancestor)");
                return { ...ancestorData, source: 'ancestor' };
            }
            // BƯỚC 2: Quét Phạm Vi Gần (Scope Scan - Form nằm cạnh thẻ Item)
            // Đi ngược lên Parent từng cấp (Max 5 cấp) để tìm "hàng xóm" có data
            let currentParent = element.parentElement;
            let levels = 0;
            const maxLevels = 5; // Chỉ quét tối đa 5 cấp cha để tránh performance kém
            while (currentParent && levels < maxLevels) {
                // Tìm tất cả các thẻ có ID trong phạm vi cha này
                const candidates = currentParent.querySelectorAll('[data-item-id], [data-product-id], [data-id]');
                if (candidates.length > 0) {
                    // Có ứng viên! Chọn ứng viên đầu tiên không phải là chính cái form (tránh loop)
                    // (Thường querySelectorAll trả về theo thứ tự DOM, nên cái nào đứng trước/gần nhất sẽ được lấy)
                    for (let i = 0; i < candidates.length; i++) {
                        const candidate = candidates[i];
                        if (!element.contains(candidate)) { // Đảm bảo không tìm lại con của form (nếu có)
                            const data = getAttrs(candidate);
                            if (data) {
                                console.log(`   => Tìm thấy ở Hàng xóm (Scope Level ${levels + 1})`);
                                return { ...data, source: `scope_level_${levels + 1}` };
                            }
                        }
                    }
                }
                // Tiếp tục leo lên cấp cao hơn
                currentParent = currentParent.parentElement;
                levels++;
            }
            // BƯỚC 3: Fallback URL (Cứu cánh cuối cùng)
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('productId') || urlParams.get('item_id');
            if (urlId) {
                console.log("   => Tìm thấy ở URL Param");
                return { id: urlId, source: 'url_param' };
            }
            console.warn("❌ [DOM Radar] Không tìm thấy ngữ cảnh nào xung quanh.");
            return { id: undefined, source: 'none' };
        }
        enrichPayload(payload, itemCtx, formData) {
            // Gán Event Type chuẩn
            payload.event = 'rate_submit';
            // Merge Metadata (Form Data)
            payload.metadata = {
                ...(payload.metadata || {}),
                ...formData
            };
            // Override Item Info (Quan trọng: Đảm bảo công sức của Radar được ghi nhận)
            // Chỉ ghi đè nếu Builder thất bại ("N/A") hoặc ID rỗng
            if (itemCtx.id && (!payload.itemId || payload.itemId === 'N/A (Failed)')) {
                payload.itemId = itemCtx.id;
                payload.confidence = 1; // Khẳng định độ tin cậy
                if (itemCtx.source)
                    payload.source = itemCtx.source;
            }
            // Name có thể optional
            if (itemCtx.name && (!payload.itemName || payload.itemName === 'Unknown Item')) {
                payload.itemName = itemCtx.name;
            }
            if (this.identityManager) {
                // Lấy ID thật (nếu có đăng nhập), bỏ qua anon_
                const realUserId = this.identityManager.getRealUserId();
                const stableUserId = this.identityManager.getStableUserId();
                // Ưu tiên ID thật (User ID từ DB)
                if (realUserId && !realUserId.startsWith('anon_')) {
                    console.log(`👤 [FormPlugin] Auto-detected Real User ID: ${realUserId}`);
                    payload.userId = realUserId;
                }
                // Nếu không có ID thật, dùng ID ổn định (có thể là anon cũ) để đảm bảo continuity
                else if (stableUserId) {
                    // Chỉ ghi đè nếu payload đang trống hoặc payload đang dùng anon mới tạo
                    if (!payload.userId || (payload.userId.startsWith('anon_') && stableUserId !== payload.userId)) {
                        payload.userId = stableUserId;
                    }
                }
                // [MẸO] Gắn thêm SessionID để tracking phiên làm việc chuẩn xác hơn
                const userInfo = this.identityManager.getUserInfo();
                if (userInfo.sessionId) {
                    payload.sessionId = userInfo.sessionId; // Đảm bảo backend có trường này hoặc để vào metadata
                    payload.metadata.sessionId = userInfo.sessionId;
                }
            }
        }
        // Helper: Lấy dữ liệu từ form
        extractFormData(form, rule) {
            const formData = new FormData(form);
            const data = {};
            // Convert FormData to Object & Log raw data
            formData.forEach((value, key) => { data[key] = value; });
            console.log("RAW FORM DATA:", data);
            let rateValue = 0;
            let reviewText = '';
            let detectedId = '';
            // Ưu tiên config từ Rule
            if (rule.payload && rule.payload.length > 0) {
                rule.payload.forEach((p) => {
                    const val = data[p.value];
                    if (p.type === 'number')
                        rateValue = Number(val) || 0;
                    else
                        reviewText = String(val || '');
                });
            }
            else {
                const idKeywords = ['productid', 'itemid', 'item_id', 'product_id', 'id', 'objectid', 'entity_id'];
                // Auto-detect Logic
                for (const [key, val] of Object.entries(data)) {
                    const k = key.toLowerCase();
                    const vStr = String(val);
                    if (idKeywords.includes(k) && vStr.length > 0 && vStr.length < 50) {
                        // Loại trừ các giá trị rác nếu cần
                        if (vStr !== '0' && vStr !== 'undefined') {
                            detectedId = vStr;
                            console.log(`💡 [FormPlugin] Tìm thấy ID trong input [${key}]: ${vStr}`);
                        }
                    }
                    // Detect Rating
                    if (k.includes('rate') || k.includes('star') || k.includes('score') || k.includes('rating')) {
                        // Chỉ nhận nếu là số hợp lệ và > 0
                        const parsed = Number(val);
                        if (!isNaN(parsed) && parsed > 0) {
                            rateValue = parsed;
                        }
                    }
                    // Detect Review
                    if (k.includes('comment') || k.includes('review') || k.includes('content') || k.includes('body')) {
                        // Ưu tiên chuỗi dài hơn (tránh lấy nhầm ID)
                        if (vStr.length > reviewText.length) {
                            reviewText = vStr;
                        }
                    }
                }
            }
            return { rateValue, reviewText, detectedId };
        }
    }

    var formPlugin = /*#__PURE__*/Object.freeze({
        __proto__: null,
        FormPlugin: FormPlugin
    });

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
                // Context để PayloadBuilder sử dụng trích xuất dữ liệu
                const networkContext = {
                    reqBody: reqData,
                    resBody: resData,
                    method: method
                };
                for (const rule of config.trackingRules) {
                    if (!rule.payloadMappings)
                        continue;
                    // Lọc các mapping phù hợp với URL hiện tại
                    const applicableMappings = rule.payloadMappings.filter(mapping => {
                        if (!mapping.requestUrlPattern)
                            return false;
                        if (mapping.requestMethod && mapping.requestMethod.toUpperCase() !== method.toUpperCase()) {
                            return false;
                        }
                        // Debug log
                        console.log(`[NetworkPlugin] Checking ${url} against ${mapping.requestUrlPattern}`);
                        if (!PathMatcher.matchStaticSegments(url, mapping.requestUrlPattern)) {
                            console.log(`[NetworkPlugin] Static segments mismatch`);
                            return false;
                        }
                        if (!PathMatcher.match(url, mapping.requestUrlPattern)) {
                            // Double check match failure
                            console.log(`[NetworkPlugin] PathMatcher failed for ${url} vs ${mapping.requestUrlPattern}`);
                            return false;
                        }
                        return true;
                    });
                    if (applicableMappings.length > 0) {
                        // Ép kiểu source thành 'network_request' để đảm bảo PayloadBuilder dùng logic trích xuất mạng
                        const mappingsForBuilder = applicableMappings.map(m => ({
                            ...m,
                            source: 'network_request',
                            value: m.value || m.requestBodyPath // Ensure value is set (PayloadBuilder relies on 'value')
                        }));
                        // Trích xuất dữ liệu thông qua PayloadBuilder
                        const extractedData = this.tracker.payloadBuilder.build(mappingsForBuilder, networkContext);
                        console.log(`[NetworkPlugin] Match found for ${rule.name}. Extracted:`, extractedData);
                        // Nếu có dữ liệu trích xuất được, tiến hành gửi tracking event
                        if (Object.keys(extractedData).length > 0) {
                            // *logic gửi dữ liệu gì gì đó*
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

    var networkPlugin = /*#__PURE__*/Object.freeze({
        __proto__: null,
        NetworkPlugin: NetworkPlugin
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
                const baseUrl = "http://localhost:3000";
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
                        const apiBaseUrl = "http://localhost:3000";
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
                    const formPromise = Promise.resolve().then(function () { return formPlugin; }).then(({ FormPlugin }) => {
                        this.use(new FormPlugin());
                        console.log('[RecSysTracker] Auto-registered FormPlugin based on tracking rules');
                    });
                    pluginPromises.push(formPromise);
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
                const hasNetworkRules = this.config.trackingRules.some(rule => rule.payloadMappings && rule.payloadMappings.some(m => m.source == "RequestBody"));
                if (hasNetworkRules) {
                    const networkPromise = Promise.resolve().then(function () { return networkPlugin; }).then(({ NetworkPlugin }) => {
                        this.use(new NetworkPlugin());
                        console.log('[RecSysTracker] Auto-registered NetworkPlugin');
                    });
                    pluginPromises.push(networkPromise);
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
                    ...(eventData.ratingValue !== undefined && { ratingValue: eventData.ratingValue }),
                    ...(eventData.reviewValue !== undefined && { reviewValue: eventData.reviewValue }),
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
    exports.FormPlugin = FormPlugin;
    exports.NetworkPlugin = NetworkPlugin;
    exports.PageViewPlugin = PageViewPlugin;
    exports.PluginManager = PluginManager;
    exports.RecSysTracker = RecSysTracker;
    exports.ReviewPlugin = ReviewPlugin;
    exports.ScrollPlugin = ScrollPlugin;
    exports.default = RecSysTracker;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=recsys-tracker.umd.js.map
