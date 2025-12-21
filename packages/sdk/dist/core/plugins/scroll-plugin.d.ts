import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ScrollPlugin extends BasePlugin {
    readonly name = "ScrollPlugin";
    private context;
    private identityManager;
    private detector;
    private milestones;
    private sentMilestones;
    private maxScrollDepth;
    private startTime;
    private totalActiveTime;
    private isTabVisible;
    private currentItemContext;
    private activeRule;
    private lastScrollProcessTime;
    private readonly THROTTLE_MS;
    private handleScrollBound;
    private handleVisibilityChangeBound;
    private handleUnloadBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private resetState;
    private resolveContextFromRule;
    /**
     * LOGIC XỬ LÝ SCROLL (Có Throttling)
     */
    private handleScroll;
    /**
     * Gửi Event Scroll Depth
     */
    private sendScrollEvent;
    /**
     * LOGIC TÍNH TIME ON PAGE (Xử lý ẩn/hiện Tab)
     */
    private handleVisibilityChange;
    private calculateActiveTime;
    /**
     * Xử lý khi user tắt tab/chuyển trang: Gửi báo cáo tổng kết
     */
    private handleUnload;
    private createSyntheticItem;
    private scanContextSimple;
    private enrichUserIdentity;
    private createDefaultRule;
    private debugPersistent;
}
//# sourceMappingURL=scroll-plugin.d.ts.map