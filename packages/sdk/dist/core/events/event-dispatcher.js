// Lớp EventDispatcher chịu trách nhiệm gửi events
export class EventDispatcher {
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
//# sourceMappingURL=event-dispatcher.js.map