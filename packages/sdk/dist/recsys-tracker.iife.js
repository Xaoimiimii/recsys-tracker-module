var RecSysTracker = (function (exports) {
    'use strict';

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
        // Load config từ window.RecSysTrackerConfig
        loadFromWindow() {
            try {
                if (typeof window === 'undefined' || !window.RecSysTrackerConfig) {
                    console.warn('[RecSysTracker] No window.RecSysTrackerConfig found');
                    return null;
                }
                const windowConfig = window.RecSysTrackerConfig;
                // Kiểm tra tính hợp lệ của cấu hình từ window
                if (!this.validateWindowConfig(windowConfig)) {
                    console.error('[RecSysTracker] Invalid window configuration');
                    return null;
                }
                // Lưu domainKey để fetch data
                this.domainKey = windowConfig.domainKey;
                // Default config
                this.config = {
                    domainKey: windowConfig.domainKey,
                    trackEndpoint: `${this.BASE_API_URL}/track`,
                    configEndpoint: `${this.BASE_API_URL}/domain/${windowConfig.domainKey}`,
                    trackingRules: [],
                    returnMethods: [],
                    options: {
                        debug: windowConfig.debug || false,
                        maxRetries: 3,
                        batchSize: 10,
                        batchDelay: 2000,
                        offlineStorage: true,
                    },
                };
                return this.config;
            }
            catch (error) {
                console.error('[RecSysTracker] Error loading window config:', error);
                return null;
            }
        }
        // Lấy cấu hình từ server (remote)
        async fetchRemoteConfig() {
            if (!this.domainKey) {
                console.warn('[RecSysTracker] No domain key set');
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
                    console.warn(`[RecSysTracker] Failed to fetch domain config: ${domainResponse.status}`);
                    return this.config;
                }
                // Parse responses
                await domainResponse.json(); // Parse domain data (for future use)
                const rulesData = rulesResponse.ok ? await rulesResponse.json() : [];
                const returnMethodsData = returnMethodsResponse.ok ? await returnMethodsResponse.json() : [];
                // Cập nhật config với data từ server
                if (this.config) {
                    this.config = {
                        ...this.config,
                        trackingRules: this.transformRules(rulesData),
                        returnMethods: this.transformReturnMethods(returnMethodsData),
                    };
                }
                return this.config;
            }
            catch (error) {
                console.warn('[RecSysTracker] Error fetching remote config:', error);
                return this.config; // Return local config as fallback
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
                    domainId: rule.DomainID || rule.domainId,
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
                key: this.domainKey || '',
                slotName: method.SlotName || method.slotName,
                returnMethodId: method.ReturnMethodID || method.returnMethodId,
                value: method.Value || method.value || '',
            }));
        }
        // Kiểm tra tính hợp lệ của cấu hình từ window
        validateWindowConfig(config) {
            if (!config || typeof config !== 'object') {
                return false;
            }
            if (!config.domainKey || typeof config.domainKey !== 'string') {
                console.error('[RecSysTracker] Missing or invalid domainKey');
                return false;
            }
            return true;
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
                console.warn('[RecSysTracker] LocalStorage save failed:', error);
            }
        }
        load(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            }
            catch (error) {
                console.warn('[RecSysTracker] LocalStorage load failed:', error);
                return null;
            }
        }
        remove(key) {
            try {
                localStorage.removeItem(key);
            }
            catch (error) {
                console.warn('[RecSysTracker] LocalStorage remove failed:', error);
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
                console.warn('[RecSysTracker] Queue full, dropping oldest event');
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
                    // Xóa các sự kiện vượt quá số lần thử lại tối đa
                    if (event.retryCount > this.maxRetries) {
                        console.warn(`[RecSysTracker] Event ${event.id} exceeded max retries, dropping`);
                    }
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
                console.warn('[RecSysTracker] Failed to persist queue:', error);
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
                    console.log(`[RecSysTracker] Loaded ${this.queue.length} events from storage`);
                }
            }
            catch (error) {
                console.warn('[RecSysTracker] Failed to load queue from storage:', error);
            }
        }
    }

    // Lớp EventDispatcher chịu trách nhiệm gửi events
    class EventDispatcher {
        constructor(options) {
            this.timeout = 5000;
            this.headers = {};
            this.endpoint = options.endpoint;
            this.timeout = options.timeout || 5000;
            this.headers = options.headers || {};
        }
        // Gửi 1 event đơn lẻ
        async send(event) {
            return this.sendBatch([event]);
        }
        // Gửi nhiều events cùng lúc
        async sendBatch(events) {
            if (events.length === 0) {
                return true;
            }
            const payload = JSON.stringify({ events });
            // Thử từng phương thức gửi theo thứ tự ưu tiên
            const strategies = ['beacon', 'fetch'];
            for (const strategy of strategies) {
                try {
                    const success = await this.sendWithStrategy(payload, strategy);
                    if (success) {
                        // Trả về true nếu gửi thành công
                        console.log(`[RecSysTracker] Sent ${events.length} events via ${strategy}`);
                        return true;
                    }
                }
                catch (error) {
                    console.warn(`[RecSysTracker] ${strategy} failed:`, error);
                    // Thử phương thức tiếp theo
                }
            }
            console.error('[RecSysTracker] All send strategies failed');
            // Trả về false nếu tất cả phương thức gửi đều thất bại
            return false;
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
                console.warn('[RecSysTracker] Failed to restore session:', error);
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
                    console.warn('[RecSysTracker] Failed to save session:', error);
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
                console.warn('[RecSysTracker] Invalid URL pattern:', error);
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
                console.warn('[RecSysTracker] Failed to reset session:', error);
            }
            this.createNewSession();
        }
    }

    // RecSysTracker - Main SDK class
    class RecSysTracker {
        constructor() {
            this.eventDispatcher = null;
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
                var _a;
                if (this.isInitialized) {
                    console.warn('[RecSysTracker] Already initialized');
                    return;
                }
                console.log('[RecSysTracker] Initializing...');
                // Load config từ window
                this.config = this.configLoader.loadFromWindow();
                if (!this.config) {
                    console.error('[RecSysTracker] Failed to load config, aborting');
                    return;
                }
                // Enable debug mode
                if ((_a = this.config.options) === null || _a === void 0 ? void 0 : _a.debug) {
                    this.errorBoundary.setDebug(true);
                }
                // Khởi tạo EventDispatcher
                this.eventDispatcher = new EventDispatcher({
                    endpoint: this.config.trackEndpoint || '/track',
                });
                // Fetch remote config
                this.configLoader.fetchRemoteConfig().then(remoteConfig => {
                    if (remoteConfig) {
                        this.config = remoteConfig;
                        console.log('[RecSysTracker] Remote config loaded');
                    }
                });
                // Setup batch sending
                this.setupBatchSending();
                // Setup page unload handler
                this.setupUnloadHandler();
                this.isInitialized = true;
                console.log('[RecSysTracker] Initialized successfully');
            }, 'init');
        }
        // Track custom event
        track(eventData) {
            this.errorBoundary.execute(() => {
                var _a, _b;
                if (!this.isInitialized || !this.config) {
                    console.warn('[RecSysTracker] Not initialized, queueing event');
                }
                const metadata = this.metadataNormalizer.getMetadata();
                this.metadataNormalizer.updateSessionActivity();
                const trackedEvent = {
                    id: this.metadataNormalizer.generateEventId(),
                    timestamp: Date.now(),
                    event: eventData.event,
                    category: eventData.category,
                    userId: this.userId,
                    sessionId: metadata.session.sessionId,
                    metadata: {
                        ...metadata,
                        ...eventData.data,
                    },
                };
                this.eventBuffer.add(trackedEvent);
                if ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.debug) {
                    console.log('[RecSysTracker] Event tracked:', trackedEvent);
                }
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
                console.warn('[RecSysTracker] Failed to send batch:', error);
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
            var _a, _b;
            this.userId = userId;
            if ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.debug) {
                console.log('[RecSysTracker] User ID set:', userId);
            }
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
                this.isInitialized = false;
                console.log('[RecSysTracker] Destroyed');
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
    }

    exports.ConfigLoader = ConfigLoader;
    exports.RecSysTracker = RecSysTracker;
    exports.default = RecSysTracker;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=recsys-tracker.iife.js.map
