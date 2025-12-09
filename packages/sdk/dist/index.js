import { ConfigLoader, ErrorBoundary, EventBuffer, EventDispatcher, MetadataNormalizer } from './core';
// RecSysTracker - Main SDK class
export class RecSysTracker {
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
// Default export for convenience
export default RecSysTracker;
// Export core classes for testing
export { ConfigLoader } from './core';
//# sourceMappingURL=index.js.map