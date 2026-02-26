var RecSysTracker = (function (exports) {
    'use strict';

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
                        return true;
                    }
                    if (protocol === 'file:' || origin === 'null' || origin === 'file://') {
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
                // console.warn('[RecSysTracker] Origin verification failed: no valid origin or referrer');
                return false;
            }
            catch (error) {
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
                return false;
            }
            catch (error) {
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
                    return null;
                }
                const domainKey = window.__RECSYS_DOMAIN_KEY__;
                if (!domainKey || typeof domainKey !== 'string') {
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
                return null;
            }
        }
        // Lấy cấu hình từ server (remote)
        async fetchRemoteConfig() {
            if (!this.domainKey) {
                return this.config;
            }
            const moduleBaseUrl = "https://recsys-tracker-module.onrender.com";
            const webConfigBaseUrl = "https://recsys-tracker-web-config.onrender.com";
            try {
                // Bước 1: Gọi các API song song để lấy domain, return methods, event types và search keyword config
                const [domainResponse, rulesListResponse, returnMethodsResponse, eventTypesResponse, searchKeywordResponse, userIdentityResponse] = await Promise.all([
                    fetch(`${moduleBaseUrl}/domain/${this.domainKey}`),
                    fetch(`${moduleBaseUrl}/rule/domain/${this.domainKey}`),
                    fetch(`${moduleBaseUrl}/return-method/${this.domainKey}`),
                    fetch(`${moduleBaseUrl}/rule/event-type`),
                    fetch(`${moduleBaseUrl}/search-keyword-config?domainKey=${this.domainKey}`),
                    fetch(`${webConfigBaseUrl}/domain/user-identity?key=${this.domainKey}`),
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
                const searchKeywordData = searchKeywordResponse.ok ? await searchKeywordResponse.json() : [];
                const userIdentityData = userIdentityResponse.ok ? await userIdentityResponse.json() : null;
                // Cập nhật config với data từ server
                if (this.config) {
                    this.config = {
                        ...this.config,
                        domainUrl: (domainData === null || domainData === void 0 ? void 0 : domainData.Url) || this.config.domainUrl,
                        domainType: (domainData === null || domainData === void 0 ? void 0 : domainData.Type) || this.config.domainType,
                        trackingRules: this.transformRules(rulesListData),
                        returnMethods: this.transformReturnMethods(returnMethodsData),
                        eventTypes: this.transformEventTypes(eventTypesData),
                        searchKeywordConfigs: Array.isArray(searchKeywordData) ? searchKeywordData : [],
                        userIdentityConfig: userIdentityData ? {
                            id: userIdentityData.Id,
                            source: userIdentityData.Source,
                            domainId: userIdentityData.DomainId,
                            requestConfig: userIdentityData.RequestConfig,
                            value: userIdentityData.Value,
                            field: userIdentityData.Field
                        } : {
                            source: "local_storage",
                            domainId: this.config.domainType || 0,
                            requestConfig: null,
                            value: "recsys_anonymous_id",
                            field: "AnonymousId",
                        }
                    };
                    // Verify origin sau khi có domainUrl từ server
                    if (this.config.domainUrl) {
                        const isOriginValid = OriginVerifier.verify(this.config.domainUrl);
                        if (!isOriginValid) {
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
                    actionType: rule.ActionType || rule.actionType || null,
                    payloadMappings: this.transformPayloadMappings(rule.PayloadMapping || rule.PayloadMappings || rule.payloadMappings || []),
                    trackingTarget: this.transformTrackingTargetToString(rule.TrackingTarget || rule.trackingTarget),
                });
            });
        }
        // Transform payload mappings từ server format sang SDK format
        transformPayloadMappings(payloadData) {
            if (!Array.isArray(payloadData))
                return [];
            return payloadData.map(payload => ({
                id: payload.Id || payload.id,
                field: payload.Field || payload.field,
                source: payload.Source || payload.source,
                config: payload.Config || payload.config || {},
                trackingRuleId: payload.TrackingRuleId || payload.trackingRuleId,
            }));
        }
        // Transform tracking target từ server format sang SDK format (trả về string)
        transformTrackingTargetToString(targetData) {
            if (!targetData) {
                return '';
            }
            // Nếu targetData là string (CSS selector), trả về trực tiếp
            if (typeof targetData === 'string') {
                return targetData;
            }
            // Nếu targetData là object, lấy value
            return targetData.Value || targetData.value || '';
        }
        // Transform return methods từ server format sang SDK format
        transformReturnMethods(returnMethodsData) {
            if (!returnMethodsData || !Array.isArray(returnMethodsData))
                return [];
            return returnMethodsData.map(method => {
                let layoutJson = method.Layout || method.layout;
                let styleJson = method.Style || method.style;
                let customFields = method.Customizing || method.customizing;
                if (typeof layoutJson === 'string')
                    layoutJson = JSON.parse(layoutJson);
                if (typeof styleJson === 'string')
                    styleJson = JSON.parse(styleJson);
                if (typeof customFields === 'string')
                    customFields = JSON.parse(customFields);
                return {
                    Id: method.Id || method.id,
                    Key: method.DomainID || method.domainId,
                    SearchKeywordConfigId: method.SearchKeywordConfigID || method.searchKeywordConfigId || null,
                    ConfigurationName: method.ConfigurationName || method.configurationName,
                    ReturnType: method.ReturnType || method.returnType,
                    Value: method.Value || method.value || '',
                    OperatorId: method.OperatorID || method.operatorId,
                    LayoutJson: layoutJson || {},
                    StyleJson: styleJson || {},
                    CustomizingFields: {
                        fields: Array.isArray(customFields) ? customFields : []
                    },
                    DelayDuration: Number(method.DelayDuration || method.delayDuration || method.Duration || 0),
                };
            });
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
            if (this.debug) ;
            // Gọi error handler tùy chỉnh nếu có
            if (this.errorHandler) {
                try {
                    this.errorHandler(error, context);
                }
                catch (handlerError) {
                    // Prevent error handler from breaking
                    if (this.debug) ;
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
            this.sendingEvents = new Set(); // Track events đang gửi để tránh duplicate
            this.displayManager = null;
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
            // Check nếu event đang được gửi
            if (this.sendingEvents.has(event.id)) {
                //console.log('[EventDispatcher] Event already being sent, skipping:', event.id);
                return true; // Return true để không retry
            }
            // Mark event as being sent
            this.sendingEvents.add(event.id);
            try {
                // Verify origin trước khi gửi event
                if (this.domainUrl) {
                    const isOriginValid = OriginVerifier.verify(this.domainUrl);
                    if (!isOriginValid) {
                        return false;
                    }
                }
                // Chuyển đổi TrackedEvent sang định dạng CreateEventDto
                const payloadObject = {
                    Timestamp: event.timestamp,
                    EventTypeId: event.eventTypeId,
                    ActionType: event.actionType || null,
                    TrackingRuleId: event.trackingRuleId,
                    DomainKey: event.domainKey,
                    AnonymousId: event.anonymousId,
                    ...(event.userId && { UserId: event.userId }),
                    ...(event.itemId && { ItemId: event.itemId }),
                    ...(event.ratingValue !== undefined && { RatingValue: event.ratingValue }),
                    ...(event.ratingReview !== undefined && { RatingReview: event.ratingReview })
                };
                const payload = JSON.stringify(payloadObject);
                // Log payload sẽ gửi đi
                // console.log('[EventDispatcher] Sending payload to API:', payloadObject);
                // Thử từng phương thức gửi theo thứ tự ưu tiên
                const strategies = ['beacon', 'fetch'];
                for (const strategy of strategies) {
                    try {
                        //console.log('[EventDispatcher] Trying strategy:', strategy);
                        const success = await this.sendWithStrategy(payload, strategy);
                        //console.log('[EventDispatcher] Strategy', strategy, 'result:', success);
                        if (success) {
                            if (this.displayManager && typeof this.displayManager.notifyActionTriggered === 'function') {
                                this.displayManager.notifyActionTriggered(event.actionType);
                                console.log('[EventDispatcher] Action type:', event.actionType);
                            }
                            return true;
                        }
                    }
                    catch (error) {
                        //console.log('[EventDispatcher] Strategy', strategy, 'failed with error:', error);
                        // Thử phương thức tiếp theo
                    }
                }
                // Trả về false nếu tất cả phương thức gửi đều thất bại
                return false;
            }
            finally {
                // Remove from sending set after a delay để tránh retry ngay lập tức
                setTimeout(() => {
                    this.sendingEvents.delete(event.id);
                }, 1000);
            }
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
                // throw new Error('sendBeacon not available');
                return false;
            }
            const blob = new Blob([payload], { type: 'application/json' });
            const success = navigator.sendBeacon(this.endpoint, blob);
            if (!success) {
                // throw new Error('sendBeacon returned false');
                return false;
            }
            return true;
        }
        // Fetch với keepalive
        async sendFetch(payload) {
            if (typeof fetch === 'undefined') {
                // throw new Error('fetch not available');
                return false;
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
                    // throw new Error(`HTTP ${response.status}`);
                    return false;
                }
                return true;
            }
            catch (error) {
                clearTimeout(timeoutId);
                // throw error;
                return false;
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
        // Inject DisplayManager để notify action triggered
        setDisplayManager(displayManager) {
            this.displayManager = displayManager;
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

    // Event Deduplication Utility
    // Ngăn chặn các sự kiện hoàn toàn giống nhau được gửi nhiều lần
    // So sánh TẤT CẢ fields quan trọng: eventType, ruleId, userId, anonId, itemId, actionType, domainKey
    // Chặn nếu 2 events giống nhau đến trong vòng 1 giây (theo thời gian thực, không phải event timestamp)
    class EventDeduplicator {
        constructor(timeWindow) {
            this.fingerprints = new Map();
            this.timeWindow = 1000; // 1 second - khoảng thời gian chặn duplicate
            this.cleanupInterval = 30000; // cleanup every 30s (tăng từ 5s)
            this.fingerprintRetentionTime = 15000; // Giữ fingerprints 15s (đủ lâu để catch duplicates)
            if (timeWindow !== undefined) {
                this.timeWindow = timeWindow;
            }
            //console.log('[EventDeduplicator] Created with timeWindow:', this.timeWindow);
            // Periodic cleanup of old fingerprints
            if (typeof window !== 'undefined') {
                setInterval(() => this.cleanup(), this.cleanupInterval);
            }
        }
        // Generate fingerprint từ TẤT CẢ fields quan trọng (trừ timestamp)
        generateFingerprint(eventTypeId, trackingRuleId, userId, anonymousId, itemId, actionType, domainKey) {
            // Dùng raw string để tránh hash collision
            return `${eventTypeId}:${trackingRuleId}:${userId || ''}:${anonymousId}:${itemId || ''}:${actionType || ''}:${domainKey}`;
        }
        // Check if event is duplicate
        // Returns true if event should be DROPPED (is duplicate)
        isDuplicate(eventTypeId, trackingRuleId, userId, anonymousId, itemId, actionType, domainKey) {
            const fingerprint = this.generateFingerprint(eventTypeId, trackingRuleId, userId, anonymousId, itemId, actionType, domainKey);
            const now = Date.now();
            const lastSeen = this.fingerprints.get(fingerprint);
            if (lastSeen) {
                // Check nếu event giống hệt đến trong vòng timeWindow (theo thời gian thực)
                const timeDiff = now - lastSeen.lastSeenTime;
                if (timeDiff < this.timeWindow) {
                    // Update time để reset window
                    this.fingerprints.set(fingerprint, { lastSeenTime: now });
                    return true; // Is duplicate - event giống hệt đến quá nhanh
                }
            }
            // Record fingerprint với thời điểm hiện tại NGAY LẬP TỨC
            // Điều này đảm bảo event tiếp theo sẽ thấy fingerprint này
            this.fingerprints.set(fingerprint, {
                lastSeenTime: now
            });
            //console.log('[EventDeduplicator] ✅ New event recorded');
            return false; // Not duplicate
        }
        // Cleanup old fingerprints to prevent memory leak
        cleanup() {
            const now = Date.now();
            const toDelete = [];
            // console.log('[EventDeduplicator] Cleanup starting, Map size:', this.fingerprints.size);
            this.fingerprints.forEach((data, fingerprint) => {
                const age = now - data.lastSeenTime;
                // Chỉ xóa fingerprints cũ hơn fingerprintRetentionTime (15s)
                if (age > this.fingerprintRetentionTime) {
                    //console.log('[EventDeduplicator] Deleting old fingerprint, age:', age, 'threshold:', this.fingerprintRetentionTime);
                    toDelete.push(fingerprint);
                }
            });
            toDelete.forEach(fp => this.fingerprints.delete(fp));
            //console.log('[EventDeduplicator] Cleanup done, deleted:', toDelete.length, 'remaining:', this.fingerprints.size);
        }
        // Clear all fingerprints (for testing)
        clear() {
            this.fingerprints.clear();
        }
    }

    // Loop Guard cho Network Requests
    // Detects infinite loops hoặc excessive requests đến cùng một endpoint
    // Block việc gửi event nếu phát hiện hành vi lặp vô hạn (không disable rule)
    class LoopGuard {
        constructor(options) {
            this.requests = new Map();
            // Configuration
            this.maxRequestsPerSecond = 5;
            this.windowSize = 1000; // 1 second
            this.blockDuration = 60000; // block for 60 seconds
            this.cleanupInterval = 10000; // cleanup every 10s
            if ((options === null || options === void 0 ? void 0 : options.maxRequestsPerSecond) !== undefined) {
                this.maxRequestsPerSecond = options.maxRequestsPerSecond;
            }
            if ((options === null || options === void 0 ? void 0 : options.windowSize) !== undefined) {
                this.windowSize = options.windowSize;
            }
            if ((options === null || options === void 0 ? void 0 : options.blockDuration) !== undefined) {
                this.blockDuration = options.blockDuration;
            }
            // Periodic cleanup
            if (typeof window !== 'undefined') {
                setInterval(() => this.cleanup(), this.cleanupInterval);
            }
        }
        // Generate key for request tracking
        generateKey(url, method, ruleId) {
            return `${method}:${url}:${ruleId}`;
        }
        // Record a request and check if it exceeds threshold
        // Returns true if request should be BLOCKED
        checkAndRecord(url, method, ruleId) {
            const key = this.generateKey(url, method, ruleId);
            const now = Date.now();
            let record = this.requests.get(key);
            if (!record) {
                // First request
                this.requests.set(key, {
                    count: 1,
                    firstSeen: now,
                    lastSeen: now,
                    blocked: false
                });
                return false; // Allow request
            }
            // Check if this request pattern is currently blocked
            if (record.blocked && record.blockedAt) {
                if (now - record.blockedAt < this.blockDuration) {
                    return true; // Still blocked
                }
                else {
                    // Unblock and reset
                    record.blocked = false;
                    record.blockedAt = undefined;
                    record.count = 1;
                    record.firstSeen = now;
                    record.lastSeen = now;
                    return false; // Allow request
                }
            }
            // Check if we're still in the same window
            const timeElapsed = now - record.firstSeen;
            if (timeElapsed > this.windowSize) {
                // Reset window
                record.count = 1;
                record.firstSeen = now;
                record.lastSeen = now;
                return false; // Allow request
            }
            // Increment count
            record.count++;
            record.lastSeen = now;
            // Check threshold
            const requestsPerSecond = (record.count / timeElapsed) * 1000;
            if (requestsPerSecond > this.maxRequestsPerSecond) {
                // Abuse detected! Block this request pattern temporarily
                record.blocked = true;
                record.blockedAt = now;
                return true; // Block this event
            }
            return false; // Allow request
        }
        // Cleanup old records
        cleanup() {
            const now = Date.now();
            const toDelete = [];
            // Cleanup request records
            this.requests.forEach((record, key) => {
                // Delete records that haven't been seen for a while and aren't blocked
                if (!record.blocked && now - record.lastSeen > this.windowSize * 2) {
                    toDelete.push(key);
                }
                // Delete blocked records after block duration expires
                if (record.blocked && record.blockedAt && now - record.blockedAt > this.blockDuration * 2) {
                    toDelete.push(key);
                }
            });
            toDelete.forEach(key => this.requests.delete(key));
        }
        // Clear all records (for testing)
        clear() {
            this.requests.clear();
        }
        // Get stats about blocked patterns
        getBlockedCount() {
            let count = 0;
            this.requests.forEach(record => {
                if (record.blocked)
                    count++;
            });
            return count;
        }
    }

    class RecommendationFetcher {
        constructor(domainKey, apiBaseUrl) {
            this.CACHE_TTL = 5 * 60 * 1000;
            this.AUTO_REFRESH_INTERVAL = 60 * 1000;
            this.domainKey = domainKey;
            this.apiBaseUrl = apiBaseUrl;
            this.cache = new Map();
            this.autoRefreshTimers = new Map();
            this.refreshCallbacks = new Map();
        }
        async fetchRecommendations(userValue, userField = 'AnonymousId', _options = {}) {
            try {
                const limit = _options.numberItems || 50;
                const cacheKey = this.getCacheKey(userValue, userField);
                const cached = this.getFromCache(cacheKey);
                if (cached && cached.item.length >= limit) {
                    return cached;
                }
                const requestBody = {
                    AnonymousId: this.getOrCreateAnonymousId(),
                    DomainKey: this.domainKey,
                    NumberItems: limit,
                };
                const cachedUserId = this.getCachedUserId();
                if (cachedUserId) {
                    requestBody.UserId = cachedUserId;
                }
                const response = await fetch(`${this.apiBaseUrl}/recommendation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });
                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }
                const data = await response.json();
                const rawItems = (data.item && data.item.length > 0) ? data.item : (data.items || []);
                const transformedItems = this.transformResponse(rawItems);
                // const data: any = await response.json();
                // const transformedItems = this.transformResponse(data.item || data.items || []);
                const finalResponse = {
                    item: transformedItems,
                    keyword: data.keyword || data.search || '',
                    lastItem: data.lastItem || ''
                };
                //console.log("FINAL RESPONSE: ",finalResponse);
                this.saveToCache(cacheKey, finalResponse);
                if (_options.autoRefresh && _options.onRefresh) {
                    if (!this.autoRefreshTimers.has(cacheKey)) {
                        this.enableAutoRefresh(userValue, userField, _options.onRefresh, _options);
                    }
                }
                return finalResponse;
            }
            catch (error) {
                return { item: [], keyword: '', lastItem: '' };
            }
        }
        enableAutoRefresh(userValue, userField = 'AnonymousId', callback, options = {}) {
            const cacheKey = this.getCacheKey(userValue, userField);
            this.stopAutoRefresh(cacheKey);
            this.refreshCallbacks.set(cacheKey, callback);
            this.fetchRecommendations(userValue, userField, options)
                .then(data => callback(data));
            const timerId = setInterval(async () => {
                try {
                    this.cache.delete(cacheKey);
                    const data = await this.fetchRecommendations(userValue, userField, {
                        ...options,
                        autoRefresh: false
                    });
                    const cb = this.refreshCallbacks.get(cacheKey);
                    if (cb)
                        cb(data);
                }
                catch (error) { }
            }, this.AUTO_REFRESH_INTERVAL);
            this.autoRefreshTimers.set(cacheKey, timerId);
            return () => this.stopAutoRefresh(cacheKey);
        }
        stopAutoRefresh(cacheKey) {
            const timerId = this.autoRefreshTimers.get(cacheKey);
            if (timerId) {
                clearInterval(timerId);
                this.autoRefreshTimers.delete(cacheKey);
                this.refreshCallbacks.delete(cacheKey);
            }
        }
        stopAllAutoRefresh() {
            this.autoRefreshTimers.forEach((timerId) => clearInterval(timerId));
            this.autoRefreshTimers.clear();
            this.refreshCallbacks.clear();
        }
        async fetchForAnonymousUser(options = {}) {
            const anonymousId = this.getOrCreateAnonymousId();
            return this.fetchRecommendations(anonymousId, 'AnonymousId', options);
        }
        async fetchForUserId(userId, options = {}) {
            return this.fetchRecommendations(userId, 'UserId', options);
        }
        async fetchForUsername(username, options = {}) {
            return this.fetchRecommendations(username, 'Username', options);
        }
        transformResponse(data) {
            const rawItems = Array.isArray(data) ? data : (data.item || []);
            return rawItems.map((item) => {
                return {
                    ...item,
                    displayTitle: item.Title || item.Name || item.Subject || 'No Title',
                    displayImage: item.ImageUrl || item.Thumbnail || item.Image || '',
                    displayId: item.DomainItemId || item.Id || Math.random().toString(),
                    id: item.Id
                };
            });
        }
        getOrCreateAnonymousId() {
            const storageKey = 'recsys_anon_id';
            try {
                let anonymousId = localStorage.getItem(storageKey);
                if (!anonymousId) {
                    anonymousId = `anon_${Date.now()}_${this.generateRandomString(8)}`;
                    localStorage.setItem(storageKey, anonymousId);
                }
                return anonymousId;
            }
            catch {
                return `anon_${Date.now()}_${this.generateRandomString(8)}`;
            }
        }
        generateRandomString(length) {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++)
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
        }
        getCachedUserId() {
            try {
                const cachedUserInfo = localStorage.getItem('recsys_cached_user_info');
                return cachedUserInfo ? JSON.parse(cachedUserInfo).userValue : null;
            }
            catch {
                return null;
            }
        }
        getCacheKey(userValue, userField) {
            return `${userField}:${userValue}`;
        }
        getFromCache(key) {
            const cached = this.cache.get(key);
            if (!cached)
                return null;
            if (Date.now() - cached.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
                return null;
            }
            return cached.data;
        }
        saveToCache(key, data) {
            this.cache.set(key, { data, timestamp: Date.now() });
        }
        clearCache() { this.cache.clear(); }
        setApiBaseUrl(url) { this.apiBaseUrl = url; this.clearCache(); }
    }

    // Helper function to normalize response (check 'item' first, fallback to 'items')
    function normalizeItems(response) {
        if (!response)
            return [];
        // Priority: item > items > empty array
        if (response.item && response.item.length > 0)
            return response.item;
        if (response.items && response.items.length > 0)
            return response.items;
        return [];
    }

    // --- BỘ TỪ ĐIỂN ĐA NGÔN NGỮ (MỞ RỘNG) ---
    const translations = {
        // 🇻🇳 Tiếng Việt
        'vi': {
            searched: 'Vì bạn đã tìm kiếm "{keyword}"',
            experienced: 'Vì bạn đã trải nghiệm "{lastItem}"',
            default: 'Gợi ý dành riêng cho bạn'
        },
        // 🇺🇸 Tiếng Anh (Mặc định quốc tế)
        'en': {
            searched: 'Because you searched for "{keyword}"',
            experienced: 'Because you experienced "{lastItem}"',
            default: 'Recommendations just for you'
        },
        // 🇩🇪 Tiếng Đức (German)
        'de': {
            searched: 'Weil Sie nach "{keyword}" gesucht haben',
            experienced: 'Weil Sie "{lastItem}" angesehen haben',
            default: 'Empfehlungen speziell für Sie'
        },
        // 🇯🇵 Tiếng Nhật (Japan)
        'ja': {
            searched: '「{keyword}」を検索されたため',
            experienced: '「{lastItem}」をご覧になったため',
            default: 'あなただけのおすすめ'
        },
        // 🇷🇺 Tiếng Nga (Russia)
        'ru': {
            searched: 'Потому что вы искали "{keyword}"',
            experienced: 'Потому что вы интересовались "{lastItem}"',
            default: 'Рекомендации специально для вас'
        },
        // 🇫🇷 Tiếng Pháp (France)
        'fr': {
            searched: 'Parce que vous avez cherché "{keyword}"',
            experienced: 'Parce que vous avez consulté "{lastItem}"',
            default: 'Recommandations juste pour vous'
        },
        // 🇪🇸 Tiếng Tây Ban Nha (Spain)
        'es': {
            searched: 'Porque buscaste "{keyword}"',
            experienced: 'Porque viste "{lastItem}"',
            default: 'Recomendaciones solo para ti'
        },
        // 🇨🇳 Tiếng Trung (China - Simplified)
        'zh': {
            searched: '因为您搜索了“{keyword}”',
            experienced: '因为您浏览了“{lastItem}”',
            default: '为您量身定制的推荐'
        },
        // 🇰🇷 Tiếng Hàn (Korea)
        'ko': {
            searched: '"{keyword}" 검색 결과에 tàra',
            experienced: '"{lastItem}" 관련 추천',
            default: '회원님을 위한 맞춤 추천'
        }
    };
    class PopupDisplay {
        constructor(_domainKey, _slotName, _apiBaseUrl, config = {}, recommendationGetter) {
            var _a;
            this.popupTimeout = null;
            this.autoCloseTimeout = null;
            this.autoSlideTimeout = null;
            this.shadowHost = null;
            this.hostId = ''; // Unique host ID cho mỗi PopupDisplay
            this.spaCheckInterval = null;
            this.isPendingShow = false;
            this.isManuallyClosed = false;
            this.lastCheckedUrl = '';
            this.DEFAULT_DELAY = 5000;
            this.currentLangCode = 'en'; // Biến lưu ngôn ngữ hiện tại
            this.currentSearchKeyword = '';
            this.currentLastItem = '';
            // Cache management
            this.cacheKey = '';
            this.CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
            this.recommendationGetter = recommendationGetter;
            this.domainKey = _domainKey;
            this.apiBaseUrl = _apiBaseUrl;
            this.hostId = `recsys-popup-host-${_slotName}-${Date.now()}`; // Unique ID based on slotName
            this.cacheKey = `recsys-cache-${_domainKey}`; // Shared cache for entire domain
            this.config = {
                delay: (_a = config.delay) !== null && _a !== void 0 ? _a : this.DEFAULT_DELAY,
                autoCloseDelay: config.autoCloseDelay,
                ...config
            };
            this.detectLanguage();
            this.setupLanguageObserver();
        }
        start() {
            this.startWatcher();
        }
        stop() {
            this.clearTimeouts();
            if (this.spaCheckInterval) {
                clearInterval(this.spaCheckInterval);
                this.spaCheckInterval = null;
            }
            this.removePopup();
        }
        detectLanguage() {
            let langCode = this.config.language || document.documentElement.lang || navigator.language;
            const shortCode = langCode ? langCode.substring(0, 2).toLowerCase() : 'vi';
            const newLangCode = translations[shortCode] ? shortCode : 'en';
            if (this.currentLangCode !== newLangCode) {
                this.currentLangCode = newLangCode;
                return true;
            }
            return false;
        }
        setupLanguageObserver() {
            const htmlElement = document.documentElement;
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
                        const hasChanged = this.detectLanguage();
                        if (hasChanged && this.shadowHost && this.shadowHost.shadowRoot) {
                            const titleElement = this.shadowHost.shadowRoot.querySelector('.recsys-header-title');
                            if (titleElement) {
                                titleElement.textContent = this.generateTitle(this.currentSearchKeyword, this.currentLastItem, false, null);
                            }
                        }
                    }
                });
            });
            observer.observe(htmlElement, { attributes: true, attributeFilter: ['lang'] });
        }
        t(key, variables) {
            var _a;
            let text = ((_a = translations[this.currentLangCode]) === null || _a === void 0 ? void 0 : _a[key]) || translations['vi'][key] || key;
            if (variables) {
                for (const [varName, varValue] of Object.entries(variables)) {
                    text = text.replace(new RegExp(`{${varName}}`, 'g'), varValue);
                }
            }
            return text;
        }
        // private generateTitle(search: string, lastItem: string): string {
        //   const context = this.config.triggerConfig?.targetValue;
        //   // Trường hợp 1: Có keyword tìm kiếm
        //   if (context?.includes('search') || context?.includes('query')) {
        //     return this.t('searched', { keyword: search });
        //   }
        //   // Trường hợp 2: Có item xem gần nhất
        //   if (lastItem && lastItem.trim() !== "") {
        //     return this.t('experienced', { lastItem: lastItem });
        //   }
        //   // Trường hợp 3: Mặc định
        //   return this.t('default');
        // }
        generateTitle(search, lastItem, isUserAction, actionType) {
            var _a;
            const context = (_a = this.config.triggerConfig) === null || _a === void 0 ? void 0 : _a.targetValue;
            // Trường hợp 1: User action là search (ưu tiên cao nhất)
            if (actionType === 'search' && search && search.trim() !== "") {
                return this.t('searched', { keyword: search });
            }
            // Trường hợp 2: User action với lastItem (click vào item)
            if (isUserAction && lastItem && lastItem.trim() !== "") {
                return this.t('experienced', { lastItem: lastItem });
            }
            // Trường hợp 3: Config trigger là search page
            if (((context === null || context === void 0 ? void 0 : context.includes('search')) || (context === null || context === void 0 ? void 0 : context.includes('query'))) && search && search.trim() !== "") {
                return this.t('searched', { keyword: search });
            }
            // Trường hợp 4: Có lastItem (auto show)
            if (lastItem && lastItem.trim() !== "") {
                return this.t('experienced', { lastItem: lastItem });
            }
            // Trường hợp 5: Mặc định
            return this.t('default');
        }
        updateContent(response, isUserAction = false, actionType, isFromCache = false) {
            if (!this.shadowHost || !this.shadowHost.shadowRoot)
                return;
            const { keyword, lastItem } = response;
            const titleElement = this.shadowHost.shadowRoot.querySelector('.recsys-header-title');
            if (titleElement) {
                const newTitle = this.generateTitle(keyword, lastItem, isUserAction, actionType);
                // Smooth transition when updating from cache to fresh data
                if (!isFromCache && titleElement.textContent !== newTitle) {
                    titleElement.style.transition = 'opacity 0.3s';
                    titleElement.style.opacity = '0';
                    setTimeout(() => {
                        titleElement.textContent = newTitle;
                        titleElement.style.opacity = '1';
                    }, 300);
                }
                else {
                    titleElement.textContent = newTitle;
                }
                const layout = this.config.layoutJson || {};
                if (layout.contentMode === 'carousel') {
                    this.setupCarousel(this.shadowHost.shadowRoot, normalizeItems(response));
                }
                else {
                    this.renderStaticItems(this.shadowHost.shadowRoot, normalizeItems(response));
                }
            }
        }
        startWatcher() {
            if (this.spaCheckInterval)
                clearInterval(this.spaCheckInterval);
            this.spaCheckInterval = setInterval(async () => {
                var _a, _b, _c, _d;
                const shouldShow = this.shouldShowPopup();
                const isVisible = this.shadowHost !== null;
                const currentUrl = window.location.pathname;
                const isSearchPage = ((_b = (_a = this.config.triggerConfig) === null || _a === void 0 ? void 0 : _a.targetValue) === null || _b === void 0 ? void 0 : _b.includes('search')) || ((_d = (_c = this.config.triggerConfig) === null || _c === void 0 ? void 0 : _c.targetValue) === null || _d === void 0 ? void 0 : _d.includes('query'));
                if (isSearchPage && !this.shadowHost && !this.isManuallyClosed) {
                    return;
                }
                // Nếu URL thay đổi, reset lại trạng thái để cho phép hiện ở trang mới
                if (currentUrl !== this.lastCheckedUrl) {
                    this.isManuallyClosed = false;
                    this.isPendingShow = false;
                    this.lastCheckedUrl = currentUrl;
                }
                if (!shouldShow) {
                    if (isVisible || this.isPendingShow) {
                        this.removePopup();
                        this.clearTimeouts();
                        this.isPendingShow = false;
                    }
                    return;
                }
                // CHỈ BẮT ĐẦU ĐẾM NGƯỢC NẾU:
                // URL khớp + Chưa hiện + Chưa đang đợi + Chưa đóng tay
                if (shouldShow && !isVisible && !this.isPendingShow && !this.isManuallyClosed) {
                    this.isPendingShow = true; // KHÓA NGAY LẬP TỨC
                    const delay = this.config.delay || 0;
                    this.popupTimeout = setTimeout(async () => {
                        try {
                            if (this.shouldShowPopup() && !this.shadowHost) {
                                await this.showPopup();
                            }
                        }
                        finally {
                            // KHÔNG reset isPendingShow về false nếu showPopup không tạo ra shadowHost
                            // Điều này ngăn việc chu kỳ Watcher sau lại nhảy vào đây khi items rỗng
                            if (this.shadowHost) {
                                this.isPendingShow = false;
                            }
                        }
                    }, delay);
                }
            }, 1000);
        }
        // Hàm lên lịch hiển thị (tách riêng logic delay)
        // private scheduleShow(): void {
        //     const delay = this.config.delay || 0;
        //     this.isPendingShow = true;
        //     this.popupTimeout = setTimeout(() => {
        //         if (this.shouldShowPopup()) {
        //             this.showPopup();
        //         }
        //         this.isPendingShow = false;
        //     }, delay);
        // }
        async showPopup(isUserAction = false, actionType = null) {
            try {
                // 🚀 OPTIMISTIC UI: Show cached data immediately if available
                const cached = this.getCache();
                if (cached && cached.item && cached.item.length > 0 && !this.shadowHost) {
                    const cachedItems = normalizeItems(cached);
                    this.renderPopup(cachedItems, cached.keyword, cached.lastItem, isUserAction, actionType);
                    // Setup autoClose for cached popup
                    if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
                        this.autoCloseTimeout = setTimeout(() => {
                            this.removePopup();
                        }, this.config.autoCloseDelay * 1000);
                    }
                }
                // 🔄 FETCH FRESH DATA: Update in background
                const response = await this.fetchRecommendations();
                const items = normalizeItems(response);
                if (items && items.length > 0) {
                    // Save fresh data to cache
                    this.saveCache(response);
                    if (!this.shadowHost) {
                        // No cached popup was shown, render fresh data
                        this.renderPopup(items, response.keyword, response.lastItem, isUserAction, actionType);
                        if (this.config.autoCloseDelay && this.config.autoCloseDelay > 0) {
                            this.autoCloseTimeout = setTimeout(() => {
                                this.removePopup();
                            }, this.config.autoCloseDelay * 1000);
                        }
                    }
                    else {
                        // Update existing popup with fresh data
                        this.updateContent(response, isUserAction, actionType, false);
                    }
                }
            }
            catch (error) {
                this.isPendingShow = false;
                // If fetch fails but cache was shown, keep the cached popup
            }
        }
        // --- LOGIC 1: TRIGGER CONFIG (URL CHECKING) ---
        shouldShowPopup() {
            const trigger = this.config.triggerConfig;
            // Nếu không có trigger config, mặc định cho hiện (hoặc check pages cũ nếu cần)
            if (!trigger || !trigger.targetValue)
                return true;
            // Lấy URL hiện tại (pathname: /products/ao-thun)
            const currentUrl = window.location.pathname;
            const targetUrl = trigger.targetValue;
            if (targetUrl === '/' && currentUrl !== '/')
                return false;
            return currentUrl.includes(targetUrl);
        }
        scheduleNextPopup() {
            this.clearTimeouts();
            // Check ngay lập tức trước khi hẹn giờ
            if (!this.shouldShowPopup()) {
                this.popupTimeout = setTimeout(() => {
                    this.scheduleNextPopup();
                }, 1000);
                return;
            }
            const delay = this.config.delay || 0;
            this.popupTimeout = setTimeout(() => {
                // Check lại lần nữa khi timer nổ (đề phòng SPA chuyển trang)
                if (this.shouldShowPopup()) {
                    this.showPopup();
                }
                else {
                    // Nếu chuyển sang trang không khớp, thử lại sau (hoặc dừng hẳn tùy logic)
                    this.scheduleNextPopup();
                }
            }, delay);
        }
        async fetchRecommendations() {
            var _a;
            try {
                const limit = ((_a = this.config.layoutJson) === null || _a === void 0 ? void 0 : _a.maxItems) || 50;
                const result = await this.recommendationGetter(limit);
                // recommendationGetter now returns full RecommendationResponse
                if (result && result.item && Array.isArray(result.item)) {
                    return result;
                }
                return { item: [], keyword: '', lastItem: '' };
            }
            catch (e) {
                return { item: [], keyword: '', lastItem: '' };
            }
        }
        // --- CACHE MANAGEMENT ---
        saveCache(data) {
            try {
                sessionStorage.setItem(this.cacheKey, JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));
            }
            catch (e) {
                // Quota exceeded or sessionStorage not available, silently fail
            }
        }
        getCache() {
            try {
                const cached = sessionStorage.getItem(this.cacheKey);
                if (!cached)
                    return null;
                const { data, timestamp } = JSON.parse(cached);
                // Check if cache is expired
                if (Date.now() - timestamp > this.CACHE_MAX_AGE) {
                    this.clearCache(); // Remove stale cache
                    return null;
                }
                return data;
            }
            catch {
                return null;
            }
        }
        clearCache() {
            try {
                sessionStorage.removeItem(this.cacheKey);
            }
            catch {
                // Silently fail if sessionStorage not available
            }
        }
        // --- LOGIC 2: DYNAMIC CSS GENERATOR ---
        // --- DYNAMIC CSS GENERATOR (FINAL CLEAN VERSION) ---
        getDynamicStyles() {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const style = this.config.styleJson || {};
            const layout = this.config.layoutJson || {};
            // 1. Unpack Configs
            const tokens = style.tokens || {};
            const components = style.components || {};
            const size = style.size || 'md';
            const density = ((_a = tokens.densityBySize) === null || _a === void 0 ? void 0 : _a[size]) || {};
            // --- Helper Getters ---
            const getColor = (tokenName) => { var _a; return ((_a = tokens.colors) === null || _a === void 0 ? void 0 : _a[tokenName]) || tokenName || 'transparent'; };
            const getRadius = (tokenName) => {
                var _a;
                const r = (_a = tokens.radius) === null || _a === void 0 ? void 0 : _a[tokenName];
                return r !== undefined ? `${r}px` : '4px';
            };
            const getShadow = (tokenName) => { var _a; return ((_a = tokens.shadow) === null || _a === void 0 ? void 0 : _a[tokenName]) || 'none'; };
            // 2. Setup Dimensions
            const contentMode = layout.contentMode || 'grid';
            const modeConfig = ((_b = layout.modes) === null || _b === void 0 ? void 0 : _b[contentMode]) || {};
            // Image Size logic
            // const imgLayout = layout.card?.image?.sizeByMode?.[contentMode as 'grid' | 'list' | 'carousel'] || {};
            // const imgHeightRaw = imgLayout.height || density.imageHeight || 140; 
            // [FIX] Carousel ưu tiên width từ config (96px) thay vì 100% để giống preview
            // let imgWidthRaw = '100%';
            // if (contentMode === 'list') imgWidthRaw = (imgLayout as any).width || 96;
            // if (contentMode === 'carousel' && (imgLayout as any).width) imgWidthRaw = (imgLayout as any).width;
            // const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
            // const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;
            // Popup Wrapper logic
            const popupWrapper = ((_c = layout.wrapper) === null || _c === void 0 ? void 0 : _c.popup) || {};
            const popupWidth = popupWrapper.width ? `${popupWrapper.width}px` : '340px';
            // const popupWidth = '340px';
            // Xử lý Height từ Config (Nếu JSON có height thì dùng, ko thì max-height)
            const popupHeightCSS = popupWrapper.height
                ? `height: ${popupWrapper.height}px;`
                : `height: auto; max-height: 50vh;`;
            let posCSS = 'bottom: 20px; right: 20px;';
            switch (popupWrapper.position) {
                case 'bottom-left':
                    posCSS = 'bottom: 20px; left: 20px;';
                    break;
                case 'top-center':
                    posCSS = 'top: 20px; left: 50%; transform: translateX(-50%);';
                    break;
                case 'center':
                    posCSS = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
                    break;
            }
            // 3. Container Logic
            let containerCSS = '';
            let itemDir = 'column';
            let itemAlign = 'stretch';
            let infoTextAlign = 'left';
            let infoAlignItems = 'flex-start';
            if (contentMode === 'grid') {
                const cols = modeConfig.columns || 2;
                const gapPx = ((_d = tokens.spacingScale) === null || _d === void 0 ? void 0 : _d[modeConfig.gap || 'md']) || 12;
                containerCSS = `
        display: grid; 
        grid-template-columns: repeat(${cols}, 1fr); 
        // gap: ${gapPx}px; 
        gap: 16px; 
        padding: ${density.cardPadding || 16}px;
        `;
            }
            else if (contentMode === 'list') {
                itemDir = 'row';
                itemAlign = 'flex-start';
                const gapPx = ((_e = tokens.spacingScale) === null || _e === void 0 ? void 0 : _e[modeConfig.rowGap || 'md']) || 12;
                containerCSS = `
        display: flex; 
        flex-direction: column;
        // gap: ${gapPx}px; 
        gap: 16px;
        padding: ${density.cardPadding || 16}px;
        `;
                containerCSS = 'padding: 0;';
            }
            // 4. Styles Mapping
            const cardComp = components.card || {};
            const modeOverride = ((_f = style.modeOverrides) === null || _f === void 0 ? void 0 : _f[contentMode]) || {};
            // Colors
            const colorTitle = getColor('textPrimary');
            const colorBody = getColor('textSecondary');
            const colorPrimary = getColor('primary'); // <--- ĐÃ KHAI BÁO LẠI ĐỂ DÙNG
            // Card Specifics
            const cardBg = getColor(cardComp.backgroundToken || 'surface');
            const cardBorder = cardComp.border ? `1px solid ${getColor(cardComp.borderColorToken)}` : 'none';
            const cardRadius = getRadius(cardComp.radiusToken || 'card');
            const cardShadow = getShadow(cardComp.shadowToken);
            const cardPadding = ((_g = modeOverride.card) === null || _g === void 0 ? void 0 : _g.paddingFromDensity)
                ? (density[modeOverride.card.paddingFromDensity] || 12)
                : (density.cardPadding || 12);
            const btnBg = getColor('surface');
            return `
      :host { all: initial; font-family: inherit; box-sizing: border-box; }
      * { box-sizing: border-box; }

      .recsys-popup {
        position: fixed; ${posCSS} width: ${popupWidth}; ${popupHeightCSS}
        background: ${getColor('surface')};
        color: ${colorTitle};
        border-radius: ${getRadius('card')}; 
        box-shadow: ${(_h = tokens.shadow) === null || _h === void 0 ? void 0 : _h.cardHover};
        border: 1px solid ${getColor('border')};
        display: flex; flex-direction: column; z-index: 999999; overflow: hidden;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      .recsys-header {
        padding: 12px 16px; border-bottom: 1px solid ${getColor('border')};
        display: flex; justify-content: space-between; align-items: center;
        background: ${getColor('surface')};
        flex-shrink: 0; 
      }
      .recsys-header-title {
          font-size: ${((_k = (_j = tokens.typography) === null || _j === void 0 ? void 0 : _j.title) === null || _k === void 0 ? void 0 : _k.fontSize) || 16}px;
          font-weight: ${((_m = (_l = tokens.typography) === null || _l === void 0 ? void 0 : _l.title) === null || _m === void 0 ? void 0 : _m.fontWeight) || 600};
          color: ${colorTitle};
      }
      .recsys-close { background: none; border: none; color: ${colorBody}; cursor: pointer; font-size: 18px; }

      .recsys-body {
        position: relative; flex-grow: 0; overflow-y: auto;
        scrollbar-width: thin; scrollbar-color: ${getColor('border')} transparent;
        background: ${getColor('surface')};
      }
      .recsys-container { ${containerCSS} }

      .recsys-item {
         display: flex; 
         flex-direction: ${itemDir}; 
         align-items: ${itemAlign};
         gap: ${((_o = tokens.spacingScale) === null || _o === void 0 ? void 0 : _o.sm) || 8}px;
         background: ${cardBg}; 
         border: ${cardBorder}; 
         border-radius: ${cardRadius};
         box-shadow: ${cardShadow}; 
         padding: ${cardPadding}px;
         cursor: pointer; 
         transition: all 0.2s;
         width: 100%; 
         min-width: 0; 
         box-sizing: border-box; 
         overflow: hidden;
      }

      /* SỬ DỤNG colorPrimary Ở ĐÂY */
      .recsys-item:hover .recsys-name {
          color: ${colorPrimary}; 
      }

      ${((_p = cardComp.hover) === null || _p === void 0 ? void 0 : _p.enabled) ? `
      .recsys-item:hover {
        //  transform: translateY(-${cardComp.hover.liftPx || 1}px);
        scale: 1.02;
         box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
         /* Optional: border-color: ${colorPrimary}; */
      }
      ` : ''}

      .recsys-img-box {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 4px;
      }

      .recsys-img-box img { 
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 4px;
          background-color: var(--sidebar-bg);
          transition: all 0.3s ease;
      }

      .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
        align-items: ${infoAlignItems}; width: 100%}
      
      .recsys-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
      }

      .recsys-field-row {
        width: 100%;
        min-width: 0;
        display: block;
      }

      .recsys-value {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
      }

      .recsys-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
      .recsys-badge { 
         font-size: 10px; 
         background: ${getColor(((_q = components.badge) === null || _q === void 0 ? void 0 : _q.backgroundToken) || 'primary')}; 
         color: ${((_r = components.badge) === null || _r === void 0 ? void 0 : _r.textColor) || '#fff'};
         padding: 2px 6px; border-radius: ${getRadius('badge')};
      }

      .recsys-nav {
         position: absolute; top: 50%; transform: translateY(-50%);
         width: 32px; height: 32px; /* To hơn */
         border-radius: 50%;
         background: ${btnBg}; /* Màu nền theo theme */
         border: 1px solid ${getColor('border')};
         display: flex; align-items: center; justify-content: center;
         z-index: 10; cursor: pointer; color: ${colorTitle};
         box-shadow: 0 2px 8px rgba(0,0,0,0.15); /* Đổ bóng */
         font-size: 18px; padding-bottom: 2px;
         opacity: 0.9;
         transition: opacity 0.2s;
      }
      .recsys-nav:hover { opacity: 1; }
      .recsys-prev { left: 12px; } /* Căn sát mép hơn */
      .recsys-next { right: 12px; }
      .recsys-slide { 
         padding: 12px 48px; /* Padding trái phải lớn để chừa chỗ cho nút */
         display: flex; 
         justify-content: center;
      }
    `;
        }
        // --- LOGIC 3: DYNAMIC HTML RENDERER ---
        // --- LOGIC 3: DYNAMIC HTML RENDERER (UPDATED) ---
        renderItemContent(item) {
            var _a, _b, _c, _d;
            const customizingFields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
            const activeFields = customizingFields.filter(f => f.isEnabled).sort((a, b) => a.position - b.position);
            // 1. Lấy Config Style & Colors
            const styleJson = this.config.styleJson || {};
            const fieldOverrides = ((_c = (_b = styleJson.components) === null || _b === void 0 ? void 0 : _b.fieldRow) === null || _c === void 0 ? void 0 : _c.overrides) || {};
            const colors = ((_d = styleJson.tokens) === null || _d === void 0 ? void 0 : _d.colors) || {}; // <--- Lấy bảng màu
            // Helper: Lấy giá trị item (Giữ nguyên)
            const getValue = (obj, configKey) => {
                if (!obj)
                    return '';
                if (obj[configKey] !== undefined)
                    return obj[configKey];
                const pascalKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase()).replace(/^\w/, c => c.toUpperCase());
                if (obj[pascalKey] !== undefined)
                    return obj[pascalKey];
                const camelKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase());
                if (obj[camelKey] !== undefined)
                    return obj[camelKey];
                if (obj[configKey.toUpperCase()] !== undefined)
                    return obj[configKey.toUpperCase()];
                const lowerKey = configKey.toLowerCase();
                if (['title', 'name', 'product_name', 'item_name'].includes(lowerKey))
                    return obj['Title'] || obj['title'] || obj['Name'] || obj['name'];
                if (['image', 'img', 'image_url', 'avatar'].includes(lowerKey))
                    return obj['ImageUrl'] || obj['imageUrl'] || obj['Img'] || obj['img'] || obj['Image'] || obj['image'];
                return '';
            };
            // Helper mới: Tính toán Style cuối cùng (Kết hợp Default Theme + Manual Override)
            const getFinalStyle = (fieldKey) => {
                const key = fieldKey.toLowerCase();
                const override = fieldOverrides[fieldKey] || {};
                // A. XÁC ĐỊNH MÀU MẶC ĐỊNH DỰA THEO LOẠI FIELD (Mapping logic)
                let defaultColor = colors.textSecondary; // Mặc định là màu phụ
                let defaultWeight = '400';
                let defaultSize = 12;
                if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
                    defaultColor = colors.textPrimary;
                    defaultWeight = '600';
                    defaultSize = 14;
                }
                else if (key.includes('price')) {
                    defaultColor = colors.primary; // Hoặc colors.warning tùy theme
                    defaultWeight = '700';
                    defaultSize = 14;
                }
                else if (key.includes('rating')) {
                    defaultColor = colors.warning;
                }
                else if (key.includes('category') || key.includes('categories')) {
                    defaultColor = colors.primary;
                    defaultSize = 11;
                }
                // B. LẤY GIÁ TRỊ CUỐI CÙNG (Ưu tiên Override nếu có)
                const finalColor = override.color || defaultColor;
                const finalSize = override.fontSize || defaultSize;
                const finalWeight = override.fontWeight || defaultWeight;
                // C. TẠO CHUỖI CSS
                let style = '';
                if (finalColor)
                    style += `color: ${finalColor} !important; `;
                if (finalSize)
                    style += `font-size: ${finalSize}px !important; `;
                if (finalWeight)
                    style += `font-weight: ${finalWeight} !important; `;
                // if (['artist', 'singer', 'performer', 'artist_name', 'description'].includes(key)) {
                //   style += `
                //     white-space: nowrap; 
                //     overflow: hidden; 
                //     text-overflow: ellipsis; 
                //     display: block; 
                //     max-width: 100%;
                //   `;
                // }
                return style;
            };
            // 2. Render Title & Image
            const titleFieldConfig = activeFields.find(f => ['title', 'name', 'product_name', 'item_name'].includes(f.key.toLowerCase()));
            const titleValue = titleFieldConfig ? getValue(item, titleFieldConfig.key) : getValue(item, 'title');
            // Áp dụng style cho Title
            const titleStyle = titleFieldConfig ? getFinalStyle(titleFieldConfig.key) : `color: ${colors.textPrimary}; font-weight: 600;`;
            const imageFieldConfig = activeFields.find(f => ['image', 'img', 'image_url', 'imageurl'].includes(f.key.toLowerCase()));
            const imgSrc = imageFieldConfig ? getValue(item, imageFieldConfig.key) : getValue(item, 'image');
            // 3. Render Khung
            let html = `
       <div class="recsys-item" data-id="${item.id}">
          ${imgSrc ? `
          <div class="recsys-img-box">
             <img src="${imgSrc}" alt="${titleValue || ''}" />
          </div>` : ''}
          
          <div class="recsys-info">
             <div class="recsys-name" title="${titleValue}" style="${titleStyle}">
                ${titleValue || ''}
             </div>
    `;
            // 4. Render các field còn lại
            activeFields.forEach(field => {
                const key = field.key.toLowerCase();
                let rawValue = getValue(item, field.key);
                if (!rawValue) {
                    return;
                }
                if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key))
                    return;
                if (rawValue === undefined || rawValue === null || rawValue === '')
                    return;
                // [SỬA ĐỔI] Xử lý mảng: Nối thành chuỗi (Pop, Ballad) thay vì render Badge
                let displayValue = rawValue;
                if (Array.isArray(rawValue)) {
                    displayValue = rawValue.join(', ');
                }
                // Lấy style (Category sẽ tự lấy màu Primary từ hàm getFinalStyle)
                const valueStyle = getFinalStyle(field.key);
                html += `<div class="recsys-field-row">
            <span class="recsys-value" style="${valueStyle}">${displayValue}</span>
        </div>`;
            });
            html += `</div></div>`;
            return html;
        }
        renderPopup(items, search, lastItem, isUserAction = false, actionType) {
            // Lưu keyword và lastItem để language observer có thể regenerate title
            // this.currentSearchKeyword = search || '';
            // this.currentLastItem = lastItem || '';
            var _a;
            this.removePopup();
            //const returnMethodValue = (this.config as any).value || "";
            const dynamicTitle = this.generateTitle(search, lastItem, isUserAction, actionType);
            const host = document.createElement('div');
            host.id = this.hostId;
            document.body.appendChild(host);
            const shadow = host.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = this.getDynamicStyles();
            shadow.appendChild(style);
            // Main Popup
            const layout = this.config.layoutJson || {};
            const contentMode = layout.contentMode || 'carousel';
            const popup = document.createElement('div');
            popup.className = 'recsys-popup';
            popup.innerHTML = `
      <div class="recsys-header">
        <span class="recsys-header-title">${dynamicTitle}</span>
        <button class="recsys-close">✕</button>
      </div>
      <div class="recsys-body">${contentMode === 'carousel' ? '<button class="recsys-nav recsys-prev">‹</button>' : ''}  
      <div class="${contentMode === 'carousel' ? 'recsys-slide' : 'recsys-container'}"></div>
        ${contentMode === 'carousel' ? '<button class="recsys-nav recsys-next">›</button>' : ''}
      </div>
    `;
            shadow.appendChild(popup);
            this.shadowHost = host;
            if (contentMode === 'carousel') {
                this.setupCarousel(shadow, items);
            }
            else {
                // Nếu là Grid hoặc List -> Render tất cả items ra luôn
                this.renderStaticItems(shadow, items);
            }
            (_a = shadow.querySelector('.recsys-close')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
                if (this.autoSlideTimeout)
                    clearTimeout(this.autoSlideTimeout);
                this.isManuallyClosed = true;
                this.removePopup();
            });
        }
        renderStaticItems(shadow, items) {
            const container = shadow.querySelector('.recsys-container');
            if (!container)
                return;
            container.innerHTML = '';
            items.forEach((item, index) => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.renderItemContent(item);
                const itemElement = tempDiv.firstElementChild;
                if (itemElement) {
                    itemElement.addEventListener('click', () => {
                        const targetId = item.DomainItemId;
                        const rank = index + 1;
                        this.handleItemClick(targetId, rank);
                    });
                    container.appendChild(itemElement);
                }
            });
        }
        setupCarousel(shadow, items) {
            var _a, _b;
            let currentIndex = 0;
            const slideContainer = shadow.querySelector('.recsys-slide');
            const renderSlide = () => {
                const item = items[currentIndex];
                slideContainer.innerHTML = '';
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.renderItemContent(item);
                const slideElement = tempDiv.firstElementChild;
                if (slideElement) {
                    slideElement.addEventListener('click', () => {
                        const targetId = item.DomainItemId || item.id || item.Id;
                        const rank = currentIndex + 1;
                        if (targetId)
                            this.handleItemClick(targetId, rank);
                    });
                    slideContainer.appendChild(slideElement);
                }
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
                if (this.autoSlideTimeout)
                    clearTimeout(this.autoSlideTimeout);
                this.autoSlideTimeout = setTimeout(next, this.DEFAULT_DELAY);
            };
            (_a = shadow.querySelector('.recsys-prev')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', prev);
            (_b = shadow.querySelector('.recsys-next')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', next);
            renderSlide();
            resetAutoSlide();
        }
        removePopup() {
            if (this.shadowHost) {
                this.shadowHost.remove();
                this.shadowHost = null;
                this.isPendingShow = false;
            }
        }
        clearTimeouts() {
            if (this.popupTimeout)
                clearTimeout(this.popupTimeout);
            if (this.autoCloseTimeout)
                clearTimeout(this.autoCloseTimeout);
            if (this.autoSlideTimeout)
                clearTimeout(this.autoSlideTimeout);
            this.popupTimeout = null;
            this.autoCloseTimeout = null;
            this.autoSlideTimeout = null;
        }
        async handleItemClick(id, rank) {
            if (!id)
                return;
            // Invalidate cache since user context has changed
            this.clearCache();
            // Send evaluation request
            try {
                const evaluationUrl = `${this.apiBaseUrl}/evaluation`;
                await fetch(evaluationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        DomainKey: this.domainKey,
                        Rank: rank
                    })
                });
            }
            catch (error) {
                // //console.error('[PopupDisplay] Failed to send evaluation:', error);
            }
            // const targetUrl = `/song/${id}`;
            let urlPattern = this.config.layoutJson.itemUrlPattern || '/song/{:id}';
            const targetUrl = urlPattern.replace('{:id}', id.toString());
            // Try SPA-style navigation first
            try {
                // 1. Update URL without reload
                window.history.pushState({}, '', targetUrl);
                // 2. Dispatch events to notify SPA frameworks
                window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                // 3. Custom event for frameworks that listen to custom routing events
                window.dispatchEvent(new CustomEvent('navigate', {
                    detail: { path: targetUrl, from: 'recsys-tracker' }
                }));
                // 4. Trigger link click event (some frameworks listen to this)
                // const clickEvent = new MouseEvent('click', {
                //   bubbles: true,
                //   cancelable: true,
                //   view: window
                // });
                // If navigation didn't work (URL changed but page didn't update), fallback
                // Check after a short delay if the page updated
                setTimeout(() => {
                    // If window.location.pathname is different from targetUrl, means framework didn't handle it
                    // So we need to force reload
                    if (window.location.pathname !== targetUrl) {
                        window.location.href = targetUrl;
                    }
                }, 100);
            }
            catch (error) {
                // Fallback to traditional navigation if History API fails
                window.location.href = targetUrl;
            }
        }
        forceShow(isUserAction = false, actionType = null) {
            //console.log('[Popup] Forced show: ', actionType);
            this.isManuallyClosed = false;
            this.isPendingShow = false;
            this.removePopup();
            if (this.shouldShowPopup()) {
                this.showPopup(isUserAction, actionType);
            }
        }
    }

    class InlineDisplay {
        constructor(_domainKey, _slotName, selector, _apiBaseUrl, config = {}, recommendationGetter) {
            this.observer = null;
            this.debounceTimer = null;
            this.autoSlideTimeout = null;
            this.DEFAULT_DELAY = 5000;
            this.selector = selector;
            this.domainKey = _domainKey;
            this.apiBaseUrl = _apiBaseUrl;
            this.recommendationGetter = recommendationGetter;
            this.config = { ...config };
        }
        start() {
            this.scanAndRender();
            this.setupObserver();
        }
        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            if (this.autoSlideTimeout) {
                clearTimeout(this.autoSlideTimeout);
            }
        }
        // --- CORE INLINE LOGIC (Mutation Observer) ---
        setupObserver() {
            this.observer = new MutationObserver(() => {
                if (this.debounceTimer)
                    clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.scanAndRender();
                }, 100);
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
        scanAndRender() {
            const containers = this.findContainers();
            containers.forEach(container => {
                this.processContainer(container);
            });
        }
        findContainers() {
            let containers = document.querySelectorAll(this.selector);
            if (containers.length === 0) {
                // Get the base name without special characters
                let baseName = this.selector.replace(/^[.#]/, ''); // Remove leading . or #
                // Strategy 1: Try as class selector
                if (!this.selector.startsWith('.')) {
                    const classSelector = `.${baseName}`;
                    containers = document.querySelectorAll(classSelector);
                }
                // Strategy 2: Try attribute selector for CSS Modules
                if (containers.length === 0) {
                    const attributeSelector = `[class*="${baseName}"]`;
                    containers = document.querySelectorAll(attributeSelector);
                }
                // Strategy 3: Try as ID
                if (containers.length === 0 && !this.selector.startsWith('#')) {
                    const idSelector = `#${baseName}`;
                    containers = document.querySelectorAll(idSelector);
                }
                // Strategy 4: Try without leading dot (for edge cases)
                if (containers.length === 0 && this.selector.startsWith('.')) {
                    containers = document.querySelectorAll(baseName);
                }
            }
            return containers;
        }
        async processContainer(container) {
            if (!container || container.getAttribute('data-recsys-loaded') === 'true') {
                return;
            }
            container.setAttribute('data-recsys-loaded', 'true');
            try {
                // Render skeleton loading state immediately
                this.renderSkeletonWidget(container);
                // Fetch recommendations asynchronously
                const response = await this.fetchRecommendations();
                const items = normalizeItems(response);
                // Replace skeleton with actual content
                if (items && items.length > 0) {
                    this.renderWidget(container, items);
                }
            }
            catch (error) {
                // console.error('[InlineDisplay] Error processing container', error);
            }
        }
        async fetchRecommendations() {
            try {
                // const limit = (this.config.layoutJson as any)?.maxItems || 50;
                // console.log('[PopupDisplay] Calling recommendationGetter with limit:', limit);
                const result = await this.recommendationGetter();
                // console.log('[PopupDisplay] recommendationGetter result:', result);
                // recommendationGetter now returns full RecommendationResponse
                if (result && result.item && Array.isArray(result.item)) {
                    return result;
                }
                // console.log('[PopupDisplay] Invalid result, returning empty');
                return { item: [], keyword: '', lastItem: '' };
            }
            catch (e) {
                // console.error('[PopupDisplay] fetchRecommendations error:', e);
                return { item: [], keyword: '', lastItem: '' };
            }
        }
        // --- DYNAMIC CSS GENERATOR (SYNCED WITH POPUP) ---
        getDynamicStyles() {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const style = this.config.styleJson || {};
            const layout = this.config.layoutJson || {};
            // 1. Unpack Configs
            const tokens = style.tokens || {};
            const components = style.components || {};
            const size = style.size || 'md';
            const density = ((_a = tokens.densityBySize) === null || _a === void 0 ? void 0 : _a[size]) || {};
            // --- Helper Getters ---
            const getColor = (tokenName) => { var _a; return ((_a = tokens.colors) === null || _a === void 0 ? void 0 : _a[tokenName]) || tokenName || 'transparent'; };
            const getRadius = (tokenName) => {
                var _a;
                const r = (_a = tokens.radius) === null || _a === void 0 ? void 0 : _a[tokenName];
                return r !== undefined ? `${r}px` : '4px';
            };
            const getShadow = (tokenName) => { var _a; return ((_a = tokens.shadow) === null || _a === void 0 ? void 0 : _a[tokenName]) || 'none'; };
            // 2. Setup Dimensions
            const contentMode = layout.contentMode || 'grid';
            const modeConfig = ((_b = layout.modes) === null || _b === void 0 ? void 0 : _b[contentMode]) || {};
            // Image Size logic - not used anymore with aspect-ratio approach
            // const imgLayout = layout.card?.image?.sizeByMode?.[contentMode as 'grid' | 'list' | 'carousel'] || {};
            // const imgHeightRaw = imgLayout.height || density.imageHeight || 150; 
            // let imgWidthRaw: string | number = contentMode === 'grid' ? 150 : '100%';
            // if (contentMode === 'list') imgWidthRaw = (imgLayout as any).width || 96;
            // if (contentMode === 'carousel' && (imgLayout as any).width) imgWidthRaw = (imgLayout as any).width;
            // const imgHeight = typeof imgHeightRaw === 'number' ? `${imgHeightRaw}px` : imgHeightRaw;
            // const imgWidth = typeof imgWidthRaw === 'number' ? `${imgWidthRaw}px` : imgWidthRaw;
            // 3. Container Logic
            let containerCSS = '';
            let itemDir = 'column';
            let itemAlign = 'stretch';
            let infoTextAlign = 'left';
            let infoAlignItems = 'flex-start';
            let itemWidthCSS = 'width: 100%;';
            if (contentMode === 'grid') {
                const cols = modeConfig.columns || 4; // Inline default thường rộng hơn popup (4 cột)
                const gapPx = ((_c = tokens.spacingScale) === null || _c === void 0 ? void 0 : _c[modeConfig.gap || 'md']) || 16;
                containerCSS = `
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: ${gapPx}px;
      `;
            }
            else if (contentMode === 'list') {
                itemDir = 'row';
                itemAlign = 'flex-start';
                const gapPx = ((_d = tokens.spacingScale) === null || _d === void 0 ? void 0 : _d[modeConfig.rowGap || 'md']) || 12;
                containerCSS = `display: flex; flex-direction: column; gap: ${gapPx}px;`;
            }
            else if (contentMode === 'carousel') {
                const cols = modeConfig.itemsPerView || modeConfig.columns || 5;
                const gap = ((_e = tokens.spacingScale) === null || _e === void 0 ? void 0 : _e[modeConfig.gap || 'md']) || 16;
                containerCSS = `
        display: flex; 
        justify-content: center; 
        padding: 0 40px; 
        position: relative; 
        min-height: 200px;
    `;
                itemWidthCSS = `
        flex: 0 0 calc((100% - (${cols} - 1) * ${gap}px) / ${cols});
        max-width: calc((100% - (${cols} - 1) * ${gap}px) / ${cols});
        margin: 0; /* Xóa margin auto cũ */
      `;
            }
            // 4. Styles Mapping
            const cardComp = components.card || {};
            const modeOverride = ((_f = style.modeOverrides) === null || _f === void 0 ? void 0 : _f[contentMode]) || {};
            // Colors
            const colorTitle = getColor('textPrimary');
            //const colorBody = getColor('textSecondary');
            const colorPrimary = getColor('primary');
            // Card Specifics
            const cardBg = getColor(cardComp.backgroundToken || 'surface');
            const cardBorder = cardComp.border ? `1px solid ${getColor(cardComp.borderColorToken)}` : 'none';
            const cardRadius = getRadius(cardComp.radiusToken || 'card');
            const cardShadow = getShadow(cardComp.shadowToken);
            const cardPadding = ((_g = modeOverride.card) === null || _g === void 0 ? void 0 : _g.paddingFromDensity)
                ? (density[modeOverride.card.paddingFromDensity] || 12)
                : (density.cardPadding || 12);
            const btnBg = getColor('surface');
            return `
    :host { all: initial; font-family: inherit; width: 100%; display: block; box-sizing: border-box; }
    * { box-sizing: border-box; }

    .recsys-wrapper {
      width: 100%;
      background: ${getColor('surface')};
      border-radius: 8px;
    }

    .recsys-header {
      border-bottom: 1px solid ${getColor('border')};
      padding-bottom: 8px;
      justify-content: space-between; align-items: center;
    }
    .recsys-header-title {
      font-size: ${((_j = (_h = tokens.typography) === null || _h === void 0 ? void 0 : _h.title) === null || _j === void 0 ? void 0 : _j.fontSize) || 18}px;
      font-weight: ${((_l = (_k = tokens.typography) === null || _k === void 0 ? void 0 : _k.title) === null || _l === void 0 ? void 0 : _l.fontWeight) || 600};
      color: ${colorTitle};
    }

    .recsys-container { ${containerCSS} }

    .recsys-item {
      display: flex; flex-direction: ${itemDir}; align-items: ${itemAlign};
      gap: ${((_m = tokens.spacingScale) === null || _m === void 0 ? void 0 : _m.sm) || 8}px;
      background: ${cardBg}; border: ${cardBorder}; border-radius: ${cardRadius};
      box-shadow: ${cardShadow}; padding: ${cardPadding}px;
      cursor: pointer; transition: all 0.2s;
      ${itemWidthCSS}
      min-width: 0; /* Fix flex overflow */
    }

    .recsys-item:hover .recsys-name {
      color: ${colorPrimary}; 
    }

    ${((_o = cardComp.hover) === null || _o === void 0 ? void 0 : _o.enabled) ? `
    .recsys-item:hover {
      // transform: translateY(-${cardComp.hover.liftPx || 2}px);
      scale: 1.02;
      box-shadow: ${getShadow(cardComp.hover.shadowToken || 'cardHover')};
    }
    ` : ''}

    .recsys-img-box {
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden; 
        // background: ${getColor('muted')}; 
        flex-shrink: 0;
        border-radius: 4px;
    }
    .recsys-img-box img { 
        width: 100%; 
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        transition: all 0.3s ease;
    }

    .recsys-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; text-align: ${infoTextAlign}; 
      align-items: ${infoAlignItems};}

    .recsys-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    .recsys-field-row {
      width: 100%;
      min-width: 0;
      display: block;
    }

    .recsys-value {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      max-width: 100%;
    }

    /* Buttons for Carousel */
    .recsys-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 32px; height: 32px;
      border-radius: 50%;
      background: ${btnBg};
      border: 1px solid ${getColor('border')};
      display: flex; align-items: center; justify-content: center;
      z-index: 10; cursor: pointer; color: ${colorTitle};
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 18px; padding-bottom: 2px;
      opacity: 0.9; transition: opacity 0.2s;
    }
    .recsys-nav:hover { opacity: 1; }
    .recsys-prev { left: 0; }
    .recsys-next { right: 0; }

    /* Skeleton Loading Styles */
    .skeleton-item {
      display: flex;
      flex-direction: ${itemDir};
      align-items: ${itemAlign};
      gap: ${((_p = tokens.spacingScale) === null || _p === void 0 ? void 0 : _p.sm) || 8}px;
      background: ${cardBg};
      border: ${cardBorder};
      border-radius: ${cardRadius};
      padding: ${cardPadding}px;
      ${itemWidthCSS}
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      pointer-events: none;
    }

    .skeleton {
      background: linear-gradient(90deg, #e0e0e0 25%, #d0d0d0 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-img {
      width: 100%;
      aspect-ratio: 1;
      flex-shrink: 0;
    }

    .skeleton-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .skeleton-title {
      height: 16px;
      width: 80%;
    }

    .skeleton-text {
      height: 12px;
      width: 60%;
    }

    .skeleton-text-short {
      height: 12px;
      width: 40%;
    }
  `;
        }
        // --- SKELETON LOADING STATE ---
        renderSkeletonItem() {
            return `
      <div class="skeleton-item">
        <div class="skeleton-img skeleton"></div>
        <div class="skeleton-info">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-short"></div>
        </div>
      </div>
    `;
        }
        renderSkeletonWidget(container) {
            var _a;
            const layout = this.config.layoutJson || {};
            const contentMode = layout.contentMode || 'grid';
            const modeConfig = ((_a = layout.modes) === null || _a === void 0 ? void 0 : _a[contentMode]) || {};
            // Determine skeleton count based on mode
            let skeletonCount = 4;
            if (contentMode === 'grid') {
                skeletonCount = modeConfig.columns || 4;
                if (skeletonCount < 4)
                    skeletonCount = 4; // At least 4 items for grid
            }
            else if (contentMode === 'list') {
                skeletonCount = 3;
            }
            else if (contentMode === 'carousel') {
                skeletonCount = modeConfig.itemsPerView || 5;
            }
            container.innerHTML = '';
            const shadow = container.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = this.getDynamicStyles();
            shadow.appendChild(style);
            const wrapper = document.createElement('div');
            wrapper.className = 'recsys-widget';
            if (contentMode === 'carousel') {
                wrapper.innerHTML = `
        <button class="recsys-nav recsys-prev">‹</button>
        <div class="recsys-container"></div>
        <button class="recsys-nav recsys-next">›</button>
      `;
            }
            else {
                wrapper.innerHTML = '<div class="recsys-container"></div>';
            }
            shadow.appendChild(wrapper);
            const containerEl = shadow.querySelector('.recsys-container');
            if (containerEl) {
                for (let i = 0; i < skeletonCount; i++) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.renderSkeletonItem();
                    const skeletonElement = tempDiv.firstElementChild;
                    if (skeletonElement) {
                        containerEl.appendChild(skeletonElement);
                    }
                }
            }
        }
        // --- DYNAMIC HTML RENDERER (SYNCED WITH POPUP) ---
        renderItemContent(item) {
            var _a, _b, _c, _d;
            const customizingFields = ((_a = this.config.customizingFields) === null || _a === void 0 ? void 0 : _a.fields) || [];
            const activeFields = customizingFields.filter(f => f.isEnabled).sort((a, b) => a.position - b.position);
            // 1. Configs & Colors
            const styleJson = this.config.styleJson || {};
            const fieldOverrides = ((_c = (_b = styleJson.components) === null || _b === void 0 ? void 0 : _b.fieldRow) === null || _c === void 0 ? void 0 : _c.overrides) || {};
            const colors = ((_d = styleJson.tokens) === null || _d === void 0 ? void 0 : _d.colors) || {};
            // Helper: Smart Get Value
            const getValue = (obj, configKey) => {
                if (!obj)
                    return '';
                if (obj[configKey] !== undefined)
                    return obj[configKey];
                const pascalKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase()).replace(/^\w/, c => c.toUpperCase());
                if (obj[pascalKey] !== undefined)
                    return obj[pascalKey];
                const camelKey = configKey.replace(/(_\w)/g, m => m[1].toUpperCase());
                if (obj[camelKey] !== undefined)
                    return obj[camelKey];
                if (obj[configKey.toUpperCase()] !== undefined)
                    return obj[configKey.toUpperCase()];
                const lowerKey = configKey.toLowerCase();
                if (['title', 'name', 'product_name', 'item_name'].includes(lowerKey))
                    return obj['Title'] || obj['title'] || obj['Name'] || obj['name'];
                if (['image', 'img', 'image_url', 'avatar'].includes(lowerKey))
                    return obj['ImageUrl'] || obj['imageUrl'] || obj['Img'] || obj['img'] || obj['Image'] || obj['image'];
                return '';
            };
            // Helper: Get Final Style (Override > Default)
            const getFinalStyle = (fieldKey) => {
                const key = fieldKey.toLowerCase();
                const override = fieldOverrides[fieldKey] || {};
                let defaultColor = colors.textSecondary;
                let defaultWeight = '400';
                let defaultSize = 12;
                if (['title', 'name', 'product_name', 'item_name'].includes(key)) {
                    defaultColor = colors.textPrimary;
                    defaultWeight = '600';
                    defaultSize = 14;
                }
                else if (key.includes('price')) {
                    defaultColor = colors.primary;
                    defaultWeight = '700';
                    defaultSize = 14;
                }
                else if (key.includes('rating')) {
                    defaultColor = colors.warning;
                }
                else if (key.includes('category') || key.includes('categories')) {
                    defaultColor = colors.primary;
                    defaultSize = 11;
                }
                const finalColor = override.color || defaultColor;
                const finalSize = override.fontSize || defaultSize;
                const finalWeight = override.fontWeight || defaultWeight;
                let style = '';
                if (finalColor)
                    style += `color: ${finalColor} !important; `;
                if (finalSize)
                    style += `font-size: ${finalSize}px !important; `;
                if (finalWeight)
                    style += `font-weight: ${finalWeight} !important; `;
                // if (['artist', 'singer', 'performer', 'artist_name', 'description'].includes(key)) {
                //   style += `
                //     white-space: nowrap; 
                //     overflow: hidden; 
                //     text-overflow: ellipsis; 
                //     display: block; 
                //     max-width: 100%;
                //     width: 100%;
                //   `;
                // }
                return style;
            };
            // 2. Extract Data
            const titleFieldConfig = activeFields.find(f => ['title', 'name', 'product_name', 'item_name'].includes(f.key.toLowerCase()));
            const titleValue = titleFieldConfig ? getValue(item, titleFieldConfig.key) : getValue(item, 'title');
            const titleStyle = titleFieldConfig ? getFinalStyle(titleFieldConfig.key) : `color: ${colors.textPrimary}; font-weight: 600;`;
            const imageFieldConfig = activeFields.find(f => ['image', 'img', 'image_url', 'imageurl'].includes(f.key.toLowerCase()));
            const imgSrc = imageFieldConfig ? getValue(item, imageFieldConfig.key) : getValue(item, 'image');
            // 3. Render HTML Structure
            let html = `
      <div class="recsys-item" data-id="${item.id || ''}">
        ${imgSrc ? `
        <div class="recsys-img-box">
            <img src="${imgSrc}" alt="${titleValue || ''}" />
        </div>` : ''}
        
        <div class="recsys-info">
            <div class="recsys-name" title="${titleValue}" style="${titleStyle}">
              ${titleValue || ''}
            </div>
    `;
            // 4. Render Remaining Fields
            activeFields.forEach(field => {
                const key = field.key.toLowerCase();
                if (['image', 'img', 'image_url', 'title', 'name', 'product_name', 'item_name'].includes(key))
                    return;
                let rawValue = getValue(item, field.key);
                if (rawValue === undefined || rawValue === null || rawValue === '')
                    return;
                let displayValue = rawValue;
                if (Array.isArray(rawValue)) {
                    displayValue = rawValue.join(', ');
                }
                const valueStyle = getFinalStyle(field.key);
                html += `<div class="recsys-field-row">
          <span class="recsys-value" style="${valueStyle}">${displayValue}</span>
      </div>`;
            });
            html += `</div></div>`;
            return html;
        }
        // --- RENDER MAIN WIDGET ---
        // --- RENDER MAIN WIDGET ---
        renderWidget(container, items) {
            var _a, _b, _c;
            let shadow = container.shadowRoot;
            if (!shadow)
                shadow = container.attachShadow({ mode: 'open' });
            shadow.innerHTML = '';
            const style = document.createElement('style');
            style.textContent = this.getDynamicStyles();
            shadow.appendChild(style);
            const styleJson = this.config.styleJson || {};
            const layout = this.config.layoutJson || {};
            const contentMode = layout.contentMode || 'grid';
            // const title = layout.wrapper?.header?.title || 'Gợi ý cho bạn';
            const wrapper = document.createElement('div');
            wrapper.className = 'recsys-wrapper';
            // // Header
            // const headerHTML = `
            //   <div class="recsys-header">
            //     <span class="recsys-header-title">${title}</span>
            //   </div>
            // `;
            // [FIX] Tách biệt logic render để tránh ghi đè innerHTML
            if (contentMode === 'carousel') {
                const modeConfig = ((_a = layout.modes) === null || _a === void 0 ? void 0 : _a.carousel) || {};
                const gap = ((_c = (_b = styleJson === null || styleJson === void 0 ? void 0 : styleJson.tokens) === null || _b === void 0 ? void 0 : _b.spacingScale) === null || _c === void 0 ? void 0 : _c[modeConfig.gap || 'md']) || 16;
                // Render cấu trúc Carousel
                // wrapper.innerHTML = headerHTML + `
                //   <div style="position: relative; width: 100%; max-width: 100%;">
                //     <button class="recsys-nav recsys-prev">‹</button>
                //     <div class="recsys-container" style="display: flex; overflow: hidden; width: 100%; gap: ${gap}px;"></div>
                //     <button class="recsys-nav recsys-next">›</button>
                //   </div>`;
                wrapper.innerHTML = `
        <div style="position: relative; width: 100%; max-width: 100%;">
          <button class="recsys-nav recsys-prev">‹</button>
          
          <div class="recsys-container" style="display: flex; overflow: hidden; width: 100%; gap: ${gap}px;"></div>
          
          <button class="recsys-nav recsys-next">›</button>
        </div>`;
                shadow.appendChild(wrapper);
                this.setupCarousel(shadow, items); // Khởi tạo logic carousel
            }
            else {
                // Render cấu trúc Grid/List
                // wrapper.innerHTML = headerHTML + `<div class="recsys-container"></div>`;
                wrapper.innerHTML = `<div class="recsys-container"></div>`;
                shadow.appendChild(wrapper);
                this.renderStaticItems(shadow, items);
            }
        }
        renderStaticItems(shadow, items) {
            const container = shadow.querySelector('.recsys-container');
            if (!container)
                return;
            container.innerHTML = '';
            items.forEach((item, index) => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.renderItemContent(item);
                const itemElement = tempDiv.firstElementChild;
                if (itemElement) {
                    itemElement.addEventListener('click', () => {
                        const targetId = item.DomainItemId;
                        const rank = index + 1;
                        this.handleItemClick(targetId, rank);
                    });
                    container.appendChild(itemElement);
                }
            });
        }
        // --- CAROUSEL LOGIC ---
        setupCarousel(shadow, items) {
            var _a, _b, _c;
            // Lấy số lượng item cần hiện từ config (mặc định 5 nếu không có)
            const layout = this.config.layoutJson || {};
            const modeConfig = ((_a = layout.modes) === null || _a === void 0 ? void 0 : _a.carousel) || {};
            const itemsPerView = modeConfig.itemsPerView || modeConfig.columns || 5;
            let currentIndex = 0;
            const slideContainer = shadow.querySelector('.recsys-container');
            if (!slideContainer)
                return;
            const renderSlide = () => {
                slideContainer.innerHTML = '';
                for (let i = 0; i < itemsPerView; i++) {
                    const index = (currentIndex + i) % items.length;
                    const item = items[index];
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = this.renderItemContent(item);
                    const itemElement = tempDiv.firstElementChild;
                    if (itemElement) {
                        itemElement.addEventListener('click', () => {
                            const targetId = item.DomainItemId;
                            if (targetId) {
                                const rank = index + 1;
                                this.handleItemClick(targetId, rank);
                            }
                        });
                        slideContainer.appendChild(itemElement);
                    }
                }
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
                if (this.autoSlideTimeout)
                    clearTimeout(this.autoSlideTimeout);
                this.autoSlideTimeout = setTimeout(next, this.DEFAULT_DELAY);
            };
            (_b = shadow.querySelector('.recsys-prev')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', prev);
            (_c = shadow.querySelector('.recsys-next')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', next);
            renderSlide();
            resetAutoSlide();
        }
        async handleItemClick(id, rank) {
            if (!id)
                return;
            // Send evaluation request
            try {
                const evaluationUrl = `${this.apiBaseUrl}/evaluation`;
                await fetch(evaluationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        DomainKey: this.domainKey,
                        Rank: rank
                    })
                });
            }
            catch (error) {
                // console.error('[InlineDisplay] Failed to send evaluation:', error);
            }
            let urlPattern = this.config.layoutJson.itemUrlPattern || '/song/{:id}';
            const targetUrl = urlPattern.replace('{:id}', id.toString());
            // Try SPA-style navigation first
            try {
                // 1. Update URL without reload
                window.history.pushState({}, '', targetUrl);
                // 2. Dispatch events to notify SPA frameworks
                window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
                // 3. Custom event for frameworks that listen to custom routing events
                window.dispatchEvent(new CustomEvent('navigate', {
                    detail: { path: targetUrl, from: 'recsys-tracker' }
                }));
                // 4. Trigger link click event (some frameworks listen to this)
                // const clickEvent = new MouseEvent('click', {
                //   bubbles: true,
                //   cancelable: true,
                //   view: window
                // });
                // If navigation didn't work (URL changed but page didn't update), fallback
                // Check after a short delay if the page updated
                setTimeout(() => {
                    // If window.location.pathname is different from targetUrl, means framework didn't handle it
                    // So we need to force reload
                    if (window.location.pathname !== targetUrl) {
                        window.location.href = targetUrl;
                    }
                }, 100);
            }
            catch (error) {
                // Fallback to traditional navigation if History API fails
                window.location.href = targetUrl;
            }
        }
    }

    const ANON_USER_ID_KEY = 'recsys_anon_id';
    class DisplayManager {
        constructor(domainKey, apiBaseUrl) {
            this.popupDisplays = new Map();
            this.inlineDisplays = new Map();
            this.cachedRecommendations = null;
            this.fetchPromise = null;
            this.refreshTimer = null;
            this.isUserAction = false;
            this.lastActionType = null;
            this.domainKey = domainKey;
            this.apiBaseUrl = apiBaseUrl;
            this.recommendationFetcher = new RecommendationFetcher(domainKey, apiBaseUrl);
        }
        // Khởi tạo display methods dựa trên danh sách config
        async initialize(returnMethods) {
            this.destroy();
            if (!returnMethods || !Array.isArray(returnMethods) || returnMethods.length === 0) {
                return;
            }
            // // Fetch recommendations once for all display methods
            // try {
            //   await this.fetchRecommendationsOnce();
            // } catch (error) {
            //   // ////console.error('[DisplayManager] Failed to fetch recommendations.');
            // }
            // Don't await here to avoid blocking display initialization, each display will fetch when ready
            // Process each return method
            for (const method of returnMethods) {
                this.activateDisplayMethod(method);
            }
        }
        notifyActionTriggered(actionType) {
            this.isUserAction = true;
            this.lastActionType = actionType || null;
            if (this.refreshTimer)
                clearTimeout(this.refreshTimer);
            //console.log('[DisplayManager] Action type: ', actionType);
            // Chống spam API bằng Debounce (đợi 500ms sau hành động cuối cùng)
            this.refreshTimer = setTimeout(async () => {
                await this.refreshAllDisplays();
                this.isUserAction = false;
                this.lastActionType = null;
            }, 1000);
        }
        async refreshAllDisplays() {
            this.recommendationFetcher.clearCache();
            const newItems = await this.getRecommendations(50);
            this.cachedRecommendations = newItems;
            // Update shared cache in sessionStorage
            const sharedCacheKey = `recsys-cache-${this.domainKey}`;
            try {
                sessionStorage.setItem(sharedCacheKey, JSON.stringify({
                    data: newItems,
                    timestamp: Date.now()
                }));
            }
            catch (e) {
                // Quota exceeded or sessionStorage not available, silently fail
            }
            this.popupDisplays.forEach(popup => {
                var _a, _b, _c, _d;
                (_b = (_a = popup).updateContent) === null || _b === void 0 ? void 0 : _b.call(_a, newItems, this.isUserAction, this.lastActionType);
                (_d = (_c = popup).forceShow) === null || _d === void 0 ? void 0 : _d.call(_c, this.isUserAction, this.lastActionType);
            });
            this.inlineDisplays.forEach(inline => { var _a, _b; return (_b = (_a = inline).updateContent) === null || _b === void 0 ? void 0 : _b.call(_a, newItems); });
        }
        // Phân loại và kích hoạt display method tương ứng
        activateDisplayMethod(method) {
            var _a;
            const { ReturnType, ConfigurationName, Value, OperatorId } = method;
            // Chuẩn bị cấu hình chung (Giao diện, Style, Fields)
            const commonConfig = {
                layoutJson: method.LayoutJson,
                styleJson: method.StyleJson,
                customizingFields: method.CustomizingFields
            };
            // Kiểm tra loại hiển thị (Lưu ý: Backend thường trả về chữ hoa)
            const type = ReturnType === null || ReturnType === void 0 ? void 0 : ReturnType.toUpperCase();
            if (type === 'POPUP') {
                const duration = ((_a = method.DelayDuration) !== null && _a !== void 0 ? _a : 0) * 1000;
                const popupConfig = {
                    ...commonConfig,
                    delay: duration,
                    autoCloseDelay: 0,
                    triggerConfig: {
                        targetValue: Value,
                        operatorId: OperatorId
                    }
                };
                this.initializePopup(ConfigurationName, popupConfig);
            }
            else if (type === 'INLINE-INJECTION' || type === 'INLINE_INJECTION') {
                const inlineConfig = {
                    ...commonConfig,
                    selector: Value
                };
                this.initializeInline(ConfigurationName, inlineConfig);
            }
        }
        initializePopup(key, config) {
            var _a;
            try {
                if (this.popupDisplays.has(key)) {
                    (_a = this.popupDisplays.get(key)) === null || _a === void 0 ? void 0 : _a.stop();
                    this.popupDisplays.delete(key);
                }
                const popupDisplay = new PopupDisplay(this.domainKey, key, this.apiBaseUrl, config, async (limit) => {
                    // Use cached recommendations from init if available
                    if (this.cachedRecommendations) {
                        return this.cachedRecommendations;
                    }
                    // Otherwise fetch new data
                    return this.getRecommendations(limit);
                });
                this.popupDisplays.set(key, popupDisplay);
                popupDisplay.start();
            }
            catch (error) {
                // ////console.error('[DisplayManager] Error initializing popup:', error);
            }
        }
        // Khởi tạo Inline Display với Config đầy đủ
        initializeInline(key, config) {
            var _a;
            try {
                if (this.inlineDisplays.has(key)) {
                    (_a = this.inlineDisplays.get(key)) === null || _a === void 0 ? void 0 : _a.stop();
                    this.inlineDisplays.delete(key);
                }
                if (!config.selector)
                    return;
                const inlineDisplay = new InlineDisplay(this.domainKey, key, config.selector, this.apiBaseUrl, config, // Truyền object config
                async () => {
                    // Use cached recommendations from init if available
                    if (this.cachedRecommendations) {
                        return this.cachedRecommendations;
                    }
                    // Otherwise fetch new data
                    return this.getRecommendations(50);
                });
                this.inlineDisplays.set(key, inlineDisplay);
                inlineDisplay.start();
            }
            catch (error) {
                // ////console.error('[DisplayManager] Error initializing inline:', error);
            }
        }
        // --- LOGIC FETCH RECOMMENDATION (GIỮ NGUYÊN) ---
        async fetchRecommendationsOnce(limit = 50) {
            if (this.cachedRecommendations)
                return this.cachedRecommendations;
            if (this.fetchPromise)
                return this.fetchPromise;
            this.fetchPromise = this.fetchRecommendationsInternal(limit);
            try {
                this.cachedRecommendations = await this.fetchPromise;
                return this.cachedRecommendations;
            }
            finally {
                this.fetchPromise = null;
            }
        }
        async fetchRecommendationsInternal(limit) {
            try {
                const anonymousId = this.getAnonymousId();
                if (!anonymousId)
                    return { item: [], keyword: '', lastItem: '' };
                // Chỉ fetch 1 lần, không enable autoRefresh ở đây để tránh vòng lặp
                const response = await this.recommendationFetcher.fetchRecommendations(anonymousId, 'AnonymousId', {
                    numberItems: limit,
                    autoRefresh: false
                });
                return response;
            }
            catch (error) {
                return { item: [], keyword: '', lastItem: '' };
            }
        }
        getAnonymousId() {
            try {
                return localStorage.getItem(ANON_USER_ID_KEY) || null;
            }
            catch {
                return null;
            }
        }
        async getRecommendations(limit = 50) {
            if (limit) {
                return this.fetchRecommendationsInternal(limit);
            }
            return this.fetchRecommendationsOnce();
        }
        destroy() {
            this.popupDisplays.forEach(popup => popup.stop());
            this.popupDisplays.clear();
            this.inlineDisplays.forEach(inline => inline.stop());
            this.inlineDisplays.clear();
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
            }, `${this.name}.stop`);
        }
        destroy() {
            this.errorBoundary.execute(() => {
                this.stop();
                this.tracker = null;
            }, `${this.name}.destroy`);
        }
        isActive() {
            return this.active;
        }
        ensureInitialized() {
            if (!this.tracker) {
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
        resolvePayloadIdentity(extractedData, rule) {
            // Default values
            let userField = 'UserId';
            let userValue = '';
            let itemField = 'ItemId';
            let itemValue = '';
            let value = '';
            // If rule is provided, use its mappings to determine fields
            if (rule && rule.payloadMappings && Array.isArray(rule.payloadMappings)) {
                for (const mapping of rule.payloadMappings) {
                    const fieldName = mapping.Field || mapping.field; // Handle potential case differences
                    const fieldValue = extractedData[fieldName];
                    // Check for User fields
                    if (fieldName && ['UserId', 'Username', 'AnonymousId'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                        userField = fieldName;
                        userValue = fieldValue || '';
                    }
                    // Check for Item fields
                    if (fieldName && ['ItemId', 'ItemTitle'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                        itemField = fieldName;
                        itemValue = fieldValue || '';
                    }
                    // Check for Value field
                    if (fieldName && ['Value'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
                        value = fieldValue || '';
                    }
                }
            }
            else {
                // Fallback if no rule provided
                // Common user field patterns (prioritized)
                const userFieldPatterns = ['UserId', 'Username'];
                // Common item field patterns (prioritized)
                const itemFieldPatterns = ['ItemId', 'ItemTitle'];
                // Common rating/review_value patterns (prioritized)
                const valuePatterns = ['Value'];
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
                        value = extractedData[key];
                    }
                    if (userValue && itemValue && value)
                        break;
                }
            }
            return { userField, userValue, itemField, itemValue, value };
        }
        /**
         * NEW: Track directly with pre-collected payload from startCollection
         * Used after async data collection is complete
         */
        trackWithPayload(collectedData, rule, eventId) {
            if (!this.tracker) {
                return;
            }
            // Get values from collectedData
            const userId = collectedData.UserId || collectedData.Username || undefined;
            const itemId = collectedData.ItemId || collectedData.ItemTitle || undefined;
            const value = collectedData.Value || '';
            // Construct payload
            const payload = {
                eventTypeId: Number(eventId),
                actionType: rule.actionType || null,
                trackingRuleId: Number(rule.id),
                userId,
                itemId,
                ratingValue: eventId === 2 ? Number(value) : undefined,
                ratingReview: eventId === 3 ? value : undefined,
            };
            // Track the event
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
                    return false;
                }
                plugin.destroy();
                this.plugins.delete(pluginName);
                return true;
            }, 'PluginManager.unregister')) !== null && _a !== void 0 ? _a : false;
        }
        // Start a specific plugin
        start(pluginName) {
            var _a;
            return (_a = this.errorBoundary.execute(() => {
                const plugin = this.plugins.get(pluginName);
                if (!plugin) {
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
                    return false;
                }
                plugin.stop();
                return true;
            }, 'PluginManager.stop')) !== null && _a !== void 0 ? _a : false;
        }
        // Start all registered plugins
        startAll() {
            this.errorBoundary.execute(() => {
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
                this.plugins.forEach((plugin) => {
                    plugin.destroy();
                });
                this.plugins.clear();
            }, 'PluginManager.destroy');
        }
    }

    /**
     * ClickPlugin - UI Trigger Layer
     *
     * TRÁCH NHIỆM:
     * 1. Phát hiện hành vi click
     * 2. Match với tracking rules
     * 3. Gọi PayloadBuilder.handleTrigger()
     * 4. KHÔNG lấy payload, KHÔNG bắt network
     *
     * FLOW:
     * click event → check rules → handleTrigger → DONE
     */
    class ClickPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ClickPlugin';
            this.handleClickBound = this.handleClick.bind(this);
            this.lastClickTimestamp = new Map(); // Track last click time per element
            this.debounceTime = 300; // 300ms debounce
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                // //console.log('[ClickPlugin] Initialized');
            }, 'ClickPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (this.active) {
                    ////console.warn('[ClickPlugin] Already active, skipping duplicate start');
                    return;
                }
                document.addEventListener('click', this.handleClickBound, true);
                this.active = true;
                ////console.log('[ClickPlugin] ✅ Started and listening for clicks');
            }, 'ClickPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                if (this.tracker) {
                    document.removeEventListener('click', this.handleClickBound, true);
                }
                super.stop();
            }, 'ClickPlugin.stop');
        }
        /**
         * Handle click event - TRIGGER PHASE
         */
        handleClick(event) {
            var _a;
            ////console.log('[ClickPlugin] Click detected on:', event.target);
            if (!this.tracker)
                return;
            const clickedElement = event.target;
            if (!clickedElement)
                return;
            // Get click rules
            const eventId = this.tracker.getEventTypeId('Click') || 1;
            const config = this.tracker.getConfig();
            const clickRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
            if (clickRules.length === 0)
                return;
            // Check each rule
            for (const rule of clickRules) {
                const matchedElement = this.findMatchingElement(clickedElement, rule);
                if (!matchedElement) {
                    continue;
                }
                ////console.log('[ClickPlugin] Matched element for rule:', rule.name, matchedElement);
                // Debounce: Bỏ qua clicks liên tiếp trên cùng element trong thời gian ngắn
                const elementKey = this.getElementKey(matchedElement, rule.id);
                const now = Date.now();
                const lastClick = this.lastClickTimestamp.get(elementKey);
                if (lastClick && (now - lastClick) < this.debounceTime) {
                    ////console.log('[ClickPlugin] Debounced - ignoring rapid click on', elementKey);
                    return;
                }
                this.lastClickTimestamp.set(elementKey, now);
                // Create trigger context
                const triggerContext = {
                    element: matchedElement,
                    target: matchedElement,
                    clickedElement: clickedElement,
                    eventType: 'click',
                    event: event
                };
                // Delegate to PayloadBuilder
                this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                    // Callback khi payload ready
                    this.dispatchEvent(payload, rule, eventId);
                });
                // Chỉ track rule đầu tiên match
                return;
            }
        }
        // Generate unique key cho mỗi element + rule combination
        getElementKey(element, ruleId) {
            var _a;
            // Sử dụng data attributes hoặc textContent để identify element
            const itemId = element.getAttribute('data-item-id') ||
                element.getAttribute('data-id') ||
                ((_a = element.textContent) === null || _a === void 0 ? void 0 : _a.substring(0, 20)) ||
                '';
            return `${ruleId}:${itemId}`;
        }
        /**
         * Find element matching rule selector
         */
        findMatchingElement(clickedElement, rule) {
            const selector = rule.trackingTarget;
            if (!selector)
                return null;
            try {
                // Strategy 1: Strict match (element itself)
                if (clickedElement.matches(selector)) {
                    return clickedElement;
                }
                // Strategy 2: Flexible class match (for CSS modules)
                if (selector.startsWith('.')) {
                    const className = selector.substring(1);
                    if (this.hasFlexibleClassMatch(clickedElement, className)) {
                        return clickedElement;
                    }
                }
                // Strategy 3: Closest match (parent traversal)
                // Only if clicked element is NOT interactive (avoid false positives)
                const isInteractive = this.isInteractiveElement(clickedElement);
                if (!isInteractive) {
                    const closestMatch = clickedElement.closest(selector);
                    if (closestMatch) {
                        return closestMatch;
                    }
                    // Flexible class match on parents
                    if (selector.startsWith('.')) {
                        const className = selector.substring(1);
                        const flexibleParent = this.findParentWithFlexibleClass(clickedElement, className);
                        if (flexibleParent) {
                            return flexibleParent;
                        }
                    }
                }
                return null;
            }
            catch (e) {
                return null;
            }
        }
        /**
         * Check if element has flexible class match (for CSS modules)
         */
        hasFlexibleClassMatch(element, baseClassName) {
            const actualClassName = element.className;
            if (typeof actualClassName !== 'string')
                return false;
            // Extract base name (remove hash for CSS modules)
            const baseName = baseClassName.split('_')[0];
            return actualClassName.includes(baseName);
        }
        /**
         * Find parent with flexible class match
         */
        findParentWithFlexibleClass(element, baseClassName) {
            const baseName = baseClassName.split('_')[0];
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
                const className = parent.className;
                if (typeof className === 'string' && className.includes(baseName)) {
                    return parent;
                }
                parent = parent.parentElement;
                depth++;
            }
            return null;
        }
        /**
         * Check if element is interactive (button, link, etc.)
         */
        isInteractiveElement(element) {
            const tagName = element.tagName;
            if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tagName)) {
                return true;
            }
            const role = element.getAttribute('role');
            if (role && ['button', 'link', 'menuitem'].includes(role)) {
                return true;
            }
            return false;
        }
        /**
         * Dispatch tracking event
         */
        dispatchEvent(payload, rule, eventId) {
            if (!this.tracker)
                return;
            //console.log('[ClickPlugin] Dispatching event with payload:', payload);
            //console.log('[ClickPlugin] Action type:', rule.actionType);
            this.tracker.track({
                eventType: eventId,
                eventData: {
                    ...payload,
                    actionType: rule.actionType || null
                },
                timestamp: Date.now(),
                url: window.location.href,
                metadata: {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    plugin: this.name
                }
            });
        }
    }

    /**
     * ReviewPlugin - UI Trigger Layer
     *
     * TRÁCH NHIỆM:
     * 1. Phát hiện hành vi review (form submit)
     * 2. Match với tracking rules
     * 3. Gọi PayloadBuilder.handleTrigger()
     * 4. KHÔNG lấy payload, KHÔNG bắt network
     *
     * FLOW:
     * submit event → check rules → handleTrigger → DONE
     */
    class ReviewPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'ReviewPlugin';
            this.handleClickBound = this.handleClick.bind(this);
            this.handleSubmitBound = this.handleSubmit.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                // console.log('[ReviewPlugin] Initialized');
            }, 'ReviewPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (this.active) {
                    //console.warn('[ReviewPlugin] Already active, skipping duplicate start');
                    return;
                }
                // Listen for both click and submit events
                document.addEventListener('click', this.handleClickBound, true);
                document.addEventListener('submit', this.handleSubmitBound, true);
                this.active = true;
                //console.log('[ReviewPlugin] Started');
            }, 'ReviewPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                if (this.tracker) {
                    document.removeEventListener('click', this.handleClickBound, true);
                    document.removeEventListener('submit', this.handleSubmitBound, true);
                }
                super.stop();
            }, 'ReviewPlugin.stop');
        }
        /**
         * Handle click event (button clicks)
         */
        handleClick(event) {
            this.handleInteraction(event, 'click');
        }
        /**
         * Handle submit event (form submits)
         */
        handleSubmit(event) {
            this.handleInteraction(event, 'submit');
        }
        /**
         * Main interaction handler - TRIGGER PHASE
         * NOTE: This processes review-specific rules only (eventTypeId = 3)
         */
        handleInteraction(event, _eventType) {
            var _a;
            if (!this.tracker)
                return;
            const target = event.target;
            if (!target)
                return;
            // Get review rules
            const eventId = this.tracker.getEventTypeId('Review') || 3;
            const config = this.tracker.getConfig();
            const reviewRules = ((_a = config === null || config === void 0 ? void 0 : config.trackingRules) === null || _a === void 0 ? void 0 : _a.filter(r => r.eventTypeId === eventId)) || [];
            if (reviewRules.length === 0)
                return;
            // Check each rule
            for (const rule of reviewRules) {
                // Try to find matching element (form or button)
                const matchedElement = this.findMatchingElement(target, rule);
                if (!matchedElement) {
                    continue;
                }
                // Find container (form or parent)
                const container = this.findContainer(matchedElement);
                // Auto-detect review content from container
                const reviewContent = this.autoDetectReviewContent(container);
                // Filter if no review content
                if (!reviewContent) {
                    continue;
                }
                // Create trigger context
                const triggerContext = {
                    element: matchedElement,
                    target: matchedElement,
                    container: container,
                    eventType: 'review',
                    reviewContent: reviewContent,
                    Value: reviewContent
                };
                // Delegate to PayloadBuilder
                this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                    // Enrich with review content
                    const enrichedPayload = {
                        ...payload,
                        Value: reviewContent
                    };
                    // Callback khi payload ready
                    this.dispatchEvent(enrichedPayload, rule, eventId);
                });
                // Track all matching rules (không return)
            }
        }
        /**
         * Find element matching rule selector
         */
        findMatchingElement(target, rule) {
            const selector = rule.trackingTarget;
            if (!selector)
                return null;
            try {
                // Try closest match
                let match = target.closest(selector);
                // Flexible matching for CSS modules
                if (!match && selector.startsWith('.')) {
                    const baseClassName = selector.substring(1).split('_')[0];
                    let parent = target;
                    let depth = 0;
                    while (parent && depth < 10) {
                        const className = parent.className;
                        if (typeof className === 'string' && className.includes(baseClassName)) {
                            match = parent;
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                }
                return match;
            }
            catch (e) {
                return null;
            }
        }
        /**
         * Find container (form or parent element)
         */
        findContainer(element) {
            // Try to find form
            const form = element.closest('form');
            if (form)
                return form;
            // Try to find review container
            const container = element.closest('.review-container') ||
                element.closest('.review-box') ||
                element.closest('[data-review]');
            if (container)
                return container;
            // Fallback to parent or body
            return element.parentElement || document.body;
        }
        /**
         * Auto-detect review content from container
         */
        autoDetectReviewContent(container) {
            var _a, _b;
            // Strategy 1: textarea với name/id có 'review', 'comment', 'content'
            const textareas = Array.from(container.querySelectorAll('textarea'));
            for (const textarea of textareas) {
                const name = ((_a = textarea.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
                const id = ((_b = textarea.id) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || '';
                if (name.includes('review') || name.includes('comment') || name.includes('content') ||
                    id.includes('review') || id.includes('comment') || id.includes('content')) {
                    const value = textarea.value.trim();
                    if (value)
                        return value;
                }
            }
            // Strategy 2: textarea lớn nhất
            let largestTextarea = null;
            let maxLength = 0;
            for (const textarea of textareas) {
                const value = textarea.value.trim();
                if (value.length > maxLength) {
                    maxLength = value.length;
                    largestTextarea = textarea;
                }
            }
            if (largestTextarea) {
                return largestTextarea.value.trim();
            }
            // Strategy 3: input[type="text"] lớn
            const textInputs = Array.from(container.querySelectorAll('input[type="text"]'));
            for (const input of textInputs) {
                const value = input.value.trim();
                if (value.length > 20) { // Assume review > 20 chars
                    return value;
                }
            }
            return '';
        }
        /**
         * Dispatch tracking event
         */
        dispatchEvent(payload, rule, eventId) {
            if (!this.tracker)
                return;
            this.tracker.track({
                eventType: eventId,
                eventData: {
                    ...payload,
                    actionType: rule.actionType || null
                },
                timestamp: Date.now(),
                url: window.location.href,
                metadata: {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    plugin: this.name
                }
            });
        }
    }

    const STORAGE_KEYS = {
        ANON_USER_ID: 'recsys_anon_id',
        USER_ID: 'recsys_user_id',
        SESSION_ID: 'recsys_session',
        IDENTIFIERS: 'recsys_identifiers',
        LAST_USER_ID: 'recsys_last_user_id',
        CACHED_USER_INFO: 'recsys_cached_user_info' // Lưu user info đã bắt được
    };
    /**
     * Lưu user info vào localStorage khi bắt được từ rule
     * @param userField - UserId hoặc Username
     * @param userValue - Giá trị user đã bắt được
     */
    function saveCachedUserInfo(userField, userValue) {
        // Chỉ lưu nếu userValue valid (không phải AnonymousId, guest, empty)
        if (!userValue ||
            userValue === 'guest' ||
            userValue.startsWith('anon_') ||
            userField === 'AnonymousId') {
            return;
        }
        try {
            const cachedInfo = {
                userField,
                userValue,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEYS.CACHED_USER_INFO, JSON.stringify(cachedInfo));
        }
        catch (error) {
            // log('Failed to save cached user info:', error);
        }
    }
    /**
     * Lấy cached user info từ localStorage
     * @returns CachedUserInfo hoặc null nếu không có
     */
    function getCachedUserInfo() {
        try {
            const cached = localStorage.getItem(STORAGE_KEYS.CACHED_USER_INFO);
            if (!cached) {
                return null;
            }
            const userInfo = JSON.parse(cached);
            // Validate cached data
            if (userInfo.userField && userInfo.userValue && userInfo.timestamp) {
                return userInfo;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Khởi tạo và lấy Anonymous ID từ localStorage
     * Tự động tạo mới nếu chưa tồn tại
     */
    function getOrCreateAnonymousId() {
        try {
            let anonId = localStorage.getItem(STORAGE_KEYS.ANON_USER_ID);
            if (!anonId) {
                // Generate new anonymous ID: anon_timestamp_randomstring
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 10);
                anonId = `anon_${timestamp}_${randomStr}`;
                localStorage.setItem(STORAGE_KEYS.ANON_USER_ID, anonId);
            }
            else {
                // console.log('[plugin-utils] Using existing anonymous ID:', anonId);
            }
            return anonId;
        }
        catch (error) {
            // Fallback nếu localStorage không available
            const fallbackId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            return fallbackId;
        }
    }

    class SearchKeywordPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'SearchKeywordPlugin';
            this.inputElements = new Map();
            this.mutationObserver = null;
            this.searchKeywordConfigs = [];
            this.reattachDebounceTimer = null;
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
            }, 'SearchKeywordPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                const config = this.tracker.getConfig();
                const searchKeywordConfigs = config === null || config === void 0 ? void 0 : config.searchKeywordConfigs;
                if (!searchKeywordConfigs || searchKeywordConfigs.length === 0) {
                    //console.log('[SearchKeywordPlugin] No search keyword configs found');
                    return;
                }
                //console.log('[SearchKeywordPlugin] Starting with configs:', searchKeywordConfigs);
                // Lưu configs để dùng lại khi DOM thay đổi
                this.searchKeywordConfigs = searchKeywordConfigs;
                // Attach listeners cho tất cả configs
                searchKeywordConfigs.forEach(skConfig => {
                    this.attachListeners(skConfig);
                });
                // Setup MutationObserver để theo dõi DOM changes
                this.setupMutationObserver();
                this.active = true;
            }, 'SearchKeywordPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                this.removeListeners();
                // Disconnect MutationObserver
                if (this.mutationObserver) {
                    this.mutationObserver.disconnect();
                    this.mutationObserver = null;
                }
                // Clear debounce timer
                if (this.reattachDebounceTimer) {
                    clearTimeout(this.reattachDebounceTimer);
                    this.reattachDebounceTimer = null;
                }
                super.stop();
            }, 'SearchKeywordPlugin.stop');
        }
        /**
         * Attach event listeners to input element
         */
        attachListeners(config, retryCount = 0) {
            // Tìm input element
            const inputElement = this.findInputElement(config.InputSelector);
            if (!inputElement) {
                const maxRetries = 5; // Tăng số lần retry lên 5
                if (retryCount < maxRetries) {
                    const delay = 1000 * (retryCount + 1); // Tăng dần delay: 1s, 2s, 3s, 4s, 5s
                    //console.log(`[SearchKeywordPlugin] Input element not found for selector: ${config.InputSelector}, retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
                    setTimeout(() => {
                        this.attachListeners(config, retryCount + 1);
                    }, delay);
                }
                return;
            }
            //console.log('[SearchKeywordPlugin] Input element found for selector:', config.InputSelector);
            this.addEventListeners(inputElement, config);
        }
        /**
         * Find input element with fallback strategies
         * 1. Direct querySelector
         * 2. Find element with class containing selector, then find input inside
         * 3. Find element with class containing selector, check if it's an input
         */
        findInputElement(selector) {
            // Strategy 1: Direct querySelector
            let element = document.querySelector(selector);
            if (element) {
                return element;
            }
            // Strategy 2 & 3: Contains match for class names
            // Remove leading dot if present (e.g., ".search-bar" -> "search-bar")
            const cleanSelector = selector.startsWith('.') ? selector.slice(1) : selector;
            // Find all elements with class containing the selector
            const allElements = Array.from(document.querySelectorAll('[class]'));
            for (const el of allElements) {
                const classList = el.className;
                if (typeof classList === 'string' && classList.includes(cleanSelector)) {
                    // Check if this element itself is an input
                    if (el.tagName === 'INPUT') {
                        return el;
                    }
                    // Try to find input inside this element
                    const inputInside = el.querySelector('input');
                    if (inputInside) {
                        return inputInside;
                    }
                }
            }
            return null;
        }
        /**
         * Add event listeners to input element
         */
        addEventListeners(element, config) {
            // Tạo unique key cho mỗi config
            const key = `${config.Id}_${config.InputSelector}`;
            // Nếu đã tồn tại, remove listener cũ trước
            if (this.inputElements.has(key)) {
                //console.log('[SearchKeywordPlugin] Removing old listener for:', key);
                this.removeListener(key);
            }
            // Tạo bound handler riêng cho từng input
            const handleKeyPress = (event) => {
                this.handleKeyPress(event);
            };
            // Listen for keypress events (khi user nhấn Enter)
            element.addEventListener('keypress', handleKeyPress);
            //console.log('[SearchKeywordPlugin] Event listener attached for:', key);
            // Lưu vào map
            this.inputElements.set(key, {
                element,
                config,
                handleKeyPress
            });
        }
        /**
         * Remove event listeners
         */
        removeListeners() {
            this.inputElements.forEach((_, key) => {
                this.removeListener(key);
            });
            this.inputElements.clear();
        }
        /**
         * Remove listener cho một config cụ thể
         */
        removeListener(key) {
            const data = this.inputElements.get(key);
            if (data) {
                data.element.removeEventListener('keypress', data.handleKeyPress);
                this.inputElements.delete(key);
            }
        }
        /**
         * Handle keypress event - log khi user nhấn Enter (không debounce)
         */
        handleKeyPress(event) {
            if (event.key === 'Enter') {
                const target = event.target;
                const searchKeyword = target.value.trim();
                if (searchKeyword) {
                    //console.log('[SearchKeywordPlugin] Search keyword (Enter pressed):', searchKeyword);
                    // Trigger push keyword API ngay lập tức
                    this.triggerPushKeyword(searchKeyword);
                }
            }
        }
        /**
         * Trigger push keyword API (được gọi khi nhấn Enter hoặc từ DisplayManager)
         */
        async triggerPushKeyword(keyword) {
            if (!this.tracker)
                return;
            const config = this.tracker.getConfig();
            if (!config)
                return;
            const cached = getCachedUserInfo();
            const userId = cached && cached.userValue ? cached.userValue : null;
            const anonymousId = getOrCreateAnonymousId();
            // const userId = userInfo ? userInfo.value : null;
            // console.log('[SearchKeywordPlugin] Triggering push keyword:', {
            //   userId,
            //   anonymousId,
            //   domainKey: config.domainKey,
            //   keyword
            // });
            await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
            // const userId = userInfo.value || '';
            // const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();
            // await this.pushKeywordToServer(userId, anonymousId, config.domainKey, keyword);
        }
        /**
         * Setup MutationObserver để theo dõi DOM changes
         * Re-attach listeners khi DOM thay đổi (ví dụ: sau khi login, DOM có thể re-render)
         */
        setupMutationObserver() {
            // Cleanup existing observer
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }
            this.mutationObserver = new MutationObserver(() => {
                // Kiểm tra xem có input elements nào bị mất không
                let needsReattach = false;
                this.inputElements.forEach((data) => {
                    // Kiểm tra xem element còn trong DOM không
                    if (!document.body.contains(data.element)) {
                        //console.log('[SearchKeywordPlugin] Detected DOM change - element removed');
                        needsReattach = true;
                    }
                });
                // Nếu có element bị mất, debounce re-attach để chờ DOM settle
                if (needsReattach) {
                    // Clear timeout cũ nếu có
                    if (this.reattachDebounceTimer) {
                        clearTimeout(this.reattachDebounceTimer);
                    }
                    // Chờ 500ms để DOM render xong trước khi re-attach
                    this.reattachDebounceTimer = window.setTimeout(() => {
                        //console.log('[SearchKeywordPlugin] Re-attaching listeners due to DOM changes');
                        this.removeListeners();
                        this.searchKeywordConfigs.forEach(config => {
                            this.attachListeners(config);
                        });
                        this.reattachDebounceTimer = null;
                    }, 500);
                }
            });
            // Observe toàn bộ body để bắt mọi thay đổi DOM
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            //console.log('[SearchKeywordPlugin] MutationObserver setup complete');
        }
        /**
         * Call API POST recommendation/push-keyword
         */
        async pushKeywordToServer(userId, anonymousId, domainKey, keyword) {
            var _a, _b;
            // const baseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
            const baseUrl = "https://recsys-tracker-module.onrender.com";
            const url = `${baseUrl}/recommendation/push-keyword`;
            const payload = {
                UserId: userId,
                AnonymousId: anonymousId,
                DomainKey: domainKey,
                Keyword: keyword
            };
            try {
                //console.log('[SearchKeywordPlugin] MeomeoPushing keyword to server:', payload);
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    // console.log('[SearchKeywordPlugin] Keyword pushed successfully');
                    // Trigger recommendation refresh after successful keyword push
                    (_b = (_a = this.tracker) === null || _a === void 0 ? void 0 : _a.getDisplayManager()) === null || _b === void 0 ? void 0 : _b.notifyActionTriggered('search');
                }
                else {
                    // console.error('[SearchKeywordPlugin] Failed to push keyword:', response.statusText);
                }
            }
            catch (error) {
                // console.error('[SearchKeywordPlugin] Error pushing keyword:', error);
            }
        }
    }

    /**
     * RuleExecutionContext (REC)
     *
     * Đại diện cho MỘT LẦN TRIGGER CỤ THỂ của một rule.
     * Không phải là rule config, mà là instance của một lần thực thi.
     *
     * Nguyên tắc:
     * - Mỗi trigger (click, rating, review, etc.) tạo 1 REC riêng
     * - REC theo dõi trạng thái thu thập dữ liệu
     * - REC có TIME_WINDOW để match với network requests
     * - REC có MAX_WAIT_TIME để tự cleanup nếu không hoàn thành
     */
    /**
     * RuleExecutionContextManager
     * Quản lý tất cả các REC đang active
     */
    class RuleExecutionContextManager {
        constructor() {
            this.contexts = new Map();
            this.TIME_WINDOW = 3000; // 3s - Request phải xảy ra trong window này
            this.MAX_WAIT_TIME = 1000; // 1s - Tự động expire nếu quá thời gian (giảm từ 5s để UX tốt hơn)
        }
        /**
         * Tạo REC mới cho một trigger
         */
        createContext(ruleId, requiredFields, triggerContext, onComplete) {
            const executionId = this.generateExecutionId();
            const context = {
                executionId,
                ruleId,
                triggeredAt: Date.now(),
                status: 'pending',
                requiredFields: new Set(requiredFields),
                collectedFields: new Map(),
                triggerContext,
                onComplete
            };
            // Setup auto-cleanup
            context.timeoutHandle = setTimeout(() => {
                this.expireContext(executionId);
            }, this.MAX_WAIT_TIME);
            this.contexts.set(executionId, context);
            return context;
        }
        /**
         * Lấy context theo executionId
         */
        getContext(executionId) {
            return this.contexts.get(executionId);
        }
        /**
         * Lấy tất cả pending contexts cho một rule cụ thể
         */
        getPendingContextsForRule(ruleId) {
            const results = [];
            for (const context of this.contexts.values()) {
                if (context.ruleId === ruleId && context.status === 'pending') {
                    results.push(context);
                }
            }
            return results;
        }
        /**
         * Tìm context phù hợp cho một network request
         * Điều kiện:
         * - Status = pending
         * - RuleId match
         * - Request timestamp trong TIME_WINDOW
         */
        findMatchingContext(ruleId, requestTimestamp) {
            for (const context of this.contexts.values()) {
                if (context.ruleId === ruleId &&
                    context.status === 'pending' &&
                    requestTimestamp >= context.triggeredAt &&
                    requestTimestamp <= context.triggeredAt + this.TIME_WINDOW) {
                    return context;
                }
            }
            return undefined;
        }
        /**
         * Thay thế một required field bằng field khác
         * Dùng cho fallback UserId/Username -> AnonymousId
         */
        replaceRequiredField(executionId, oldField, newField) {
            const context = this.contexts.get(executionId);
            if (!context) {
                return;
            }
            if (context.status !== 'pending') {
                return;
            }
            if (context.requiredFields.has(oldField)) {
                context.requiredFields.delete(oldField);
                context.requiredFields.add(newField);
            }
        }
        /**
         * Thu thập một field vào context
         */
        collectField(executionId, field, value) {
            const context = this.contexts.get(executionId);
            if (!context) {
                return;
            }
            if (context.status !== 'pending') {
                return;
            }
            context.collectedFields.set(field, value);
            // Check nếu đã đủ dữ liệu
            this.checkCompletion(executionId);
        }
        /**
         * Kiểm tra nếu context đã thu thập đủ dữ liệu
         */
        checkCompletion(executionId) {
            const context = this.contexts.get(executionId);
            if (!context || context.status !== 'pending') {
                return;
            }
            // Check nếu tất cả required fields đã có
            const requiredFieldsArray = Array.from(context.requiredFields);
            const missingFields = requiredFieldsArray.filter(field => !context.collectedFields.has(field));
            const allFieldsCollected = missingFields.length === 0;
            if (allFieldsCollected) {
                this.completeContext(executionId);
            }
        }
        /**
         * Đánh dấu context là completed và trigger callback
         */
        completeContext(executionId) {
            const context = this.contexts.get(executionId);
            if (!context || context.status !== 'pending') {
                return;
            }
            context.status = 'completed';
            // Clear timeout
            if (context.timeoutHandle) {
                clearTimeout(context.timeoutHandle);
            }
            // Build payload từ collected fields
            const payload = {};
            context.collectedFields.forEach((value, key) => {
                payload[key] = value;
            });
            // Trigger callback
            if (context.onComplete) {
                context.onComplete(payload);
            }
            // Cleanup sau 1s (giữ một chút để debug)
            setTimeout(() => {
                this.contexts.delete(executionId);
            }, 1000);
        }
        /**
         * Đánh dấu context là expired (timeout)
         * QUAN TRỌNG: Vẫn gọi callback với data đã có, kể cả khi không đủ required fields
         * Điều này đảm bảo event vẫn được gửi ngay cả khi user không đăng nhập
         */
        expireContext(executionId) {
            const context = this.contexts.get(executionId);
            if (!context || context.status !== 'pending') {
                return;
            }
            //console.log('[REC] Context expired, calling callback with collected data:', executionId);
            context.status = 'expired';
            // Build payload từ collected fields (dù có đủ hay không)
            const payload = {};
            context.collectedFields.forEach((value, key) => {
                payload[key] = value;
            });
            //console.log('[REC] Collected payload on timeout:', payload);
            // Trigger callback với data đã có
            if (context.onComplete) {
                context.onComplete(payload);
            }
            // Cleanup
            setTimeout(() => {
                this.contexts.delete(executionId);
            }, 1000);
        }
        /**
         * Cleanup một context (manual)
         */
        cleanupContext(executionId) {
            const context = this.contexts.get(executionId);
            if (context && context.timeoutHandle) {
                clearTimeout(context.timeoutHandle);
            }
            this.contexts.delete(executionId);
        }
        /**
         * Get số lượng active contexts (for debugging)
         */
        getActiveCount() {
            return Array.from(this.contexts.values()).filter(c => c.status === 'pending').length;
        }
        /**
         * Generate unique execution ID
         */
        generateExecutionId() {
            return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        /**
         * Clear all contexts (for testing/cleanup)
         */
        clearAll() {
            for (const context of this.contexts.values()) {
                if (context.timeoutHandle) {
                    clearTimeout(context.timeoutHandle);
                }
            }
            this.contexts.clear();
        }
    }

    class PathMatcher {
        /**
         * Parse pattern like '/api/user/:id' or '/api/cart/{itemId}' into regex and segment config
         * Supports flexible patterns:
         * - "/api/product/:id/details" or "/api/product/{id}/details"
         * - "api/product/:id/details" (without leading slash)
         * - "product/:id" (partial path)
         */
        static compile(pattern) {
            const keys = [];
            const cleanPattern = pattern.split('?')[0];
            // Escape generic regex chars except ':' and '{' and '}'
            const escaped = cleanPattern.replace(/[.+^$|()\\[\]]/g, '\\$&');
            // Replace :param or {param} with capture group
            // Regex explanation:
            // :([a-zA-Z0-9_]+)   -> matches :id
            // \{([a-zA-Z0-9_]+)\} -> matches {id}
            const regexString = escaped.replace(/:([a-zA-Z0-9_]+)|\{([a-zA-Z0-9_]+)\}/g, (_match, p1, p2) => {
                const key = p1 || p2;
                keys.push(key);
                return '([^/]+)';
            });
            // Match start to end, allow query params at end
            return {
                regex: new RegExp(`^${regexString}(?:\\?.*)?$`),
                keys
            };
        }
        /**
         * Match URL against pattern with flexible matching
         * Supports:
         * - Full path matching: "/api/product/:id/details" matches "/api/product/123/details"
         * - Partial path matching: "product/:id" matches "/api/product/123/details"
         * - Pattern with or without leading slash
         *
         * @param url - Full URL or path to match
         * @param pattern - Pattern to match against (can be partial)
         * @returns true if URL matches pattern
         */
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
            // Normalize pattern
            let effectivePattern = pattern.trim();
            // If pattern doesn't start with http or /, prepend /
            if (!effectivePattern.startsWith('http') && !effectivePattern.startsWith('/')) {
                effectivePattern = '/' + effectivePattern;
            }
            // Try exact match first
            const { regex } = PathMatcher.compile(effectivePattern);
            if (regex.test(path)) {
                return true;
            }
            // Try partial match - check if pattern segments exist in path
            // This allows "product/:id" to match "/api/product/123/details"
            return PathMatcher.matchPartialPath(path, effectivePattern);
        }
        /**
         * Match partial path segments
         * Example: "product/:id" matches "/api/product/123/details"
         */
        static matchPartialPath(path, pattern) {
            const pathSegments = path.split('/').filter(Boolean);
            const patternSegments = pattern.split('/').filter(Boolean);
            // Pattern must have at least one segment
            if (patternSegments.length === 0) {
                return false;
            }
            // Find if pattern segments exist as a subsequence in path
            let patternIdx = 0;
            let pathIdx = 0;
            while (pathIdx < pathSegments.length && patternIdx < patternSegments.length) {
                const patternSeg = patternSegments[patternIdx];
                const pathSeg = pathSegments[pathIdx];
                // Check if segment matches (literal or dynamic)
                if (this.segmentMatches(pathSeg, patternSeg)) {
                    patternIdx++;
                }
                pathIdx++;
            }
            // All pattern segments found in path
            return patternIdx === patternSegments.length;
        }
        /**
         * Check if a path segment matches a pattern segment
         * Pattern segment can be:
         * - Literal: "product" matches "product"
         * - Dynamic: ":id" or "{id}" matches any non-empty value
         */
        static segmentMatches(pathSegment, patternSegment) {
            // Dynamic segment - matches anything
            if (patternSegment.startsWith(':') ||
                (patternSegment.startsWith('{') && patternSegment.endsWith('}'))) {
                return pathSegment.length > 0;
            }
            // Literal segment - must match exactly
            return pathSegment === patternSegment;
        }
        /**
         * Extract dynamic values from URL based on pattern
         * Example: extractParams("/api/product/123/details", "/api/product/:id/details")
         * Returns: { id: "123" }
         */
        static extractParams(url, pattern) {
            let path = url.split('?')[0];
            try {
                if (path.startsWith('http')) {
                    const urlObj = new URL(path);
                    path = urlObj.pathname;
                }
            }
            catch { }
            if (!path.startsWith('/'))
                path = '/' + path;
            let effectivePattern = pattern.trim();
            if (!effectivePattern.startsWith('http') && !effectivePattern.startsWith('/')) {
                effectivePattern = '/' + effectivePattern;
            }
            const { regex, keys } = PathMatcher.compile(effectivePattern);
            const match = path.match(regex);
            if (!match) {
                return {};
            }
            const params = {};
            keys.forEach((key, index) => {
                params[key] = match[index + 1];
            });
            return params;
        }
        /**
         * Extract value by segment index from URL
         * @param url - URL to extract from
         * @param pattern - Pattern to match (must match first)
         * @param segmentIndex - 0-based index of segment to extract
         */
        static extractByIndex(url, pattern, segmentIndex) {
            if (!PathMatcher.match(url, pattern)) {
                return null;
            }
            let path = url.split('?')[0];
            try {
                if (path.startsWith('http')) {
                    const urlObj = new URL(path);
                    path = urlObj.pathname;
                }
            }
            catch { }
            const segments = path.split('/').filter(Boolean);
            return segments[segmentIndex] || null;
        }
        // Logic specifically from tracker.js (optional, but robust)
        static matchStaticSegments(url, pattern) {
            // tracker.js logic:
            // const segments = rule.apiUrl.split('/').filter(Boolean);
            // _staticSegments: segments.filter(seg => !seg.startsWith(':'))
            // return rule._staticSegments.every(seg => segments.includes(seg));
            const patternSegments = pattern.split('/').filter(Boolean);
            // Filter out dynamic segments (:param or {param})
            const staticSegments = patternSegments.filter(s => !s.startsWith(':') && !(s.startsWith('{') && s.endsWith('}')));
            const urlSegments = url.split('?')[0].split('/').filter(Boolean);
            return staticSegments.every(seg => urlSegments.includes(seg));
        }
    }

    /**
     * Shared Data Extraction Utilities
     *
     * Common extraction logic used across:
     * - UserIdentityManager
     * - PayloadBuilder
     * - NetworkObserver
     *
     * Purpose: Eliminate code duplication and ensure consistent behavior
     */
    /**
     * Extract value from cookie by name
     */
    function extractFromCookie(cookieName) {
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
     * Extract value from localStorage
     * Automatically parses JSON if possible
     */
    function extractFromLocalStorage(key) {
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
     * Extract value from sessionStorage
     * Automatically parses JSON if possible
     */
    function extractFromSessionStorage(key) {
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
     * Parse body (JSON or text)
     * Used for request/response body parsing
     */
    function parseBody(body) {
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
     * Safely navigates nested object properties
     */
    function extractByPath(obj, path) {
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
     * Extract value from URL (pathname or query parameter)
     *
     * @param url - Full URL string
     * @param value - Param name (for query) or segment index (for pathname)
     * @param extractType - 'query' or 'pathname'
     * @param requestUrlPattern - Optional pattern for param extraction (e.g., '/api/user/:id')
     */
    function extractFromUrl(url, value, extractType, requestUrlPattern) {
        try {
            const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
            if (extractType === 'query') {
                // Extract query parameter
                return urlObj.searchParams.get(value);
            }
            else if (extractType === 'pathname') {
                // Extract pathname segment by index
                const index = parseInt(value, 10) - 1;
                if (!isNaN(index)) {
                    // Value is numeric index - extract by position
                    const segments = urlObj.pathname.split('/').filter(s => s.length > 0);
                    return segments[index] || null;
                }
                else if (requestUrlPattern) {
                    // Value is param name - extract using pattern matching
                    // This requires PathMatcher utility
                    const { PathMatcher } = require('./path-matcher');
                    const params = PathMatcher.extractParams(url, requestUrlPattern);
                    return params[value] || null;
                }
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Get value from HTML element
     * Handles input, textarea, select, data attributes, and text content
     */
    function getElementValue(element) {
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
    /**
     * NetworkObserver - Singleton passive listener
     */
    class NetworkObserver {
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
            //console.log('[NetworkObserver] Setting UserIdentityManager');
            this.userIdentityManager = userIdentityManager;
            // Process any pending requests that were buffered
            if (this.pendingUserIdentityRequests.length > 0) {
                //console.log('[NetworkObserver] Processing', this.pendingUserIdentityRequests.length, 'pending requests');
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
                //console.log('[NetworkObserver] No UserIdentityManager set');
                return;
            }
            //console.log('[NetworkObserver] Checking if request matches user identity:', requestInfo.url);
            const matchesUserIdentity = this.userIdentityManager.matchesUserIdentityRequest(requestInfo.url, requestInfo.method);
            //console.log('[NetworkObserver] Match result:', matchesUserIdentity);
            if (matchesUserIdentity) {
                //console.log('[NetworkObserver] ✅ Request matches user identity config, extracting...');
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
                //console.log('[NetworkObserver] Calling UserIdentityManager.extractFromNetworkRequest');
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
                //console.log('[NetworkObserver] Already active, skipping initialization');
                return;
            }
            //console.log('[NetworkObserver] Initializing...');
            this.recManager = recManager;
            this.hookFetch();
            this.hookXHR();
            this.isActive = true;
            //console.log('[NetworkObserver] ✅ Initialized and hooked fetch/XHR');
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
                //console.log('[NetworkObserver] Intercepted fetch:', method, url);
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
    function getNetworkObserver() {
        return NetworkObserver.getInstance();
    }

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
    class PayloadBuilder {
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
            //console.log('[PayloadBuilder] handleTrigger called for rule:', rule.name);
            // 1. Phân tích mappings
            const { syncMappings, asyncMappings } = this.classifyMappings(rule);
            //console.log('[PayloadBuilder] syncMappings:', syncMappings.length, 'asyncMappings:', asyncMappings.length);
            // 2. Nếu không có async → resolve ngay
            if (asyncMappings.length === 0) {
                //console.log('[PayloadBuilder] No async mappings, resolving sync only');
                const payload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
                //console.log('[PayloadBuilder] Resolved payload:', payload);
                //console.log('[PayloadBuilder] Calling onComplete callback');
                onComplete(payload);
                return;
            }
            // 3. Có async data → tạo REC
            const requiredFields = asyncMappings.map(m => m.field);
            const context = this.recManager.createContext(rule.id, requiredFields, triggerContext, (collectedData) => {
                // Khi async data đã thu thập xong
                const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
                const finalPayload = { ...syncPayload, ...collectedData };
                onComplete(finalPayload);
            });
            // 4. Resolve sync data ngay và collect vào REC
            const syncPayload = this.resolveSyncMappings(syncMappings, triggerContext, rule);
            for (const [field, value] of Object.entries(syncPayload)) {
                this.recManager.collectField(context.executionId, field, value);
            }
            // 5. Register rule với NetworkObserver để bắt async data
            this.networkObserver.registerRule(rule);
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
            //console.log('[PayloadBuilder] resolveSyncMappings called with', mappings.length, 'mappings');
            const payload = {
                ruleId: rule.id,
                eventTypeId: rule.eventTypeId
            };
            for (const mapping of mappings) {
                const value = this.resolveSyncMapping(mapping, context);
                //console.log('[PayloadBuilder] Resolved', mapping.field, '=', value, 'from source:', mapping.source);
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
            var _a;
            const source = (mapping.source || '').toLowerCase();
            switch (source) {
                case 'element':
                    return this.extractFromElement(mapping, context);
                case 'cookie':
                    return this.extractFromCookie(mapping);
                case 'localstorage':
                case 'local_storage':
                    return this.extractFromLocalStorage(mapping);
                case 'sessionstorage':
                case 'session_storage':
                    return this.extractFromSessionStorage(mapping);
                case 'pageurl':
                case 'page_url':
                    return this.extractFromPageUrl(mapping);
                case 'static':
                    return (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
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
            var _a;
            const element = context.element || context.target;
            if (!element) {
                return null;
            }
            const selector = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.SelectorPattern;
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
                return getElementValue(targetElement);
            }
            catch (error) {
                return null;
            }
        }
        /**
         * Extract từ cookie
         */
        extractFromCookie(mapping) {
            var _a;
            const cookieName = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
            if (!cookieName)
                return null;
            return extractFromCookie(cookieName);
        }
        /**
         * Extract từ localStorage
         */
        extractFromLocalStorage(mapping) {
            var _a;
            const key = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
            if (!key)
                return null;
            return extractFromLocalStorage(key);
        }
        /**
         * Extract từ sessionStorage
         */
        extractFromSessionStorage(mapping) {
            var _a;
            const key = (_a = mapping.config) === null || _a === void 0 ? void 0 : _a.Value;
            if (!key)
                return null;
            return extractFromSessionStorage(key);
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
         * Extract từ page URL (current page)
         * Supports extracting dynamic parameters from URL patterns like /song/:id
         */
        extractFromPageUrl(mapping) {
            if (typeof window === 'undefined' || !window.location) {
                return null;
            }
            const { PageUrlPattern, PageUrlExtractType, Value } = mapping.config || {};
            if (!PageUrlPattern || !Value) {
                return null;
            }
            try {
                const currentUrl = window.location.href;
                const extractType = (PageUrlExtractType || 'pathname').toLowerCase();
                // Use existing extractFromUrl utility with page_url specific config
                return extractFromUrl(currentUrl, Value, extractType, PageUrlPattern);
            }
            catch (error) {
                // console.error('[PayloadBuilder] Error extracting from page URL:', error);
                return null;
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

    /**
     * UserIdentityManager - Quản lý User Identity riêng biệt
     *
     * TRÁCH NHIỆM:
     * 1. Load UserIdentity config từ API
     * 2. Extract user info từ các nguồn khác nhau (request_body, request_url, localStorage, etc.)
     * 3. Cache user info vào localStorage
     * 4. Provide user info khi cần gửi event
     */
    class UserIdentityManager {
        constructor() {
            this.userIdentityConfig = null;
            this.isInitialized = false;
        }
        /**
         * Initialize với user identity config từ TrackerConfig
         * @param config - User identity config đã được load từ API
         */
        initialize(config) {
            if (this.isInitialized) {
                return;
            }
            this.userIdentityConfig = config || null;
            if (this.userIdentityConfig) {
                // Nếu source là network (request_body/request_url), đăng ký với NetworkObserver
                if (!this.isNetworkSource(this.userIdentityConfig.source)) {
                    // Nếu source là static (localStorage, cookie, etc.), extract ngay
                    this.extractAndCacheUserInfo();
                }
            }
            this.isInitialized = true;
        }
        /**
         * Extract và cache user info từ static sources (localStorage, cookie, etc.)
         */
        extractAndCacheUserInfo() {
            if (!this.userIdentityConfig) {
                return;
            }
            const { source, value, field } = this.userIdentityConfig;
            let extractedValue = null;
            try {
                switch (source) {
                    case 'local_storage':
                        extractedValue = extractFromLocalStorage(value || '');
                        break;
                    case 'session_storage':
                        extractedValue = extractFromSessionStorage(value || '');
                        break;
                    case 'cookie':
                        extractedValue = extractFromCookie(value || '');
                        break;
                    case 'element':
                        // Extract từ element trên page (ít dùng cho user identity)
                        if (value) {
                            const element = document.querySelector(value);
                            extractedValue = (element === null || element === void 0 ? void 0 : element.textContent) || null;
                        }
                        break;
                    default:
                        return;
                }
                if (extractedValue) {
                    saveCachedUserInfo(field, extractedValue);
                }
            }
            catch (error) {
                // console.error('[UserIdentityManager] Error extracting user info:', error);
            }
        }
        /**
         * Check if source is network-based
         */
        isNetworkSource(source) {
            return source === 'request_body' || source === 'request_url';
        }
        /**
         * Check if a network request matches the user identity config
         * Called by NetworkObserver
         */
        matchesUserIdentityRequest(url, method) {
            if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
                return false;
            }
            const { RequestUrlPattern, RequestMethod } = this.userIdentityConfig.requestConfig;
            if (RequestMethod.toUpperCase() !== method.toUpperCase()) {
                return false;
            }
            const matches = PathMatcher.match(url, RequestUrlPattern);
            return matches;
        }
        /**
         * Extract user info từ network request
         * Called by NetworkObserver khi match được request
         */
        extractFromNetworkRequest(url, method, requestBody, responseBody) {
            //console.log('[UserIdentityManager] extractFromNetworkRequest called');
            if (!this.userIdentityConfig || !this.userIdentityConfig.requestConfig) {
                //console.log('[UserIdentityManager] No config or requestConfig');
                return;
            }
            const { source, field, requestConfig } = this.userIdentityConfig;
            const { Value, ExtractType } = requestConfig;
            //console.log('[UserIdentityManager] Config - source:', source, 'field:', field, 'value:', Value);
            let extractedValue = null;
            try {
                if (source === 'request_body') {
                    // Flexible extraction logic based on request method
                    if (method.toUpperCase() === 'GET') {
                        // GET requests: always extract from response
                        //console.log('[UserIdentityManager] GET request - extracting from response');
                        extractedValue = extractByPath(parseBody(responseBody), Value);
                    }
                    else {
                        // POST/PUT/PATCH/DELETE: try request body first, then response body
                        //console.log('[UserIdentityManager] Non-GET request - trying request body first');
                        const parsedRequestBody = parseBody(requestBody);
                        extractedValue = extractByPath(parsedRequestBody, Value);
                        if (!extractedValue) {
                            //console.log('[UserIdentityManager] Not found in request body, trying response body');
                            const parsedResponseBody = parseBody(responseBody);
                            extractedValue = extractByPath(parsedResponseBody, Value);
                        }
                    }
                    //console.log('[UserIdentityManager] Extracting from body - final value:', extractedValue);
                }
                else if (source === 'request_url') {
                    // Extract từ URL
                    //console.log('[UserIdentityManager] Extracting from URL:', url);
                    extractedValue = extractFromUrl(url, Value, ExtractType, requestConfig.RequestUrlPattern);
                }
                //console.log('[UserIdentityManager] Extracted value:', extractedValue);
                if (extractedValue) {
                    //console.log('[UserIdentityManager] Saving to cache:', field, '=', extractedValue);
                    saveCachedUserInfo(field, String(extractedValue));
                }
                else {
                    //console.log('[UserIdentityManager] No value extracted');
                }
            }
            catch (error) {
                //console.error('[UserIdentityManager] Error extracting from network:', error);
            }
        }
        /**
         * Get current user info để gửi với event
         * Trả về cached user info hoặc AnonymousId
         */
        getUserInfo() {
            const cached = getCachedUserInfo();
            if (cached && cached.userValue) {
                return {
                    field: cached.userField,
                    value: cached.userValue
                };
            }
            // Fallback to AnonymousId
            return {
                field: 'AnonymousId',
                value: getOrCreateAnonymousId()
            };
        }
        /**
         * Get user identity config (for debugging)
         */
        getConfig() {
            return this.userIdentityConfig;
        }
    }

    /**
     * RatingPlugin - UI Trigger Layer
     *
     * TRÁCH NHIỆM:
     * 1. Phát hiện hành vi rating (click, submit)
     * 2. Match với tracking rules
     * 3. Gọi PayloadBuilder.handleTrigger()
     * 4. KHÔNG extract data (PayloadBuilder + NetworkObserver sẽ làm)
     *
     * FLOW:
     * click/submit → match rule → handleTrigger → DONE
     * Rating value sẽ được lấy từ request body qua NetworkObserver
     */
    class RatingPlugin extends BasePlugin {
        constructor() {
            super(...arguments);
            this.name = 'RatingPlugin';
            this.handleClickBound = this.handleClick.bind(this);
            this.handleSubmitBound = this.handleSubmit.bind(this);
        }
        init(tracker) {
            this.errorBoundary.execute(() => {
                super.init(tracker);
                // console.log('[RatingPlugin] Initialized');
            }, 'RatingPlugin.init');
        }
        start() {
            this.errorBoundary.execute(() => {
                if (!this.ensureInitialized())
                    return;
                if (this.active) {
                    //console.warn('[RatingPlugin] Already active, skipping duplicate start');
                    return;
                }
                // Listen for both click and submit events
                document.addEventListener('click', this.handleClickBound, true);
                document.addEventListener('submit', this.handleSubmitBound, true);
                this.active = true;
                //console.log('[RatingPlugin] Started');
            }, 'RatingPlugin.start');
        }
        stop() {
            this.errorBoundary.execute(() => {
                if (this.tracker) {
                    document.removeEventListener('click', this.handleClickBound, true);
                    document.removeEventListener('submit', this.handleSubmitBound, true);
                }
                super.stop();
            }, 'RatingPlugin.stop');
        }
        /**
         * Handle click event (interactive rating: stars, likes)
         */
        handleClick(event) {
            this.handleInteraction(event, 'click');
        }
        /**
         * Handle submit event (traditional forms)
         */
        handleSubmit(event) {
            this.handleInteraction(event, 'submit');
        }
        /**
         * Main interaction handler
         */
        handleInteraction(event, _eventType) {
            if (!this.tracker)
                return;
            const target = event.target;
            if (!target)
                return;
            const config = this.tracker.getConfig();
            if (!config || !config.trackingRules)
                return;
            // Get rating event ID
            const ratingEventId = this.tracker.getEventTypeId('Rating') || 2;
            const rulesToCheck = config.trackingRules.filter(r => r.eventTypeId === ratingEventId);
            if (rulesToCheck.length === 0)
                return;
            // Check each rule
            for (const rule of rulesToCheck) {
                const matchedElement = this.findMatchingElement(target, rule);
                if (!matchedElement) {
                    continue;
                }
                // Find container (form or parent)
                const container = this.findContainer(matchedElement);
                // Create trigger context - NO rating value extraction
                const triggerContext = {
                    element: matchedElement,
                    target: matchedElement,
                    container: container,
                    eventType: 'rating'
                };
                // Delegate to PayloadBuilder
                // PayloadBuilder will extract rating value from network request body
                this.tracker.payloadBuilder.handleTrigger(rule, triggerContext, (payload) => {
                    // Dispatch rating event
                    this.dispatchEvent(payload, rule, ratingEventId);
                });
            }
        }
        /**
         * Find element matching rule selector
         */
        findMatchingElement(target, rule) {
            const selector = rule.trackingTarget;
            if (!selector)
                return null;
            try {
                // Try closest match
                let match = target.closest(selector);
                // Flexible matching for CSS modules
                if (!match && selector.startsWith('.')) {
                    const baseClassName = selector.substring(1).split('_')[0];
                    let parent = target;
                    let depth = 0;
                    while (parent && depth < 10) {
                        const className = parent.className;
                        if (typeof className === 'string' && className.includes(baseClassName)) {
                            match = parent;
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                }
                return match;
            }
            catch (e) {
                return null;
            }
        }
        /**
         * Find rating container (form, rating-box, etc.)
         */
        findContainer(element) {
            // Try to find form
            const form = element.closest('form');
            if (form)
                return form;
            // Try to find rating container
            const ratingContainer = element.closest('.rating-container') ||
                element.closest('.rating-box') ||
                element.closest('.review-box') ||
                element.closest('[data-rating]');
            if (ratingContainer)
                return ratingContainer;
            // Fallback to parent or body
            return element.parentElement || document.body;
        }
        /**
         * Dispatch tracking event
         */
        dispatchEvent(payload, rule, eventId) {
            if (!this.tracker)
                return;
            this.tracker.track({
                eventType: eventId,
                eventData: {
                    ...payload,
                    actionType: rule.actionType || null
                },
                timestamp: Date.now(),
                url: window.location.href,
                metadata: {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    plugin: this.name
                }
            });
        }
    }

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
            this.eventDeduplicator = new EventDeduplicator(1000); // 1 second window
            this.loopGuard = new LoopGuard({ maxRequestsPerSecond: 5 });
            this.userIdentityManager = new UserIdentityManager();
        }
        // Khởi tạo SDK - tự động gọi khi tải script
        async init() {
            return this.errorBoundary.executeAsync(async () => {
                if (this.isInitialized) {
                    return;
                }
                // Initialize Network Observer FIRST (before anything else)
                const networkObserver = getNetworkObserver();
                networkObserver.initialize(this.payloadBuilder.getRECManager());
                // Load config từ window
                this.config = this.configLoader.loadFromWindow();
                if (!this.config) {
                    return;
                }
                // Khởi tạo EventDispatcher
                // const baseUrl = "https://recsys-tracker-module.onrender.com" || 'https://recsys-tracker-module.onrender.com';
                const baseUrl = "https://recsys-tracker-module.onrender.com";
                this.eventDispatcher = new EventDispatcher({
                    endpoint: `${baseUrl}/event`,
                });
                // Fetch remote config và verify origin
                const remoteConfig = await this.configLoader.fetchRemoteConfig();
                if (remoteConfig) {
                    this.config = remoteConfig;
                    // Initialize UserIdentityManager with config from server
                    this.userIdentityManager.initialize(this.config.userIdentityConfig);
                    // Connect UserIdentityManager with NetworkObserver
                    networkObserver.setUserIdentityManager(this.userIdentityManager);
                    // Cập nhật domainUrl cho EventDispatcher để verify origin khi gửi event
                    if (this.eventDispatcher && this.config.domainUrl) {
                        this.eventDispatcher.setDomainUrl(this.config.domainUrl);
                    }
                    // console.log(this.config);
                    // Tự động khởi tạo plugins dựa trên rules
                    this.autoInitializePlugins();
                    // Khởi tạo Display Manager nếu có returnMethods
                    if (this.config.returnMethods && this.config.returnMethods.length > 0) {
                        // const apiBaseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
                        this.displayManager = new DisplayManager(this.config.domainKey, baseUrl);
                        await this.displayManager.initialize(this.config.returnMethods);
                        // Inject DisplayManager vào EventDispatcher để trigger callback
                        if (this.eventDispatcher) {
                            this.eventDispatcher.setDisplayManager(this.displayManager);
                        }
                    }
                    // console.log(this.config);
                    // // Tự động khởi tạo plugins dựa trên rules
                    // this.autoInitializePlugins();
                }
                else {
                    // Nếu origin verification thất bại, không khởi tạo SDK
                    this.config = null;
                    this.eventDispatcher = null;
                    return;
                }
                // Setup batch sending
                this.setupBatchSending();
                // Setup page unload handler
                this.setupUnloadHandler();
                // Khởi tạo Anonymous ID ngay khi SDK init
                getOrCreateAnonymousId();
                this.isInitialized = true;
                //console.log('[RecSysTracker] ✅ SDK initialized successfully');
            }, 'init');
        }
        // Tự động khởi tạo plugins dựa trên tracking rules
        async autoInitializePlugins() {
            var _a;
            // Chỉ tự động đăng ký nếu chưa có plugin nào được đăng ký
            if (this.pluginManager.getPluginNames().length === 0) {
                // Khởi tạo plugins dựa trên tracking rules nếu có
                if (((_a = this.config) === null || _a === void 0 ? void 0 : _a.trackingRules) && this.config.trackingRules.length > 0) {
                    // Get dynamic IDs with fallbacks
                    const clickId = this.getEventTypeId('Click') || 1;
                    const rateId = this.getEventTypeId('Rating') || 2;
                    const reviewId = this.getEventTypeId('Review') || 3;
                    // Check specific rules (chỉ check nếu tìm thấy ID)
                    const hasClickRules = this.config.trackingRules.some(rule => rule.eventTypeId === clickId) ;
                    const hasRateRules = this.config.trackingRules.some(rule => rule.eventTypeId === rateId) ;
                    const hasReviewRules = this.config.trackingRules.some(rule => rule.eventTypeId === reviewId) ;
                    if (hasClickRules && this.config) {
                        this.use(new ClickPlugin());
                    }
                    if (hasRateRules) {
                        this.use(new RatingPlugin());
                    }
                    if (hasReviewRules) {
                        this.use(new ReviewPlugin());
                    }
                }
                // Always load SearchKeywordPlugin to check for search keyword config
                this.use(new SearchKeywordPlugin());
                if (this.pluginManager.getPluginNames().length > 0) {
                    this.startPlugins();
                }
            }
        }
        // Track custom event - NEW SIGNATURE (supports flexible payload)
        track(eventData) {
            //console.log('[RecSysTracker] track() called with eventData:', eventData);
            this.errorBoundary.execute(() => {
                if (!this.isInitialized || !this.config) {
                    //console.log('[RecSysTracker] ❌ SDK not initialized or no config');
                    return;
                }
                // Extract required fields for deduplication
                // Support both camelCase and PascalCase field names
                const payload = eventData.eventData || {};
                const ruleId = payload.ruleId || payload.RuleId;
                // Lấy user info từ UserIdentityManager
                const userInfo = this.userIdentityManager.getUserInfo();
                //console.log('[RecSysTracker] User info from UserIdentityManager:', userInfo);
                // // User field cho deduplication - sử dụng user info từ UserIdentityManager
                // const userValue = userInfo.value || 
                //                  payload.userId || payload.UserId || 
                //                  payload.username || payload.Username ||
                //                  payload.userValue || payload.UserValue;
                // Item ID - try multiple variants
                const itemId = payload.itemId || payload.ItemId ||
                    payload.itemTitle || payload.ItemTitle ||
                    payload.itemValue || payload.ItemValue ||
                    undefined;
                // Extract rating value
                const ratingValue = payload.Rating !== undefined ? payload.Rating :
                    (eventData.eventType === this.getEventTypeId('Rating') && payload.Value !== undefined) ? payload.Value :
                        undefined;
                // Extract review text
                const reviewText = payload.Review !== undefined ? payload.Review :
                    (eventData.eventType === this.getEventTypeId('Review') && payload.Value !== undefined) ? payload.Value :
                        undefined;
                // Extract action type
                const actionType = payload.actionType || null;
                // Get anonymous ID
                const anonymousId = userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId();
                const userId = userInfo.field === 'UserId' && userInfo.value ? userInfo.value : null;
                //console.log('[RecSysTracker] Final userId:', userId, 'anonymousId:', anonymousId);
                // Check for duplicate event - so sánh TẤT CẢ fields quan trọng
                const isDuplicate = this.eventDeduplicator.isDuplicate(eventData.eventType, Number(ruleId) || 0, userId, anonymousId, itemId, actionType, this.config.domainKey);
                //console.log('[RecSysTracker] isDuplicate:', isDuplicate);
                if (isDuplicate) {
                    //console.log('[RecSysTracker] ❌ Event is duplicate, skipping');
                    return;
                }
                //console.log('[RecSysTracker] ✅ Creating TrackedEvent');
                const trackedEvent = {
                    id: this.metadataNormalizer.generateEventId(),
                    timestamp: new Date(eventData.timestamp),
                    eventTypeId: eventData.eventType,
                    actionType: actionType,
                    trackingRuleId: Number(ruleId) || 0,
                    domainKey: this.config.domainKey,
                    anonymousId: anonymousId,
                    ...(userId && { userId }),
                    ...(itemId && { itemId }),
                    ...(ratingValue !== undefined && {
                        ratingValue: ratingValue
                    }),
                    ...(reviewText !== undefined && {
                        ratingReview: reviewText
                    }),
                };
                //console.log('[RecSysTracker] Adding event to buffer:', trackedEvent);
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
            let unloadHandled = false; // Flag để tránh gửi nhiều lần
            const sendOnUnload = () => {
                this.errorBoundary.execute(() => {
                    if (unloadHandled) {
                        //console.log('[RecSysTracker] Unload already handled, skipping');
                        return;
                    }
                    if (this.eventBuffer.isEmpty() || !this.eventDispatcher) {
                        return;
                    }
                    //console.log('[RecSysTracker] Sending events on unload, buffer size:', this.eventBuffer.size());
                    unloadHandled = true;
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
    exports.EventDeduplicator = EventDeduplicator;
    exports.LoopGuard = LoopGuard;
    exports.PluginManager = PluginManager;
    exports.RatingPlugin = RatingPlugin;
    exports.RecSysTracker = RecSysTracker;
    exports.ReviewPlugin = ReviewPlugin;
    exports.default = RecSysTracker;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=recsys-tracker.iife.js.map
