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
            this.BASE_API_URL = "http://localhost:3000";
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
                    trackEndpoint: `${this.BASE_API_URL}/event`,
                    configEndpoint: `${this.BASE_API_URL}/domain/${domainKey}`,
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
            try {
                // Gọi 3 API song song
                const [domainResponse, rulesResponse, returnMethodsResponse] = await Promise.all([
                    fetch(`${this.BASE_API_URL}/domain/${this.domainKey}`),
                    fetch(`${this.BASE_API_URL}/rule/domain/${this.domainKey}`),
                    fetch(`${this.BASE_API_URL}/domain/return-method/${this.domainKey}`)
                ]);
                // Kiểm tra response
                if (!domainResponse.ok) {
                    return this.config;
                }
                // Parse responses
                const domainData = domainResponse.ok ? await domainResponse.json() : null;
                const rulesData = rulesResponse.ok ? await rulesResponse.json() : [];
                const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];
                // Cập nhật config với data từ server
                if (this.config) {
                    this.config = {
                        ...this.config,
                        domainUrl: (domainData === null || domainData === void 0 ? void 0 : domainData.Url) || this.config.domainUrl,
                        domainType: (domainData === null || domainData === void 0 ? void 0 : domainData.Type) || this.config.domainType,
                        trackingRules: this.transformRules(rulesData),
                        returnMethods: this.transformReturnMethods(returnMethodsData),
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
                var _a, _b, _c, _d;
                return ({
                    id: ((_a = rule.Id) === null || _a === void 0 ? void 0 : _a.toString()) || rule.id,
                    name: rule.Name || rule.name,
                    // domainId: rule.DomainID || rule.domainId,
                    triggerEventId: rule.TriggerEventID || rule.triggerEventId,
                    targetEventPatternId: ((_b = rule.TargetElement) === null || _b === void 0 ? void 0 : _b.EventPatternID) || rule.targetEventPatternId,
                    targetOperatorId: ((_c = rule.TargetElement) === null || _c === void 0 ? void 0 : _c.OperatorID) || rule.targetOperatorId,
                    targetElementValue: ((_d = rule.TargetElement) === null || _d === void 0 ? void 0 : _d.Value) || rule.targetElementValue,
                    conditions: rule.Conditions || rule.conditions || [],
                    payload: rule.PayloadConfigs || rule.payload || [],
                });
            });
        }
        // Transform return methods từ server format sang SDK format
        transformReturnMethods(returnMethodsData) {
            if (!returnMethodsData || !Array.isArray(returnMethodsData))
                return [];
            return returnMethodsData.map(method => ({
                slotName: method.SlotName || method.slotName,
                returnMethodId: method.ReturnMethodID || method.returnMethodId,
                value: method.Value || method.value || '',
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
            this.queue.push(event);
            this.persistToStorage();
        }
        // Lấy các sự kiện để gửi theo batch
        getBatch(size) {
            return this.queue.slice(0, size);
        }
        // Xóa các sự kiện khỏi buffer sau khi gửi thành công
        removeBatch(eventIds) {
            this.queue = this.queue.filter(event => !eventIds.includes(event.id));
            this.persistToStorage();
        }
        // Đánh dấu các sự kiện thất bại và tăng số lần thử lại
        markFailed(eventIds) {
            this.queue.forEach(event => {
                if (eventIds.includes(event.id)) {
                    event.retryCount = (event.retryCount || 0) + 1;
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
            var _a, _b;
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
                TriggerTypeId: event.triggerTypeId,
                DomainKey: event.domainKey,
                Timestamp: event.timestamp,
                Payload: {
                    UserId: (_a = event.payload) === null || _a === void 0 ? void 0 : _a.UserId,
                    ItemId: (_b = event.payload) === null || _b === void 0 ? void 0 : _b.ItemId,
                },
                ...(event.rate && {
                    Rate: {
                        Value: event.rate.Value,
                        Review: event.rate.Review,
                    }
                })
            });
            // Thử từng phương thức gửi theo thứ tự ưu tiên
            const strategies = ['beacon', 'fetch'];
            for (const strategy of strategies) {
                try {
                    const success = await this.sendWithStrategy(payload, strategy);
                    if (success) {
                        return true;
                    }
                }
                catch (error) {
                    // Thử phương thức tiếp theo
                }
            }
            // Trả về false nếu tất cả phương thức gửi đều thất bại
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
            const { returnMethodId, slotName, value } = method;
            switch (returnMethodId) {
                case 1: // Popup
                    this.initializePopup(slotName, value);
                    break;
                case 2: // Inline
                    this.initializeInline(slotName, value);
                    break;
                default:
                    console.warn(`[DisplayManager] Unknown returnMethodId: ${returnMethodId}`);
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
                this.eventDispatcher = new EventDispatcher({
                    endpoint: this.config.trackEndpoint || '/track',
                });
                // Fetch remote config và verify origin
                const remoteConfig = await this.configLoader.fetchRemoteConfig();
                if (remoteConfig) {
                    this.config = remoteConfig;
                    // Cập nhật domainUrl cho EventDispatcher để verify origin khi gửi event
                    if (this.eventDispatcher && this.config.domainUrl) {
                        this.eventDispatcher.setDomainUrl(this.config.domainUrl);
                    }
                    // Khởi tạo Display Manager nếu có returnMethods
                    if (this.config.returnMethods && this.config.returnMethods.length > 0) {
                        const apiBaseUrl = "http://localhost:3000";
                        this.displayManager = new DisplayManager(this.config.domainKey, apiBaseUrl);
                        this.displayManager.initialize(this.config.returnMethods);
                        console.log('[RecSysTracker] Display methods initialized');
                    }
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
        // Track custom event
        track(eventData) {
            this.errorBoundary.execute(() => {
                if (!this.isInitialized || !this.config) {
                    return;
                }
                const trackedEvent = {
                    id: this.metadataNormalizer.generateEventId(),
                    timestamp: new Date(),
                    triggerTypeId: eventData.triggerTypeId,
                    domainKey: this.config.domainKey,
                    payload: {
                        UserId: eventData.userId,
                        ItemId: eventData.itemId,
                    },
                    ...(eventData.rate && { rate: eventData.rate }),
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

    exports.ConfigLoader = ConfigLoader;
    exports.RecSysTracker = RecSysTracker;
    exports.default = RecSysTracker;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=recsys-tracker.umd.js.map
