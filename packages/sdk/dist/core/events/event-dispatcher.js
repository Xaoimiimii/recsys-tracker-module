import { OriginVerifier } from '../utils/origin-verifier';
// Lớp EventDispatcher chịu trách nhiệm gửi events
export class EventDispatcher {
    constructor(options) {
        this.domainUrl = null;
        this.timeout = 5000;
        this.headers = {};
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
        // Verify origin trước khi gửi event
        if (this.domainUrl) {
            const isOriginValid = OriginVerifier.verify(this.domainUrl);
            if (!isOriginValid) {
                console.warn('[RecSysTracker] Origin verification failed. Event not sent.');
                return false;
            }
        }
        // Chuyển đổi TrackedEvent sang định dạng CreateEventDto
        const payload = JSON.stringify({
            Timestamp: event.timestamp,
            EventTypeId: event.eventTypeId,
            TrackingRuleId: event.trackingRuleId,
            DomainKey: event.domainKey,
            UserField: event.userField,
            UserValue: event.userValue,
            ItemField: event.itemField,
            ItemValue: event.itemValue,
            RatingValue: event.ratingValue,
            ReviewValue: event.reviewValue
        });
        // Thử từng phương thức gửi theo thứ tự ưu tiên
        const strategies = ['beacon', 'fetch'];
        for (const strategy of strategies) {
            try {
                const success = await this.sendWithStrategy(payload, strategy);
                if (success) {
                    return true;
                }
            }
            catch (error) {
                // Thử phương thức tiếp theo
            }
        }
        // Trả về false nếu tất cả phương thức gửi đều thất bại
        return false;
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
}
//# sourceMappingURL=event-dispatcher.js.map