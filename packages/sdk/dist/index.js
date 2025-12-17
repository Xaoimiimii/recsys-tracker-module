import { ConfigLoader, ErrorBoundary, EventBuffer, EventDispatcher, MetadataNormalizer, PluginManager } from './core';
// RecSysTracker - Main SDK class
export class RecSysTracker {
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
    }
    // Khởi tạo SDK - tự động gọi khi tải script
    // async init(): Promise<void> {
    //   return this.errorBoundary.executeAsync(async () => {
    //     if (this.isInitialized) {
    //       return;
    //     }
    //     // Load config từ window
    //     this.config = this.configLoader.loadFromWindow();
    //     if (!this.config) {
    //       return;
    //     }
    //     // Khởi tạo EventDispatcher
    //     this.eventDispatcher = new EventDispatcher({
    //       endpoint: this.config.trackEndpoint || '/track',
    //     });
    //     // Fetch remote config và verify origin
    //     const remoteConfig = await this.configLoader.fetchRemoteConfig();
    //     if (remoteConfig) {
    //       this.config = remoteConfig;
    //       // Cập nhật domainUrl cho EventDispatcher để verify origin khi gửi event
    //       if (this.eventDispatcher && this.config.domainUrl) {
    //         this.eventDispatcher.setDomainUrl(this.config.domainUrl);
    //       }
    //       // Khởi tạo Display Manager nếu có returnMethods
    //       if (this.config.returnMethods && this.config.returnMethods.length > 0) {
    //         const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';
    //         this.displayManager = new DisplayManager(this.config.domainKey, apiBaseUrl);
    //         this.displayManager.initialize(this.config.returnMethods);
    //         console.log('[RecSysTracker] Display methods initialized');
    //       }
    //       // Tự động khởi tạo plugins dựa trên rules
    //       this.autoInitializePlugins();
    //     } else {
    //       // Nếu origin verification thất bại, không khởi tạo SDK
    //       console.error('[RecSysTracker] Failed to initialize SDK: origin verification failed');
    //       this.config = null;
    //       this.eventDispatcher = null;
    //       return;
    //     }
    //     // Setup batch sending
    //     this.setupBatchSending();
    //     // Setup page unload handler
    //     this.setupUnloadHandler();
    //     this.isInitialized = true;
    //   }, 'init');
    // }
    async init() {
        return this.errorBoundary.executeAsync(async () => {
            var _a, _b;
            if (this.isInitialized)
                return;
            // 1. Load config cơ bản
            this.config = this.configLoader.loadFromWindow();
            // 2. Init Dispatcher
            this.eventDispatcher = new EventDispatcher({
                endpoint: ((_a = this.config) === null || _a === void 0 ? void 0 : _a.trackEndpoint) || 'http://localhost:3000/track', // Fallback endpoint
            });
            // 3. Fetch Remote Config (Cứ để nó chạy, nếu lỗi thì ta dùng Mock)
            try {
                const remoteConfig = await this.configLoader.fetchRemoteConfig();
                if (remoteConfig) {
                    this.config = { ...this.config, ...remoteConfig }; // Merge config
                }
            }
            catch (e) {
                console.warn('Fetch config failed, using Mock Rules');
            }
            // ============================================================
            // 🛑 MOCK RULE ZONE - START
            // Inject Rule giả trực tiếp vào đây để test FormPlugin
            // ============================================================
            // Đảm bảo mảng trackingRules tồn tại
            if (!this.config)
                this.config = { domainKey: 'test' };
            if (!this.config.trackingRules)
                this.config.trackingRules = [];
            // Định nghĩa Mock Rule (Khớp với types.ts)
            const mockRateRule = {
                id: 'MOCK-RULE-01',
                name: 'Mock Rate Form Submission',
                triggerEventId: 2, // 2 = FORM_SUBMIT / RATE (Khớp với TRIGGER_MAP)
                // Target: Chọn Form có ID là "test-form"
                // targetElementValue: '#test-form', 
                // targetEventPatternId: 1, // 1 = CSS_SELECTOR (Khớp với PATTERN_MAP)
                // targetOperatorId: 5,     // 5 = EQUALS (Khớp với OPERATOR_MAP)
                targetElement: {
                    targetEventPatternId: 1,
                    targetOperatorId: 5,
                    targetElementValue: '#review-form'
                },
                conditions: [], // Không cần điều kiện
                payload: [] // Để rỗng để test tính năng Auto-detect của FormPlugin
            };
            // Push vào config
            this.config.trackingRules.push(mockRateRule);
            console.log('⚠️ [DEV MODE] Injected Mock Rule:', mockRateRule);
            // 4. Update các config phụ khác
            if (this.eventDispatcher && ((_b = this.config) === null || _b === void 0 ? void 0 : _b.domainUrl)) {
                this.eventDispatcher.setDomainUrl(this.config.domainUrl);
            }
            // 5. Quan trọng: Hàm này sẽ đọc Mock Rule vừa chèn để khởi tạo FormPlugin
            await this.autoInitializePlugins();
            this.setupBatchSending();
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
        // Kiểm tra nếu có rule nào cần ClickPlugin (triggerEventId === 1)
        const hasClickRules = this.config.trackingRules.some(rule => rule.triggerEventId === 1);
        // Kiểm tra nếu có rule nào cần PageViewPlugin (triggerEventId === 3)
        const hasPageViewRules = this.config.trackingRules.some(rule => rule.triggerEventId === 3);
        const hasFormRules = this.config.trackingRules.some(rule => rule.triggerEventId === 2);
        // Chỉ tự động đăng ký nếu chưa có plugin nào được đăng ký
        if (this.pluginManager.getPluginNames().length === 0) {
            const pluginPromises = [];
            if (hasClickRules) {
                // Import động để tránh circular dependency
                const clickPromise = import('./core/plugins/click-plugin').then(({ ClickPlugin }) => {
                    this.use(new ClickPlugin());
                    console.log('[RecSysTracker] Auto-registered ClickPlugin based on tracking rules');
                });
                pluginPromises.push(clickPromise);
            }
            if (hasPageViewRules) {
                // Import động để tránh circular dependency
                const pageViewPromise = import('./core/plugins/page-view-plugin').then(({ PageViewPlugin }) => {
                    this.use(new PageViewPlugin());
                    console.log('[RecSysTracker] Auto-registered PageViewPlugin based on tracking rules');
                });
                pluginPromises.push(pageViewPromise);
            }
            if (hasFormRules) {
                const formPromise = import('./core/plugins/form-plugin').then(({ FormPlugin }) => {
                    // Lưu ý: FormPlugin cần context và config đặc thù, nhưng ở đây ta khởi tạo instance rỗng trước
                    // PluginManager sẽ gọi .init() sau
                    this.use(new FormPlugin());
                    console.log('[RecSysTracker] Auto-registered FormPlugin based on tracking rules');
                });
                pluginPromises.push(formPromise);
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
// Default export for convenience
export default RecSysTracker;
// Export core classes for testing and advanced usage
export { ConfigLoader, PluginManager, DisplayManager } from './core';
// Export plugin base classes
export { BasePlugin } from './core/plugins/base-plugin';
// Export built-in plugins
export { ClickPlugin } from './core/plugins/click-plugin';
export { PageViewPlugin } from './core/plugins/page-view-plugin';
export { FormPlugin } from './core/plugins/form-plugin';
//# sourceMappingURL=index.js.map