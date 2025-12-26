import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { UserIdentityManager, getUserIdentityManager } from './utils/user-identity-manager';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';

// [1] Copy ENUMS từ FormPlugin sang để dùng chung chuẩn
// const TARGET_PATTERN = {
//     CSS_SELECTOR: 1,    
//     DOM_ATTRIBUTE: 2,
//     DATA_ATTRIBUTE: 3
// };

const CONDITION_PATTERN = {
    URL_PARAM: 1,
    CSS_SELECTOR: 2,    
    DOM_ATTRIBUTE: 3,
    DATA_ATTRIBUTE: 4,
};

const TARGET_OPERATOR = {
    CONTAINS: 1,
    NOT_CONTAINS: 2,
    STARTS_WITH: 3,
    ENDS_WITH: 4,
    EQUALS: 5,
    NOT_EQUALS: 6,
    EXISTS: 8,
    NOT_EXISTS: 9
};

export class ScrollPlugin extends BasePlugin {
    public readonly name = 'ScrollPlugin';

    private context: IRecsysContext | null = null;
    private identityManager: UserIdentityManager | null = null;
    private detector: AIItemDetector | null = null;

    // --- STATE QUẢN LÝ SCROLL & TIME ---
    private milestones = [25, 50, 75, 100]; 
    private sentMilestones: Set<number> = new Set(); 
    private maxScrollDepth: number = 0; 
    
    // --- STATE QUẢN LÝ THỜI GIAN ---
    private startTime: number = Date.now();
    private totalActiveTime: number = 0;
    private isTabVisible: boolean = true;
    
    // State Context
    private currentItemContext: any = null;
    private activeRule: any = null; 
    private targetScrollElement: HTMLElement | Window | null = null; // Element đang được track scroll

    // --- THROTTLE CONFIG ---
    private lastScrollProcessTime: number = 0;
    private readonly THROTTLE_MS = 200; 

    private handleScrollBound = this.handleScroll.bind(this);
    private handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
    private handleUnloadBound = this.handleUnload.bind(this);

