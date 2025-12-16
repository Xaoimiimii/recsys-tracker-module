import {
  ConfigLoader,
  ErrorBoundary,
  EventBuffer,
  TrackedEvent,
  EventDispatcher,
  MetadataNormalizer,
  DisplayManager
} from './core';
import { TrackerConfig, Plugin, PluginContext } from './types';
import { FormPlugin } from './core/plugins/FormPlugin';

// RecSysTracker - Main SDK class
export class RecSysTracker {
  private configLoader: ConfigLoader;
  private errorBoundary: ErrorBoundary;
  private eventBuffer: EventBuffer;
  private eventDispatcher: EventDispatcher | null = null;
  private metadataNormalizer: MetadataNormalizer;
  private displayManager: DisplayManager | null = null;
  private config: TrackerConfig | null = null;
  private userId: string | null = null;
  private isInitialized: boolean = false;
  private sendInterval: number | null = null;
  private plugins: Plugin[] = [];

  public registerPlugin(plugin: Plugin) {
    // Tạo Context kết nối Plugin -> SDK Core
    const context: PluginContext = {
      config: this.config, 
      // Adapter: Chuyển đổi hàm track của Plugin sang hàm track của SDK
      track: (eventName, payload) => {
        this.trackGeneric(eventName, payload);
      }
    };

    // Khởi tạo Plugin an toàn (bọc trong ErrorBoundary)
    this.errorBoundary.execute(() => {
        plugin.init(context);
        this.plugins.push(plugin);
    }, `registerPlugin:${plugin.name}`);
  }

  // Hàm khởi chạy tất cả plugin (gọi trong init)
  private startPlugins() {
      this.plugins.forEach(p => p.start());
  }

  // Hàm khởi động lại tất cả plugin
  private restartPlugins() {
      this.plugins.forEach(plugin => {
          plugin.stop(); 
          
          // Cập nhật context mới 
          const newContext: PluginContext = {
              config: this.config,
              track: (eventName, payload) => this.trackGeneric(eventName, payload)
          };
          
          plugin.init(newContext);
          plugin.start(); 
      });
  }

  private syncPluginsWithConfig() {
    if (!this.config || !this.config.trackingRules) return;

    const rules = this.config.trackingRules;

    // Lấy danh sách các Trigger ID duy nhất từ config server trả về
    // Ví dụ server trả về: [ {id:1, triggerEventId: 2}, {id:2, triggerEventId: 4} ]
    // -> requiredIds = [2, 4]
    const requiredTriggerIds = new Set(rules.map(r => r.triggerEventId));

    requiredTriggerIds.forEach(triggerId => {
      // 2. Mapping ID -> Class Plugin ngay tại đây (Dùng switch-case hoặc if)
      let PluginClass: new () => Plugin

      switch (triggerId) {
        case 2: // Form Submit
        case 3: // Change
        case 4: // Keydown
          // Các ID này đều do FormPlugin xử lý
          PluginClass = FormPlugin; 
          break;
          
        // case 1:
        //   PluginClass = ClickPlugin;
        //   break;
          
        // case 5: 
        //   PluginClass = ScrollPlugin;
        //   break;
          
        default:
          console.warn(`[RecSysTracker] No plugin found for TriggerID: ${triggerId}`);
          return;
      }

      // 3. Khởi tạo Plugin (nếu chưa có)
      // Kiểm tra xem trong list this.plugins đã có instance của class này chưa
      // Tránh trường hợp ID 2 và 4 cùng trỏ về FormPlugin mà lại new 2 lần
      if (PluginClass) {
        const alreadyExists = this.plugins.some(p => p instanceof PluginClass!);
        
        if (!alreadyExists) {
          const newPlugin = new PluginClass();
          this.registerPlugin(newPlugin); // Đăng ký và push vào mảng this.plugins
        }
      }
    });

    // 4. Restart lại các plugin vừa tạo để chúng nhận context & config mới
    this.restartPlugins();
  }

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
        this.syncPluginsWithConfig();
        
        // Cập nhật domainUrl cho EventDispatcher để verify origin khi gửi event
        if (this.eventDispatcher && this.config.domainUrl) {
          this.eventDispatcher.setDomainUrl(this.config.domainUrl);
        }

        // Khởi tạo Display Manager nếu có returnMethods
        if (this.config.returnMethods && this.config.returnMethods.length > 0) {
          const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';
          this.displayManager = new DisplayManager(this.config.domainKey, apiBaseUrl);
          this.displayManager.initialize(this.config.returnMethods);
          console.log('[RecSysTracker] Display methods initialized');
        }
      } else {
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
  trackGeneric(eventName: string, payload: Record<string, any>): void {
    this.errorBoundary.execute(() => {
      if (!this.isInitialized || !this.config) return;

      // 1. Lấy metadata tự động (Url, Device, Session...)
      const metadata = this.metadataNormalizer.getMetadata();
      this.metadataNormalizer.updateSessionActivity();

      // 2. Tạo Event Object
      const trackedEvent: TrackedEvent = {
        id: this.metadataNormalizer.generateEventId(),
        timestamp: new Date(), // Hoặc Date.now() tùy type TrackedEvent
        domainKey: this.config.domainKey,
        
        // Nếu Server cần triggerTypeId (số), ta phải map từ eventName (chuỗi)
        // Hoặc tốt nhất: Server nên nhận eventName là String để linh hoạt
        // Ở đây mình tạm để payload chứa toàn bộ data
        triggerTypeId: payload.triggerTypeId || 0, // Fallback nếu plugin không gửi ID
        
        payload: {
          eventName: eventName,
          userId: this.userId, // Gắn userId nếu đã setGlobal
          ...payload,          // Merge dữ liệu từ form (content, formId...)
          ...metadata.page,    // Gắn thông tin URL
        }
      };

      this.eventBuffer.add(trackedEvent);
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

      // Stop all plugins
      this.plugins.forEach(p => p.stop());

      // Flush remaining events
      if (!this.eventBuffer.isEmpty()) {
        const allEvents = this.eventBuffer.getAll();
        this.eventDispatcher?.sendBatch(allEvents);
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
  
  // Expose classes for testing
  if (globalTracker) {
    (window as any).RecSysTracker.ConfigLoader = ConfigLoader;
  }
}

// Default export for convenience
export default RecSysTracker;

// Export core classes for testing
export { ConfigLoader } from './core';

// Export types for TypeScript users
export type * from './types';
