import { BasePlugin } from './base-plugin';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getUserIdentityManager } from './utils/user-identity-manager';
import { getAIItemDetector } from './utils/ai-item-detector';
export class ScrollPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'ScrollPlugin';
        this.context = null;
        this.identityManager = null;
        this.detector = null;
        // --- STATE QUẢN LÝ SCROLL & TIME ---
        this.milestones = [25, 50, 75, 100];
        this.sentMilestones = new Set();
        this.maxScrollDepth = 0;
        // --- STATE QUẢN LÝ THỜI GIAN (VISIBILITY API) ---
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = true;
        // State Context (Lưu Item ID tìm được để dùng cho scroll)
        this.currentItemContext = null;
        this.activeRule = null;
        // --- THROTTLE CONFIG ---
        this.lastScrollProcessTime = 0;
        this.THROTTLE_MS = 200; // Chỉ xử lý scroll tối đa 1 lần mỗi 200ms
        // Bind functions để giữ 'this' context khi truyền vào event listener
        this.handleScrollBound = this.handleScroll.bind(this);
        this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
        this.handleUnloadBound = this.handleUnload.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.context = new TrackerContextAdapter(tracker);
            this.identityManager = getUserIdentityManager();
            this.identityManager.initialize();
            this.detector = getAIItemDetector();
            if (this.context) {
                this.identityManager.setTrackerContext(this.context);
            }
            console.log(`[ScrollPlugin] initialized.`);
        }, 'ScrollPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            this.resetState();
            this.resolveContextFromRule();
            // Lắng nghe sự kiện
            window.addEventListener('scroll', this.handleScrollBound, { passive: true });
            document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
            window.addEventListener('beforeunload', this.handleUnloadBound);
            console.log("[ScrollPlugin] started tracking scroll & time.");
            this.active = true;
        }, 'ScrollPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            window.removeEventListener('scroll', this.handleScrollBound);
            document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
            window.removeEventListener('beforeunload', this.handleUnloadBound);
            super.stop();
        }, 'ScrollPlugin.stop');
    }
    resetState() {
        this.sentMilestones.clear();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = document.visibilityState === 'visible';
        this.currentItemContext = null;
        this.activeRule = null;
    }
    resolveContextFromRule() {
        var _a;
        if (!this.context || !this.detector)
            return;
        // 1. Lấy Rule cho sự kiện SCROLL (ID = 4)
        const scrollRules = this.context.config.getRules(4);
        // Ưu tiên rule đầu tiên tìm thấy (hoặc logic complex hơn tùy bạn)
        this.activeRule = scrollRules.length > 0 ? scrollRules[0] : null;
        let targetElement = null;
        // 2. Nếu Rule có chỉ định Element cụ thể (VD: #product-detail)
        if (this.activeRule) {
            const selector = ((_a = this.activeRule.targetElement) === null || _a === void 0 ? void 0 : _a.targetElementValue) || this.activeRule.targetElementValue;
            if (selector) {
                try {
                    targetElement = document.querySelector(selector);
                    console.log(`[ScrollPlugin] Targeted element from rule: ${selector}`, targetElement);
                }
                catch (e) { }
            }
        }
        // 3. Nếu không có Rule hoặc Selector không tìm thấy, fallback về Body (Toàn trang)
        if (!targetElement) {
            targetElement = document.body;
        }
        // 4. Dùng AI Detector để quét Item ID trên element đó
        // (Đây là sự tái sử dụng tuyệt vời logic của FormPlugin)
        const detected = this.detector.detectItem(targetElement);
        // 5. Nếu AI fail, thử quét thủ công (DOM Radar phiên bản đơn giản)
        if (!detected || !detected.id || detected.id === 'N/A (Failed)') {
            // Thử tìm data attribute trên chính nó hoặc cha gần nhất
            const manualScan = this.scanContextSimple(targetElement);
            if (manualScan) {
                this.currentItemContext = manualScan;
            }
            else {
                // Fallback cuối cùng: Tạo Synthetic Item (Page Scroll)
                this.currentItemContext = this.createSyntheticItem();
            }
        }
        else {
            this.currentItemContext = detected;
        }
        console.log("🎯 [ScrollPlugin] Resolved Context:", this.currentItemContext);
    }
    /**
     * LOGIC XỬ LÝ SCROLL (Có Throttling)
     */
    handleScroll() {
        const now = Date.now();
        // --- 1. THROTTLE CHECK ---
        // Nếu chưa đến thời gian cho phép xử lý tiếp theo -> Bỏ qua
        if (now - this.lastScrollProcessTime < this.THROTTLE_MS) {
            return;
        }
        this.lastScrollProcessTime = now;
        // --- 2. TÍNH TOÁN % SCROLL ---
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        // Công thức: (Vị trí hiện tại + Chiều cao màn hình) / Tổng chiều cao * 100
        // Math.min để đảm bảo không quá 100% (do sai số browser)
        const currentPercent = Math.min(100, Math.round(((scrollTop + windowHeight) / docHeight) * 100));
        // Cập nhật độ sâu kỷ lục
        if (currentPercent > this.maxScrollDepth) {
            this.maxScrollDepth = currentPercent;
        }
        // --- 3. CHECK MILESTONES (25, 50, 75, 100) ---
        this.milestones.forEach(milestone => {
            // Nếu đã vượt qua mốc này VÀ chưa gửi event mốc này
            if (currentPercent >= milestone && !this.sentMilestones.has(milestone)) {
                this.sendScrollEvent(milestone);
                this.sentMilestones.add(milestone); // Đánh dấu đã gửi
            }
        });
    }
    /**
     * Gửi Event Scroll Depth
     */
    sendScrollEvent(depth) {
        if (!this.context)
            return;
        const rule = this.activeRule || this.createDefaultRule('default-scroll', 'Default Scroll Tracking');
        // Tính thời gian Active tính đến lúc này
        const currentActiveSeconds = this.calculateActiveTime();
        // Build Payload
        // Lưu ý: Scroll không có Item Context cụ thể (trừ khi bạn muốn gắn), nên để null hoặc object rỗng
        const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
        payload.event = 'scroll_depth';
        payload.metadata = {
            ...(payload.metadata || {}),
            depth_percentage: depth,
            time_on_page: currentActiveSeconds,
            url: window.location.href
        };
        // Gắn User Identity (tương tự FormPlugin)
        if (this.currentItemContext.id && (!payload.itemId || payload.itemId === 'N/A (Failed)')) {
            payload.itemId = this.currentItemContext.id;
            if (this.currentItemContext.name)
                payload.itemName = this.currentItemContext.name;
        }
        this.enrichUserIdentity(payload);
        this.context.eventBuffer.enqueue(payload);
        console.log(`📜 [ScrollPlugin] Reached ${depth}% depth after ${currentActiveSeconds}s active.`);
    }
    /**
     * LOGIC TÍNH TIME ON PAGE (Xử lý ẩn/hiện Tab)
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            // User vừa ẩn tab: Cộng dồn thời gian từ lúc start đến giờ vào tổng
            this.totalActiveTime += Date.now() - this.startTime;
            this.isTabVisible = false;
        }
        else {
            // User vừa mở lại tab: Reset mốc thời gian bắt đầu tính
            this.startTime = Date.now();
            this.isTabVisible = true;
        }
    }
    calculateActiveTime() {
        let currentSessionTime = 0;
        // Nếu tab đang hiện, tính thời gian trôi qua từ lúc mở lại tab đến giờ
        if (this.isTabVisible) {
            currentSessionTime = Date.now() - this.startTime;
        }
        // Tổng = Thời gian đã tích lũy (lúc ẩn) + Thời gian phiên hiện tại (nếu đang hiện)
        const totalMs = this.totalActiveTime + currentSessionTime;
        return parseFloat((totalMs / 1000).toFixed(1)); // Trả về giây, làm tròn 1 số thập phân
    }
    /**
     * Xử lý khi user tắt tab/chuyển trang: Gửi báo cáo tổng kết
     */
    handleUnload() {
        if (!this.context)
            return;
        if (this.isTabVisible)
            this.totalActiveTime += Date.now() - this.startTime;
        const finalTime = parseFloat((this.totalActiveTime / 1000).toFixed(1));
        if (finalTime < 1)
            return;
        const rule = this.activeRule || this.createDefaultRule('summary', 'Page Summary');
        if (!this.currentItemContext) {
            this.currentItemContext = this.createSyntheticItem();
        }
        const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
        payload.event = 'page_summary';
        payload.metadata = {
            max_scroll_depth: this.maxScrollDepth,
            total_time_on_page: finalTime,
            is_bounce: this.maxScrollDepth < 25 && finalTime < 5
        };
        if (this.currentItemContext.id && (!payload.itemId || payload.itemId === 'N/A (Failed)')) {
            payload.itemId = this.currentItemContext.id;
        }
        this.enrichUserIdentity(payload);
        this.debugPersistent('PAGE_SUMMARY_EVENT', payload);
        this.context.eventBuffer.enqueue(payload);
        console.log("🚀 [DEBUG] Đang gửi vào Buffer:", payload);
    }
    createSyntheticItem() {
        return {
            id: 'page_scroll_' + Date.now(),
            name: document.title || 'General Page',
            type: 'page_view',
            confidence: 1,
            source: 'synthetic_page'
        };
    }
    scanContextSimple(el) {
        const target = el.closest('[data-item-id], [data-product-id]');
        if (target) {
            return {
                id: target.getAttribute('data-item-id') || target.getAttribute('data-product-id'),
                name: target.getAttribute('data-item-name'),
                type: target.getAttribute('data-item-type') || 'unknown',
                confidence: 1,
                source: 'dom_attribute'
            };
        }
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('productId');
        if (urlId) {
            return {
                id: urlId,
                name: document.title,
                type: 'url_param',
                confidence: 1,
                source: 'url'
            };
        }
        return null;
    }
    // Helper: Gắn User ID (Copy logic từ FormPlugin sang cho đồng bộ)
    enrichUserIdentity(payload) {
        if (this.identityManager) {
            const realUserId = this.identityManager.getRealUserId();
            const stableUserId = this.identityManager.getStableUserId();
            if (realUserId && !realUserId.startsWith('anon_')) {
                payload.userId = realUserId;
            }
            else if (stableUserId) {
                if (!payload.userId || (payload.userId.startsWith('anon_') && stableUserId !== payload.userId)) {
                    payload.userId = stableUserId;
                }
            }
            const userInfo = this.identityManager.getUserInfo();
            if (userInfo.sessionId) {
                payload.sessionId = userInfo.sessionId;
                payload.metadata.sessionId = userInfo.sessionId;
            }
        }
    }
    createDefaultRule(id, name) {
        return {
            id: id,
            name: name,
            triggerEventId: 4,
            targetElement: {
                targetElementValue: 'document',
                targetEventPatternId: 1,
                targetOperatorId: 5
            },
            conditions: [],
            payload: []
        };
    }
    debugPersistent(tag, data) {
        const logEntry = {
            time: new Date().toISOString(),
            tag: tag,
            data: data,
            url: window.location.href
        };
        // Lưu vào LocalStorage (chỉ giữ lại 10 log gần nhất để không bị đầy)
        const history = JSON.parse(localStorage.getItem('SDK_DEBUG_LOGS') || '[]');
        history.unshift(logEntry);
        localStorage.setItem('SDK_DEBUG_LOGS', JSON.stringify(history.slice(0, 10)));
        console.log(`💾 [Saved to Storage] ${tag}`, data);
    }
}
//# sourceMappingURL=scroll-plugin.js.map