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
export class EventBuffer {
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
    // Lấy các sự kiện để gửi theo batch (chỉ lấy những event đã đến thời gian retry)
    getBatch(size) {
        const now = Date.now();
        const readyEvents = this.queue.filter(event => {
            // Nếu chưa từng retry hoặc đã đến thời gian retry tiếp theo
            return !event.nextRetryAt || event.nextRetryAt <= now;
        });
        return readyEvents.slice(0, size);
    }
    // Xóa các sự kiện khỏi buffer sau khi gửi thành công
    removeBatch(eventIds) {
        this.queue = this.queue.filter(event => !eventIds.includes(event.id));
        this.persistToStorage();
    }
    // Đánh dấu các sự kiện thất bại và tăng số lần thử lại với exponential backoff
    markFailed(eventIds) {
        const now = Date.now();
        this.queue.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.retryCount = (event.retryCount || 0) + 1;
                event.lastRetryAt = now;
                // Exponential backoff: 1s → 2s → 4s → 8s → 16s
                const backoffDelay = Math.min(Math.pow(2, event.retryCount) * 1000, // 2^n seconds
                32000 // Max 32 seconds
                );
                event.nextRetryAt = now + backoffDelay;
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
//# sourceMappingURL=event-buffer.js.map