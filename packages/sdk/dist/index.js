import { ConfigLoader, ErrorBoundary, EventBuffer, EventDispatcher, MetadataNormalizer, DisplayManager, PluginManager } from './core';
import { DEFAULT_API_URL, DEFAULT_TRACK_ENDPOINT_PATH } from './core/constants';
import { PayloadBuilder } from './core/payload/payload-builder';
import { EventDeduplicator } from './core/utils/event-deduplicator';
import { LoopGuard } from './core/utils/loop-guard';
import { getNetworkObserver } from './core/network/network-observer';
import { getOrCreateAnonymousId } from './core/plugins/utils/plugin-utils';
import { UserIdentityManager } from './core/user';
import { ClickPlugin } from './core/plugins/click-plugin';
import { RatingPlugin } from './core/plugins/rating-plugin';
import { ReviewPlugin } from './core/plugins/review-plugin';
import { SearchKeywordPlugin } from './core/plugins/search-keyword-plugin';
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
            const baseUrl = process.env.API_URL || DEFAULT_API_URL;
            this.eventDispatcher = new EventDispatcher({
                endpoint: `${baseUrl}${DEFAULT_TRACK_ENDPOINT_PATH}`,
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
                    const apiBaseUrl = process.env.API_URL || 'https://recsys-tracker-module.onrender.com';
                    this.displayManager = new DisplayManager(this.config.domainKey, apiBaseUrl);
                    // Connect SearchKeywordPlugin với DisplayManager
                    const searchKeywordPlugin = this.pluginManager.get('SearchKeywordPlugin');
                    if (searchKeywordPlugin) {
                        this.displayManager.setSearchKeywordPlugin(searchKeywordPlugin);
                    }
                    await this.displayManager.initialize(this.config.returnMethods);
                }
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
        // Check specific rules (chỉ check nếu tìm thấy ID)
        const hasClickRules = clickId ? this.config.trackingRules.some(rule => rule.eventTypeId === clickId) : false;
        const hasRateRules = rateId ? this.config.trackingRules.some(rule => rule.eventTypeId === rateId) : false;
        const hasReviewRules = reviewId ? this.config.trackingRules.some(rule => rule.eventTypeId === reviewId) : false;
        // Chỉ tự động đăng ký nếu chưa có plugin nào được đăng ký
        if (this.pluginManager.getPluginNames().length === 0) {
            if (hasClickRules && this.config) {
                this.use(new ClickPlugin());
            }
            if (hasRateRules) {
                this.use(new RatingPlugin());
            }
            if (hasReviewRules) {
                this.use(new ReviewPlugin());
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
        this.errorBoundary.execute(() => {
            if (!this.isInitialized || !this.config) {
                return;
            }
            // Extract required fields for deduplication
            // Support both camelCase and PascalCase field names
            const payload = eventData.eventData || {};
            const ruleId = payload.ruleId || payload.RuleId;
            // Lấy user info từ UserIdentityManager
            const userInfo = this.userIdentityManager.getUserInfo();
            // User field cho deduplication - sử dụng user info từ UserIdentityManager
            const userValue = userInfo.value ||
                payload.userId || payload.UserId ||
                payload.username || payload.Username ||
                payload.userValue || payload.UserValue;
            // Item ID - try multiple variants
            const itemId = payload.itemId || payload.ItemId ||
                payload.itemTitle || payload.ItemTitle ||
                payload.itemValue || payload.ItemValue ||
                undefined;
            // Check for duplicate event (fingerprint-based deduplication)
            if (ruleId && userValue && itemId) {
                const isDuplicate = this.eventDeduplicator.isDuplicate(eventData.eventType, ruleId, userValue, itemId);
                if (isDuplicate) {
                    return;
                }
            }
            // Extract rating value
            const ratingValue = payload.Rating !== undefined ? payload.Rating :
                (eventData.eventType === this.getEventTypeId('Rating') && payload.Value !== undefined) ? payload.Value :
                    undefined;
            // Extract review text
            const reviewText = payload.Review !== undefined ? payload.Review :
                (eventData.eventType === this.getEventTypeId('Review') && payload.Value !== undefined) ? payload.Value :
                    undefined;
            const trackedEvent = {
                id: this.metadataNormalizer.generateEventId(),
                timestamp: new Date(eventData.timestamp),
                eventTypeId: eventData.eventType,
                actionType: payload.actionType || null,
                trackingRuleId: Number(ruleId) || 0,
                domainKey: this.config.domainKey,
                anonymousId: userInfo.field === 'AnonymousId' ? userInfo.value : getOrCreateAnonymousId(),
                ...(userInfo.field === 'UserId' && userInfo.value && { userId: userInfo.value }),
                ...(itemId && { itemId }),
                ...(ratingValue !== undefined && {
                    ratingValue: ratingValue
                }),
                ...(reviewText !== undefined && {
                    ratingReview: reviewText
                }),
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
// Export utilities
export { EventDeduplicator } from './core/utils/event-deduplicator';
export { LoopGuard } from './core/utils/loop-guard';
// Export plugin base classes
export { BasePlugin } from './core/plugins/base-plugin';
// Export built-in plugins
export { ClickPlugin } from './core/plugins/click-plugin';
export { RatingPlugin } from './core/plugins/rating-plugin';
export { ReviewPlugin } from './core/plugins/review-plugin';
//# sourceMappingURL=index.js.map