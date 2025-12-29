import { TrackedEvent } from './event-buffer';
import { OriginVerifier } from '../utils/origin-verifier';

// Luồng hoạt động
// 1. Nhận events cần gửi
// 2. Chuyển đổi events thành payload JSON
// 3. Thử gửi payload theo thứ tự ưu tiên:
//    a. navigator.sendBeacon
//    b. fetch với keepalive
// 4. Nếu phương thức hiện tại thất bại → thử phương thức tiếp theo
// 5. Trả về kết quả thành công/thất bại

// Các phương thức gửi
export type SendStrategy = 'beacon' | 'fetch';

// Tùy chọn cấu hình dispatcher
export interface DispatchOptions {
  endpoint: string;
  domainUrl?: string; // Thêm domainUrl để verify origin
  timeout?: number;
  headers?: Record<string, string>;
}

// Lớp EventDispatcher chịu trách nhiệm gửi events
export class EventDispatcher {
  private endpoint: string;
  private domainUrl: string | null = null;
  private timeout: number = 5000;
  private headers: Record<string, string> = {};

  constructor(options: DispatchOptions) {
    this.endpoint = options.endpoint;
    this.domainUrl = options.domainUrl || null;
    this.timeout = options.timeout || 5000;
    this.headers = options.headers || {};
  }

  // Gửi 1 event đơn lẻ
  async send(event: TrackedEvent): Promise<boolean> {
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
      Value: event.value
    });

    // Thử từng phương thức gửi theo thứ tự ưu tiên
    const strategies: SendStrategy[] = ['beacon', 'fetch'];

    for (const strategy of strategies) {
      try {
        const success = await this.sendWithStrategy(payload, strategy);
        if (success) {
          console.log('[EventDispatcher] Payload đã được gửi thành công:', {
            strategy,
            eventId: event.id,
            eventTypeId: event.eventTypeId,
            trackingRuleId: event.trackingRuleId,
            domainKey: event.domainKey,
            userField: event.userField,
            userValue: event.userValue,
            itemField: event.itemField,
            itemValue: event.itemValue,
            value: event.value,
            timestamp: event.timestamp,
            endpoint: this.endpoint
          });
          return true;
        }
      } catch (error) {
        // Thử phương thức tiếp theo
      }
    }

    // Trả về false nếu tất cả phương thức gửi đều thất bại
    console.error('[EventDispatcher] Tất cả phương thức gửi thất bại cho event:', event.id);
    return false;
  }

  // Gửi nhiều events cùng lúc (gọi send cho từng event)
  async sendBatch(events: TrackedEvent[]): Promise<boolean> {
    if (events.length === 0) {
      return true;
    }

    // Gửi từng event riêng lẻ
    const results = await Promise.all(
      events.map(event => this.send(event))
    );

    // Trả về true nếu tất cả events gửi thành công
    return results.every(result => result === true);
  }

  // Gửi payload với phương thức cụ thể
  private async sendWithStrategy(payload: string, strategy: SendStrategy): Promise<boolean> {
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
  private sendBeacon(payload: string): boolean {
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
  private async sendFetch(payload: string): Promise<boolean> {
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
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Utility methods
  // Cập nhật URL endpoint động
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  // Cập nhật domainUrl để verify origin
  setDomainUrl(domainUrl: string): void {
    this.domainUrl = domainUrl;
  }

  // Cập nhật timeout cho requests
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  // Cập nhật custom headers
  setHeaders(headers: Record<string, string>): void {
    this.headers = headers;
  }
}