    public init(tracker: RecSysTracker): void {
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

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;
            this.resetState();
            
            // [NÂNG CẤP] Logic chọn Rule thông minh hơn
            const isResolved = this.resolveContextFromRules();

            if (isResolved) {
                // Chỉ lắng nghe nếu tìm thấy Rule phù hợp
                const target = this.targetScrollElement || window;
                target.addEventListener('scroll', this.handleScrollBound, { passive: true }); // passive để mượt
                
                document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
                window.addEventListener('beforeunload', this.handleUnloadBound);
                console.log(`[ScrollPlugin] Started. Target:`, this.targetScrollElement ? 'Specific Element' : 'Window');
                this.active = true;
            } else {
                console.log(`[ScrollPlugin] No matching rule found for this page. Idle.`);
            }
        }, 'ScrollPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            const target = this.targetScrollElement || window;
            target.removeEventListener('scroll', this.handleScrollBound);
            document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
            window.removeEventListener('beforeunload', this.handleUnloadBound);
            super.stop();
        }, 'ScrollPlugin.stop');
    }

    private resetState(): void {
        this.sentMilestones.clear();
        this.maxScrollDepth = 0;
        this.startTime = Date.now();
        this.totalActiveTime = 0;
        this.isTabVisible = document.visibilityState === 'visible';
        this.currentItemContext = null;
        this.activeRule = null;
        this.targetScrollElement = null;
    }

    /**
     * [NÂNG CẤP] Duyệt qua danh sách Rule để tìm Rule phù hợp nhất
     * Check Target Match & Check Conditions
     */
    private resolveContextFromRules(): boolean {
        if (!this.context || !this.detector) return false;

        // 1. Lấy tất cả Rule SCROLL (ID = 4)
        const scrollRules = this.context.config.getRules(4);
        if (scrollRules.length === 0) return false;

        console.log(`📜 [ScrollPlugin] Checking ${scrollRules.length} rules...`);

        // Tìm Rule đầu tiên thỏa mãn cả Target và Condition
        for (const rule of scrollRules) {
            // A. Check xem Element đích có tồn tại không
            // Với Scroll, Target Element chính là container cần track cuộn (hoặc body)
            const element = this.findTargetElement(rule);
            
            if (element) {
                // B. Check Conditions (URL, Param, State...)
                // Lưu ý: checkConditions cần truyền 1 HTMLElement để check attribute/class
                // Nếu track window, ta dùng document.body làm đại diện để check
                const representativeEl = (element instanceof Window) ? document.body : element as HTMLElement;
                
                if (this.checkConditions(representativeEl, rule)) {
                    this.activeRule = rule;
                    this.targetScrollElement = (element instanceof Window) ? null : element as HTMLElement;
                    
                    console.log(`✅ [ScrollPlugin] Rule Matched: "${rule.name}"`);
                    
                    // C. Sau khi chốt Rule, bắt đầu Detect Item ID dựa trên Element đó
                    this.detectContextForItem(representativeEl);
                    return true;
                }
            }
        }
        
        return false;
    }

    // Helper: Tìm Element dựa trên Rule Config
    private findTargetElement(rule: any): HTMLElement | Window | null {
        const target = rule.targetElement || rule.TargetElement;
        // Nếu không config target, hoặc target là "document"/"window" -> Track Window
        if (!target || !target.targetElementValue || target.targetElementValue === 'document' || target.targetElementValue === 'window') {
            return window;
        }

        // Nếu có selector cụ thể (VD: .scrollable-sidebar)
        const selector = target.targetElementValue || target.Value;
        try {
            const el = document.querySelector(selector);
            return el as HTMLElement; // Trả về null nếu không thấy
        } catch {
            return null;
        }
    }

    // [NÂNG CẤP] Detect Item ID (Dùng lại logic Tam Trụ của FormPlugin)
    private detectContextForItem(element: HTMLElement) {
        // 1. Dùng AI
        let detected = this.detector?.detectItem(element);

        // 2. Nếu AI fail, dùng Radar (Full version)
        if (!detected || !detected.id || detected.id === 'N/A (Failed)') {
             console.log("🔍 [ScrollPlugin] AI failed. Scanning radar...");
             // Dùng hàm quét full (Ancestors + Siblings + URL)
             const contextInfo = this.scanSurroundingContext(element);
             
             if (contextInfo.id) {
                 this.currentItemContext = {
                     id: contextInfo.id,
                     name: contextInfo.name || 'Unknown Item',
                     type: contextInfo.type || 'item',
                     confidence: 1,
                     source: contextInfo.source,
                     context: 'dom_context'
                 };
             } else {
                 // Fallback: Tạo Synthetic Item
                 this.currentItemContext = this.createSyntheticItem();
             }
        } else {
            this.currentItemContext = detected;
        }
        console.log("🎯 [ScrollPlugin] Resolved Context:", this.currentItemContext);
    }

    // --- LOGIC CHECK CONDITIONS (Port từ FormPlugin sang) ---
    private checkConditions(element: HTMLElement, rule: any): boolean {
        const conditions = rule.Conditions || rule.conditions;
        if (!conditions || conditions.length === 0) return true;

        for (const condition of conditions) {
            const patternId = condition.EventPatternID || condition.eventPatternId || 1;
            const operatorId = condition.OperatorID || condition.operatorId || 5;
            const expectedValue = condition.Value || condition.value || '';

            let actualValue: string | null = null;
            let isMet = false;

            switch (patternId) {
                case CONDITION_PATTERN.URL_PARAM: // 1
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has(expectedValue)) actualValue = urlParams.get(expectedValue);
                    else actualValue = window.location.href;
                    break;
                case CONDITION_PATTERN.CSS_SELECTOR: // 2
                    try {
                        isMet = element.matches(expectedValue);
                        if (this.isNegativeOperator(operatorId)) { if (!isMet) continue; return false; }
                        if (!isMet) return false;
                        continue; 
                    } catch { return false; }
                case CONDITION_PATTERN.DOM_ATTRIBUTE: // 3
                    actualValue = element.id; break;
                case CONDITION_PATTERN.DATA_ATTRIBUTE: // 4
                    actualValue = element.getAttribute(expectedValue); break;
                default: actualValue = '';
            }

            isMet = this.compareValues(actualValue, expectedValue, operatorId);
            if (!isMet) return false;
        }
        return true;
    }

    private compareValues(actual: string | null, expected: string, operatorId: number): boolean {
        if (actual === null) actual = '';
        switch (operatorId) {
            case TARGET_OPERATOR.EQUALS: return actual === expected;
            case TARGET_OPERATOR.NOT_EQUALS: return actual !== expected;
            case TARGET_OPERATOR.CONTAINS: return actual.includes(expected);
            case TARGET_OPERATOR.NOT_CONTAINS: return !actual.includes(expected);
            case TARGET_OPERATOR.STARTS_WITH: return actual.startsWith(expected);
            case TARGET_OPERATOR.ENDS_WITH: return actual.endsWith(expected);
            case TARGET_OPERATOR.EXISTS: return actual !== '' && actual !== null;
            case TARGET_OPERATOR.NOT_EXISTS: return actual === '' || actual === null;
            default: return actual === expected;
        }
    }

    private isNegativeOperator(opId: number): boolean {
        return opId === TARGET_OPERATOR.NOT_EQUALS || opId === TARGET_OPERATOR.NOT_CONTAINS || opId === TARGET_OPERATOR.NOT_EXISTS;
    }

    // --- DOM RADAR (Full Version - Port từ FormPlugin) ---
    private scanSurroundingContext(element: HTMLElement): { id?: string, name?: string, type?: string, source: string } {
        const getAttrs = (el: Element | null) => {
            if (!el) return null;
            const id = el.getAttribute('data-item-id') || el.getAttribute('data-product-id') || el.getAttribute('data-id');
            if (id) return { id, name: el.getAttribute('data-item-name') || undefined, type: el.getAttribute('data-item-type') || undefined };
            return null;
        };

        // 1. Ancestors
        const ancestor = element.closest('[data-item-id], [data-product-id], [data-id]');
        const ancestorData = getAttrs(ancestor);
        if (ancestorData) return { ...ancestorData, source: 'ancestor' };

        // 2. Siblings (Scope Scan)
        let currentParent = element.parentElement;
        let levels = 0;
        while (currentParent && levels < 5) {
            const candidates = currentParent.querySelectorAll('[data-item-id], [data-product-id], [data-id]');
            if (candidates.length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    if (!element.contains(candidate)) {
                        const data = getAttrs(candidate);
                        if (data) return { ...data, source: `scope_level_${levels + 1}` };
                    }
                }
            }
            currentParent = currentParent.parentElement;
            levels++;
        }

        // 3. URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('productId');
        if (urlId) return { id: urlId, source: 'url_param' };
        
        return { id: undefined, source: 'none' };
    }

    // --- SCROLL HANDLER (Giữ nguyên logic cũ) ---
    private handleScroll(): void {
        const now = Date.now();
        if (now - this.lastScrollProcessTime < this.THROTTLE_MS) return;
        this.lastScrollProcessTime = now;

        // Xử lý scroll trên Window hoặc Element cụ thể
        let scrollTop, docHeight, clientHeight;
        
        if (this.targetScrollElement instanceof HTMLElement) {
            // Scroll trên div
            scrollTop = this.targetScrollElement.scrollTop;
            docHeight = this.targetScrollElement.scrollHeight;
            clientHeight = this.targetScrollElement.clientHeight;
        } else {
            // Scroll trên window
            scrollTop = window.scrollY || document.documentElement.scrollTop;
            docHeight = document.documentElement.scrollHeight;
            clientHeight = window.innerHeight;
        }

        const currentPercent = Math.min(100, Math.round(((scrollTop + clientHeight) / docHeight) * 100));

        if (currentPercent > this.maxScrollDepth) this.maxScrollDepth = currentPercent;

        this.milestones.forEach(milestone => {
            if (currentPercent >= milestone && !this.sentMilestones.has(milestone)) {
                this.sendScrollEvent(milestone);
                this.sentMilestones.add(milestone);
            }
        });
    }
    
    // --- CÁC HÀM GỬI EVENT (Update type safety) ---
    private sendScrollEvent(depth: number): void {
        if (!this.context) return;
        const rule = this.activeRule || this.createDefaultRule('default-scroll', 'Default Scroll');
        const currentActiveSeconds = this.calculateActiveTime();
        
        const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
        payload.event = 'scroll_depth';
        payload.metadata = {
            ...(payload.metadata || {}),
            depth_percentage: depth,
            time_on_page: currentActiveSeconds,
            url: window.location.href
        };
        this.enrichUserIdentity(payload);
        this.context.eventBuffer.enqueue(payload);
    }

    private handleUnload(): void {
        if (!this.context) return;
        if (this.isTabVisible) this.totalActiveTime += Date.now() - this.startTime;
        const finalTime = parseFloat((this.totalActiveTime / 1000).toFixed(1));
        if (finalTime < 1) return;

        const rule = this.activeRule || this.createDefaultRule('summary', 'Page Summary');
        if (!this.currentItemContext) this.currentItemContext = this.createSyntheticItem();

        const payload = this.context.payloadBuilder.build(this.currentItemContext, rule);
        payload.event = 'page_summary';
        payload.metadata = {
            max_scroll_depth: this.maxScrollDepth,
            total_time_on_page: finalTime,
            is_bounce: this.maxScrollDepth < 25 && finalTime < 5
        };
        this.enrichUserIdentity(payload);
        this.debugPersistent('PAGE_SUMMARY', payload);
        this.context.eventBuffer.enqueue(payload);
    }

    // --- HELPERS (Giữ nguyên) ---
    private handleVisibilityChange(): void {
        if (document.visibilityState === 'hidden') {
            this.totalActiveTime += Date.now() - this.startTime;
            this.isTabVisible = false;
        } else {
            this.startTime = Date.now();
            this.isTabVisible = true;
        }
    }
    
    private calculateActiveTime(): number {
        let currentSessionTime = 0;
        if (this.isTabVisible) currentSessionTime = Date.now() - this.startTime;
        const totalMs = this.totalActiveTime + currentSessionTime;
        return parseFloat((totalMs / 1000).toFixed(1));
    }

    private enrichUserIdentity(payload: any) {
        if (this.identityManager) {
            const uid = this.identityManager.getRealUserId() || this.identityManager.getStableUserId();
            if (uid && !uid.startsWith('anon_')) payload.userId = uid;
            const uInfo = this.identityManager.getUserInfo();
            if (uInfo.sessionId) payload.sessionId = uInfo.sessionId;
        }
    }

    private createSyntheticItem(): any {
        return {
            id: 'page_scroll_' + Date.now(),
            name: document.title || 'General Page',
            type: 'page_view',
            confidence: 1,
            source: 'synthetic_page'
        };
    }

    private createDefaultRule(id: string, name: string): any {
        return {
            id, name, triggerEventId: 4,
            targetElement: { targetElementValue: 'document', targetEventPatternId: 1, targetOperatorId: 5 },
            conditions: [], payload: []
        };
    }

    private debugPersistent(tag: string, data: any) {
        const logEntry = { time: new Date().toISOString(), tag, data, url: window.location.href };
        const history = JSON.parse(localStorage.getItem('SDK_DEBUG_LOGS') || '[]');
        history.unshift(logEntry);
        localStorage.setItem('SDK_DEBUG_LOGS', JSON.stringify(history.slice(0, 10)));
    }
}