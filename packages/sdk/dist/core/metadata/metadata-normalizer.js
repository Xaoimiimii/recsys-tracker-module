// Lớp chuẩn hóa metadata
export class MetadataNormalizer {
    constructor(sessionTimeout) {
        this.sessionData = null;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionStorageKey = 'recsys_tracker_session';
        if (sessionTimeout) {
            this.sessionTimeout = sessionTimeout;
        }
        this.initSession();
    }
    // Lấy metadata đầy đủ
    getMetadata() {
        return {
            session: this.getSessionData(),
            page: this.getPageMetadata(),
            device: this.getDeviceMetadata(),
            timestamp: Date.now(),
        };
    }
    // Khởi tạo hoặc khôi phục session
    initSession() {
        try {
            const stored = sessionStorage.getItem(this.sessionStorageKey);
            if (stored) {
                const session = JSON.parse(stored);
                // Check if session is still valid
                const timeSinceLastActivity = Date.now() - session.lastActivityTime;
                if (timeSinceLastActivity < this.sessionTimeout) {
                    this.sessionData = session;
                    this.updateSessionActivity();
                    return;
                }
            }
        }
        catch (error) {
            console.warn('[RecSysTracker] Failed to restore session:', error);
        }
        // Tạo session mới
        this.createNewSession();
    }
    // Tạo session mới
    createNewSession() {
        this.sessionData = {
            sessionId: this.generateSessionId(),
            startTime: Date.now(),
            lastActivityTime: Date.now(),
        };
        this.saveSession();
    }
    // Cập nhật thời gian hoạt động cuối cùng của session
    updateSessionActivity() {
        if (this.sessionData) {
            this.sessionData.lastActivityTime = Date.now();
            this.saveSession();
        }
    }
    /**
     * Get current session data
     */
    getSessionData() {
        if (!this.sessionData) {
            this.createNewSession();
        }
        return this.sessionData;
    }
    // Lưu session vào sessionStorage
    saveSession() {
        if (this.sessionData) {
            try {
                sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(this.sessionData));
            }
            catch (error) {
                console.warn('[RecSysTracker] Failed to save session:', error);
            }
        }
    }
    // Tạo ID session mới
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    // Lấy metadata trang hiện tại
    getPageMetadata() {
        const url = new URL(window.location.href);
        const query = {};
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
    getDeviceMetadata() {
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
    generateEventId() {
        return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
    // Extract value từ URL sử dụng regex pattern
    extractFromUrl(pattern, group = 0) {
        try {
            const regex = new RegExp(pattern);
            const match = window.location.pathname.match(regex);
            return match ? match[group] : null;
        }
        catch (error) {
            console.warn('[RecSysTracker] Invalid URL pattern:', error);
            return null;
        }
    }
    // Extract value từ DOM attribute
    extractFromElement(element, attribute) {
        try {
            return element.getAttribute(attribute);
        }
        catch (error) {
            return null;
        }
    }
    // Đặt lại session (tạo mới)
    resetSession() {
        try {
            sessionStorage.removeItem(this.sessionStorageKey);
        }
        catch (error) {
            console.warn('[RecSysTracker] Failed to reset session:', error);
        }
        this.createNewSession();
    }
}
//# sourceMappingURL=metadata-normalizer.js.map