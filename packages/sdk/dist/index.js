import { ConfigLoader, ErrorBoundary, EventBuffer, EventDispatcher, MetadataNormalizer, DisplayManager, PluginManager } from './core';
import { DEFAULT_API_URL, DEFAULT_TRACK_ENDPOINT_PATH } from './core/constants';
import { PayloadBuilder } from './core/payload/payload-builder';
import { EventDeduplicator } from './core/utils/event-deduplicator';
import { LoopGuard } from './core/utils/loop-guard';
import { getNetworkObserver } from './core/network/network-observer';
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
        this.eventDeduplicator = new EventDeduplicator(3000); // 3 second window
        this.loopGuard = new LoopGuard({ maxRequestsPerSecond: 5 });
    }
    // Khởi tạo SDK - tự động gọi khi tải script
    async init() {
        return this.errorBoundary.executeAsync(async () => {
            if (this.isInitialized) {
                return;
            }
            // 🔥 CRITICAL: Initialize Network Observer FIRST (before anything else)
            const networkObserver = getNetworkObserver();
            networkObserver.initialize(this.payloadBuilder.getRECManager());
            console.log('[RecSysTracker] ✅ Network Observer initialized');
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
                console.log(this.config);
                // Khởi tạo Display Manager nếu có returnMethods
                if (this.config.returnMethods && this.config.returnMethods.length > 0) {
                    const apiBaseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
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
        // Get dynamic IDs with fallbacks
        const clickId = this.getEventTypeId('Click') || 1;
        const rateId = this.getEventTypeId('Rating') || 2;
        const reviewId = this.getEventTypeId('Review') || 3;
        const pageViewId = this.getEventTypeId('Page View') || 4;
        const scrollId = this.getEventTypeId('Scroll') || 6;
        // Check specific rules (chỉ check nếu tìm thấy ID)
        const hasClickRules = clickId ? this.config.trackingRules.some(rule => rule.eventTypeId === clickId) : false;
        const hasRateRules = rateId ? this.config.trackingRules.some(rule => rule.eventTypeId === rateId) : false;
        const hasReviewRules = reviewId ? this.config.trackingRules.some(rule => rule.eventTypeId === reviewId) : false;
        const hasPageViewRules = pageViewId ? this.config.trackingRules.some(rule => rule.eventTypeId === pageViewId) : false;
        const hasScrollRules = scrollId ? this.config.trackingRules.some(rule => rule.eventTypeId === scrollId) : false;
        // Chỉ tự động đăng ký nếu chưa có plugin nào được đăng ký
        if (this.pluginManager.getPluginNames().length === 0) {
            const pluginPromises = [];
            if (hasClickRules && this.config) {
                const clickPromise = import('./core/plugins/click-plugin').then(({ ClickPlugin }) => {
                    this.use(new ClickPlugin());
                    console.log('[RecSysTracker] Auto-registered ClickPlugin v2');
                });
                pluginPromises.push(clickPromise);
            }
            if (hasRateRules) {
                const ratingPromise = import('./core/plugins/rating-plugin').then(({ RatingPlugin }) => {
                    this.use(new RatingPlugin());
                    console.log('[RecSysTracker] Auto-registered RatingPlugin v2');
                });
                pluginPromises.push(ratingPromise);
            }
            if (hasReviewRules) {
                const reviewPromise = import('./core/plugins/review-plugin').then(({ ReviewPlugin }) => {
                    this.use(new ReviewPlugin());
                    console.log('[RecSysTracker] Auto-registered ReviewPlugin v2');
                });
                pluginPromises.push(reviewPromise);
            }
            if (hasPageViewRules) {
                const pageViewPromise = import('./core/plugins/page-view-plugin').then(({ PageViewPlugin }) => {
                    this.use(new PageViewPlugin());
                });
                pluginPromises.push(pageViewPromise);
            }
            if (hasScrollRules) {
                const scrollPromise = import('./core/plugins/scroll-plugin').then(({ ScrollPlugin }) => {
                    this.use(new ScrollPlugin());
                });
                pluginPromises.push(scrollPromise);
            }
            // ❌ REMOVE NetworkPlugin auto-registration
            // Network Observer is now initialized globally, not as a plugin
            // ❌ REMOVE NetworkPlugin auto-registration
            // Network Observer is now initialized globally, not as a plugin
            // Chờ tất cả plugin được đăng ký trước khi khởi động
            if (pluginPromises.length > 0) {
                await Promise.all(pluginPromises);
            }
            if (this.pluginManager.getPluginNames().length > 0) {
                this.startPlugins();
            }
        }
    }
    // Track custom event - NEW SIGNATURE (supports flexible payload)
    track(eventData) {
        this.errorBoundary.execute(() => {
            if (!this.isInitialized || !this.config) {
                console.warn('[RecSysTracker] Cannot track: SDK not initialized');
                return;
            }
            // Extract required fields for deduplication
            // Support both camelCase and PascalCase field names
            const payload = eventData.eventData || {};
            const ruleId = payload.ruleId || payload.RuleId;
            // User field - try multiple variants
            const userValue = payload.userId || payload.UserId ||
                payload.anonymousId || payload.AnonymousId ||
                payload.username || payload.Username ||
                payload.userValue || payload.UserValue ||
                'guest';
            // Item field - try multiple variants
            const itemValue = payload.itemId || payload.ItemId ||
                payload.itemTitle || payload.ItemTitle ||
                payload.itemValue || payload.ItemValue ||
                '';
            // Determine field names for tracking
            let userField = 'userId';
            if (payload.AnonymousId || payload.anonymousId)
                userField = 'AnonymousId';
            else if (payload.UserId || payload.userId)
                userField = 'UserId';
            else if (payload.Username || payload.username)
                userField = 'Username';
            let itemField = 'itemId';
            if (payload.ItemId || payload.itemId)
                itemField = 'ItemId';
            else if (payload.ItemTitle || payload.itemTitle)
                itemField = 'ItemTitle';
            // Check for duplicate event (fingerprint-based deduplication)
            if (ruleId && userValue && itemValue) {
                const isDuplicate = this.eventDeduplicator.isDuplicate(eventData.eventType, ruleId, userValue, itemValue);
                if (isDuplicate) {
                    console.log('[RecSysTracker] 🚫 Duplicate event dropped:', {
                        eventType: eventData.eventType,
                        ruleId: ruleId,
                        userValue: userValue,
                        itemValue: itemValue
                    });
                    return;
                }
            }
            // Extract rating value (try multiple field names)
            const ratingValue = payload.ratingValue !== undefined ? payload.ratingValue :
                (eventData.eventType === this.getEventTypeId('Rating') && payload.Value !== undefined) ? payload.Value :
                    undefined;
            // Extract review text (try multiple field names)
            const reviewText = payload.reviewText !== undefined ? payload.reviewText :
                payload.reviewValue !== undefined ? payload.reviewValue :
                    (eventData.eventType === this.getEventTypeId('Review') && payload.Value !== undefined) ? payload.Value :
                        undefined;
            const trackedEvent = {
                id: this.metadataNormalizer.generateEventId(),
                timestamp: new Date(eventData.timestamp),
                eventTypeId: eventData.eventType,
                trackingRuleId: Number(ruleId) || 0,
                domainKey: this.config.domainKey,
                userField: userField,
                userValue: userValue,
                itemField: itemField,
                itemValue: itemValue,
                ...(ratingValue !== undefined && {
                    ratingValue: ratingValue
                }),
                ...(reviewText !== undefined && {
                    ratingReview: reviewText
                }),
            };
            this.eventBuffer.add(trackedEvent);
            console.log('[RecSysTracker] ✅ Event tracked:', trackedEvent);
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
// Export utilities
export { EventDeduplicator } from './core/utils/event-deduplicator';
export { LoopGuard } from './core/utils/loop-guard';
// Export plugin base classes
export { BasePlugin } from './core/plugins/base-plugin';
// Export built-in plugins
export { ClickPlugin } from './core/plugins/click-plugin';
export { PageViewPlugin } from './core/plugins/page-view-plugin';
export { RatingPlugin } from './core/plugins/rating-plugin';
export { ScrollPlugin } from './core/plugins/scroll-plugin';
export { ReviewPlugin } from './core/plugins/review-plugin';
//# sourceMappingURL=index.js.map