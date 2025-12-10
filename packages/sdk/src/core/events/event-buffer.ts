// Luồng hoạt động
// Khi có sự kiện mới: add() → lưu vào queue → persist vào storage
// Khi gửi: getBatch() → lấy batch events → gửi lên server
// Nếu thành công: removeBatch() → xóa khỏi queue
// Nếu thất bại: markFailed() → tăng retryCount → thử lại sau
// Khi app reload: loadFromStorage() → khôi phục queue → tiếp tục gửi

// Định nghĩa cấu trúc dữ liệu TrackedEvent
export interface TrackedEvent {
  id: string;
  timestamp: number;
  event: string;
  category: string;
  userId?: string | null;
  sessionId: string;
  metadata: Record<string, any>;
  retryCount?: number;
}

// Interface lưu trữ để trừu tượng hóa localStorage/IndexedDB
interface StorageAdapter {
  save(key: string, data: any): void;
  load(key: string): any;
  remove(key: string): void;
}

// Triển khai StorageAdapter sử dụng localStorage
class LocalStorageAdapter implements StorageAdapter {
  save(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      // Storage save failed
    }
  }

  load(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Storage remove failed
    }
  }
}

// EventBuffer class để quản lý hàng đợi sự kiện
// Lưu trữ các sự kiện tracking tạm thời
// Hỗ trợ offline (lưu vào localStorage)
// Xử lý retry khi gửi thất bại
// Gửi theo batch để tối ưu hiệu năng
export class EventBuffer {
  private queue: TrackedEvent[] = [];
  private storage: StorageAdapter;
  private storageKey: string = 'recsys_tracker_queue';
  private maxQueueSize: number = 100;
  private maxRetries: number = 3;
  private offlineStorageEnabled: boolean = true;

  constructor(options?: {
    maxQueueSize?: number;
    maxRetries?: number;
    offlineStorage?: boolean;
  }) {
    this.maxQueueSize = options?.maxQueueSize || 100;
    this.maxRetries = options?.maxRetries || 3;
    this.offlineStorageEnabled = options?.offlineStorage !== false;
    this.storage = new LocalStorageAdapter();

    // Load các sự kiện đã lưu từ storage (nếu có)
    this.loadFromStorage();
  }

  // Thêm sự kiện mới vào buffer
  add(event: TrackedEvent): void {
    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push(event);
    this.persistToStorage();
  }

  // Lấy các sự kiện để gửi theo batch
  getBatch(size: number): TrackedEvent[] {
    return this.queue.slice(0, size);
  }

  // Xóa các sự kiện khỏi buffer sau khi gửi thành công
  removeBatch(eventIds: string[]): void {
    this.queue = this.queue.filter(event => !eventIds.includes(event.id));
    this.persistToStorage();
  }

  // Đánh dấu các sự kiện thất bại và tăng số lần thử lại
  markFailed(eventIds: string[]): void {
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
  getAll(): TrackedEvent[] {
    return [...this.queue];
  }

  // Lấy kích thước hiện tại của queue
  size(): number {
    return this.queue.length;
  }

  // Kiểm tra xem queue có rỗng không
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  // Xóa tất cả sự kiện khỏi buffer
  clear(): void {
    this.queue = [];
    this.storage.remove(this.storageKey);
  }

  // Lưu queue vào storage
  private persistToStorage(): void {
    if (!this.offlineStorageEnabled) {
      return;
    }

    try {
      this.storage.save(this.storageKey, this.queue);
    } catch (error) {
      // Persist failed
    }
  }

  // Load/khôi phục queue từ storage khi khởi động
  private loadFromStorage(): void {
    if (!this.offlineStorageEnabled) {
      return;
    }

    try {
      const stored = this.storage.load(this.storageKey);
      if (Array.isArray(stored)) {
        this.queue = stored;
      }
    } catch (error) {
      // Load from storage failed
    }
  }
}