import {
  ConfigLoader,
  ErrorBoundary,
  EventBuffer,
  TrackedEvent,
  EventDispatcher,
  MetadataNormalizer
} from './core';
import { TrackerConfig } from './types';

// RecSysTracker - Main SDK class
export class RecSysTracker {
  private configLoader: ConfigLoader;
  private errorBoundary: ErrorBoundary;
  private eventBuffer: EventBuffer;
  private eventDispatcher: EventDispatcher | null = null;
  private metadataNormalizer: MetadataNormalizer;
  private config: TrackerConfig | null = null;
  private userId: string | null = null;
  private isInitialized: boolean = false;
  private sendInterval: number | null = null;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.errorBoundary = new ErrorBoundary();
    this.eventBuffer = new EventBuffer();
    this.metadataNormalizer = new MetadataNormalizer();
  }

  // Khởi tạo SDK - tự động gọi khi tải script
  async init(): Promise<void> {
    return this.errorBoundary.executeAsync(async () => {
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
      if (this.config.options?.debug) {
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
  track(eventData: {
    event: string;
    category: string;
    data?: Record<string, any>;
  }): void {
    this.errorBoundary.execute(() => {
      if (!this.isInitialized || !this.config) {
        console.warn('[RecSysTracker] Not initialized, queueing event');
      }

      const metadata = this.metadataNormalizer.getMetadata();
      this.metadataNormalizer.updateSessionActivity();

      const trackedEvent: TrackedEvent = {
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

      if (this.config?.options?.debug) {
        console.log('[RecSysTracker] Event tracked:', trackedEvent);
      }
    }, 'track');
  }









  // Setup batch sending of events
  private setupBatchSending(): void {
    const batchDelay = this.config?.options?.batchDelay || 2000;
    const batchSize = this.config?.options?.batchSize || 10;

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
  private async sendBatch(events: TrackedEvent[]): Promise<void> {
    if (!this.eventDispatcher || events.length === 0) {
      return;
    }

    try {
      const success = await this.eventDispatcher.sendBatch(events);
      
      if (success) {
        const eventIds = events.map(e => e.id);
        this.eventBuffer.removeBatch(eventIds);
      } else {
        const eventIds = events.map(e => e.id);
        this.eventBuffer.markFailed(eventIds);
      }
    } catch (error) {
      console.warn('[RecSysTracker] Failed to send batch:', error);
      const eventIds = events.map(e => e.id);
      this.eventBuffer.markFailed(eventIds);
    }
  }

  // Setup page unload handler để gửi remaining events
  private setupUnloadHandler(): void {
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
  async flush(): Promise<void> {
    return this.errorBoundary.executeAsync(async () => {
      if (this.eventBuffer.isEmpty()) {
        return;
      }

      const allEvents = this.eventBuffer.getAll();
      await this.sendBatch(allEvents);
    }, 'flush');
  }

  // Lấy config hiện tại
  getConfig(): TrackerConfig | null {
    return this.config;
  }



  // Set user ID
  setUserId(userId: string | null): void {
    this.userId = userId;
    if (this.config?.options?.debug) {
      console.log('[RecSysTracker] User ID set:', userId);
    }
  }

  // Get current user ID
  getUserId(): string | null {
    return this.userId;
  }

  // Destroy SDK instance
  destroy(): void {
    this.errorBoundary.execute(() => {
      if (this.sendInterval) {
        clearInterval(this.sendInterval);
      }

      // Flush remaining events
      if (!this.eventBuffer.isEmpty()) {
        const allEvents = this.eventBuffer.getAll();
        this.eventDispatcher?.sendBatch(allEvents);
      }

      this.isInitialized = false;
      console.log('[RecSysTracker] Destroyed');
    }, 'destroy');
  }
}

// Tự động tạo instance toàn cục và khởi tạo
let globalTracker: RecSysTracker | null = null;

if (typeof window !== 'undefined') {
  // Tạo global instance
  globalTracker = new RecSysTracker();

  // Tự động khởi tạo khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      globalTracker?.init();
    });
  } else {
    // DOM đã được tải
    globalTracker.init();
  }

  // Gán vào window để truy cập toàn cục
  (window as any).RecSysTracker = globalTracker;
}

// Default export for convenience
export default RecSysTracker;

// Export core classes for testing
export { ConfigLoader } from './core';

// Export types for TypeScript users
export type * from './types';
