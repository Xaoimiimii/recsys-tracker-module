import { ConfigLoader, ErrorBoundary, EventBuffer, EventDispatcher, MetadataNormalizer, DisplayManager, PluginManager } from './core';
import { DEFAULT_API_URL, DEFAULT_TRACK_ENDPOINT_PATH } from './core/constants';
import { PayloadBuilder } from './core/payload/payload-builder';
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
            const baseUrl = process.env.API_URL || DEFAULT_API_URL;
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
                // Pass config to PayloadBuilder (will auto-enable network tracking if needed)
                this.payloadBuilder.setConfig(this.config);
                console.log(this.config);
                // Khởi tạo Display Manager nếu có returnMethods
                if (this.config.returnMethods && this.config.returnMethods.length > 0) {
                    const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';
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
                const clickPromise = import('./core/plugins/click-plugin').then(({ ClickPlugin }) => {
                    this.use(new ClickPlugin());
                    console.log('[RecSysTracker] Auto-registered ClickPlugin based on tracking rules');
                });
                pluginPromises.push(clickPromise);
            }
            if (hasRateRules) {
                const ratingPromise = import('./core/plugins/rating-plugin').then(({ RatingPlugin }) => {
                    this.use(new RatingPlugin());
                    console.log('[RecSysTracker] Auto-registered RatingPlugin based on tracking rules');
                });
                pluginPromises.push(ratingPromise);
            }
            if (hasReviewRules) {
                const scrollPromise = import('./core/plugins/review-plugin').then(({ ReviewPlugin }) => {
                    this.use(new ReviewPlugin());
                    console.log('[RecSysTracker] Auto-registered ScrollPlugin');
                });
                pluginPromises.push(scrollPromise);
            }
            if (hasPageViewRules) {
                const pageViewPromise = import('./core/plugins/page-view-plugin').then(({ PageViewPlugin }) => {
                    this.use(new PageViewPlugin());
                    console.log('[RecSysTracker] Auto-registered PageViewPlugin based on tracking rules');
                });
                pluginPromises.push(pageViewPromise);
            }
            if (hasScrollRules) {
                const scrollPromise = import('./core/plugins/scroll-plugin').then(({ ScrollPlugin }) => {
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
// Default export for convenience
export default RecSysTracker;
// Export core classes for testing and advanced usage
export { ConfigLoader, PluginManager, DisplayManager } from './core';
// Export plugin base classes
export { BasePlugin } from './core/plugins/base-plugin';
// Export built-in plugins
export { ClickPlugin } from './core/plugins/click-plugin';
export { PageViewPlugin } from './core/plugins/page-view-plugin';
export { RatingPlugin } from './core/plugins/rating-plugin';
export { ScrollPlugin } from './core/plugins/scroll-plugin';
export { ReviewPlugin } from './core/plugins/review-plugin';
//# sourceMappingURL=index.js.map