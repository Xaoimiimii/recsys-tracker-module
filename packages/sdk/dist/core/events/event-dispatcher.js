import { OriginVerifier } from '../utils/origin-verifier';
// Lớp EventDispatcher chịu trách nhiệm gửi events
export class EventDispatcher {
    constructor(options) {
        this.domainUrl = null;
        this.timeout = 5000;
        this.headers = {};
        this.sendingEvents = new Set(); // Track events đang gửi để tránh duplicate
        this.displayManager = null;
        this.endpoint = options.endpoint;
        this.domainUrl = options.domainUrl || null;
        this.timeout = options.timeout || 5000;
        this.headers = options.headers || {};
    }
    // Gửi 1 event đơn lẻ
    async send(event) {
        if (!event) {
            return false;
        }
        // Check nếu event đang được gửi
        if (this.sendingEvents.has(event.id)) {
            //console.log('[EventDispatcher] Event already being sent, skipping:', event.id);
            return true; // Return true để không retry
        }
        // Mark event as being sent
        this.sendingEvents.add(event.id);
        try {
            // Verify origin trước khi gửi event
            if (this.domainUrl) {
                const isOriginValid = OriginVerifier.verify(this.domainUrl);
                if (!isOriginValid) {
                    return false;
                }
            }
            // Chuyển đổi TrackedEvent sang định dạng CreateEventDto
            const payloadObject = {
                Timestamp: event.timestamp,
                EventTypeId: event.eventTypeId,
                ActionType: event.actionType || null,
                TrackingRuleId: event.trackingRuleId,
                DomainKey: event.domainKey,
                AnonymousId: event.anonymousId,
                ...(event.userId && { UserId: event.userId }),
                ...(event.itemId && { ItemId: event.itemId }),
                ...(event.ratingValue !== undefined && { RatingValue: event.ratingValue }),
                ...(event.ratingReview !== undefined && { RatingReview: event.ratingReview })
            };
            const payload = JSON.stringify(payloadObject);
            // Log payload sẽ gửi đi
            // console.log('[EventDispatcher] Sending payload to API:', payloadObject);
            // Thử từng phương thức gửi theo thứ tự ưu tiên
            const strategies = ['beacon', 'fetch'];
            for (const strategy of strategies) {
                try {
                    //console.log('[EventDispatcher] Trying strategy:', strategy);
                    const success = await this.sendWithStrategy(payload, strategy);
                    //console.log('[EventDispatcher] Strategy', strategy, 'result:', success);
                    if (success) {
                        if (this.displayManager && typeof this.displayManager.notifyActionTriggered === 'function') {
                            this.displayManager.notifyActionTriggered();
                        }
                        return true;
                    }
                }
                catch (error) {
                    //console.log('[EventDispatcher] Strategy', strategy, 'failed with error:', error);
                    // Thử phương thức tiếp theo
                }
            }
            // Trả về false nếu tất cả phương thức gửi đều thất bại
            return false;
        }
        finally {
            // Remove from sending set after a delay để tránh retry ngay lập tức
            setTimeout(() => {
                this.sendingEvents.delete(event.id);
            }, 1000);
        }
    }
    // Gửi nhiều events cùng lúc (gọi send cho từng event)
    async sendBatch(events) {
        if (events.length === 0) {
            return true;
        }
        // Gửi từng event riêng lẻ
        const results = await Promise.all(events.map(event => this.send(event)));
        // Trả về true nếu tất cả events gửi thành công
        return results.every(result => result === true);
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
            // throw new Error('sendBeacon not available');
            return false;
        }
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(this.endpoint, blob);
        if (!success) {
            // throw new Error('sendBeacon returned false');
            return false;
        }
        return true;
    }
    // Fetch với keepalive
    async sendFetch(payload) {
        if (typeof fetch === 'undefined') {
            // throw new Error('fetch not available');
            return false;
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
                // throw new Error(`HTTP ${response.status}`);
                return false;
            }
            return true;
        }
        catch (error) {
            clearTimeout(timeoutId);
            // throw error;
            return false;
        }
    }
    // Utility methods
    // Cập nhật URL endpoint động
    setEndpoint(endpoint) {
        this.endpoint = endpoint;
    }
    // Cập nhật domainUrl để verify origin
    setDomainUrl(domainUrl) {
        this.domainUrl = domainUrl;
    }
    // Cập nhật timeout cho requests
    setTimeout(timeout) {
        this.timeout = timeout;
    }
    // Cập nhật custom headers
    setHeaders(headers) {
        this.headers = headers;
    }
    // Inject DisplayManager để notify action triggered
    setDisplayManager(displayManager) {
        this.displayManager = displayManager;
    }
}
//# sourceMappingURL=event-dispatcher.js.map