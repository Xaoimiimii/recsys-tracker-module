// Cấu trúc dữ liệu metadata
export interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivityTime: number;
}

export interface PageMetadata {
  url: string;
  title: string;
  referrer: string;
  path: string;
  query: Record<string, string>;
}

export interface DeviceMetadata {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export interface Metadata {
  session: SessionData;
  page: PageMetadata;
  device: DeviceMetadata;
  timestamp: number;
}

// Lớp chuẩn hóa metadata
export class MetadataNormalizer {
  private sessionData: SessionData | null = null;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes
  private sessionStorageKey: string = 'recsys_tracker_session';

  constructor(sessionTimeout?: number) {
    if (sessionTimeout) {
      this.sessionTimeout = sessionTimeout;
    }
    this.initSession();
  }

  // Lấy metadata đầy đủ
  getMetadata(): Metadata {
    return {
      session: this.getSessionData(),
      page: this.getPageMetadata(),
      device: this.getDeviceMetadata(),
      timestamp: Date.now(),
    };
  }

  // Khởi tạo hoặc khôi phục session
  private initSession(): void {
    try {
      const stored = sessionStorage.getItem(this.sessionStorageKey);
      if (stored) {
        const session: SessionData = JSON.parse(stored);
        
        // Check if session is still valid
        const timeSinceLastActivity = Date.now() - session.lastActivityTime;
        if (timeSinceLastActivity < this.sessionTimeout) {
          this.sessionData = session;
          this.updateSessionActivity();
          return;
        }
      }
    } catch (error) {
      console.warn('[RecSysTracker] Failed to restore session:', error);
    }

    // Tạo session mới
    this.createNewSession();
  }

  // Tạo session mới
  private createNewSession(): void {
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      lastActivityTime: Date.now(),
    };
    this.saveSession();
  }

  // Cập nhật thời gian hoạt động cuối cùng của session
  updateSessionActivity(): void {
    if (this.sessionData) {
      this.sessionData.lastActivityTime = Date.now();
      this.saveSession();
    }
  }

  /**
   * Get current session data
   */
  getSessionData(): SessionData {
    if (!this.sessionData) {
      this.createNewSession();
    }
    return this.sessionData!;
  }

  // Lưu session vào sessionStorage
  private saveSession(): void {
    if (this.sessionData) {
      try {
        sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(this.sessionData));
      } catch (error) {
        console.warn('[RecSysTracker] Failed to save session:', error);
      }
    }
  }

  // Tạo ID session mới
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // Lấy metadata trang hiện tại
  getPageMetadata(): PageMetadata {
    const url = new URL(window.location.href);
    const query: Record<string, string> = {};
    
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      path: url.pathname,
      query,
    };
  }

  // Lấy metadata thiết bị
  getDeviceMetadata(): DeviceMetadata {
    const userAgent = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
    const isTablet = /Tablet|iPad/i.test(userAgent);
    const isDesktop = !isMobile && !isTablet;

    return {
      userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      isMobile,
      isTablet,
      isDesktop,
    };
  }

  // Tạo ID event duy nhất
  generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Extract value từ URL sử dụng regex pattern
  extractFromUrl(pattern: string, group: number = 0): string | null {
    try {
      const regex = new RegExp(pattern);
      const match = window.location.pathname.match(regex);
      return match ? match[group] : null;
    } catch (error) {
      console.warn('[RecSysTracker] Invalid URL pattern:', error);
      return null;
    }
  }

  // Extract value từ DOM attribute
  extractFromElement(element: Element, attribute: string): string | null {
    try {
      return element.getAttribute(attribute);
    } catch (error) {
      return null;
    }
  }

  // Đặt lại session (tạo mới)
  resetSession(): void {
    try {
      sessionStorage.removeItem(this.sessionStorageKey);
    } catch (error) {
      console.warn('[RecSysTracker] Failed to reset session:', error);
    }
    this.createNewSession();
  }
}
