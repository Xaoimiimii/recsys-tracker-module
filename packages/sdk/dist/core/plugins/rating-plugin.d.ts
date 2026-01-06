/**
 * RatingPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi rating (click, submit)
 * 2. Match với tracking rules
 * 3. Extract rating value/metadata
 * 4. Gọi PayloadBuilder.handleTrigger()
 * 5. KHÔNG bắt network (chỉ thu thập UI data)
 *
 * FLOW:
 * click/submit → detect rating → check rules → handleTrigger → DONE
 */
import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class RatingPlugin extends BasePlugin {
    readonly name = "RatingPlugin";
    private handleClickBound;
    private handleSubmitBound;
    private lastTriggerTime;
    private readonly THROTTLE_MS;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Handle click event (interactive rating: stars, likes)
     */
    private handleClick;
    /**
     * Handle submit event (traditional forms)
     */
    private handleSubmit;
    /**
     * Main interaction handler
     */
    private handleInteraction;
    /**
     * Find element matching rule selector
     */
    private findMatchingElement;
    /**
     * Find rating container (form, rating-box, etc.)
     */
    private findContainer;
    /**
     * Dispatch tracking event
     */
    private dispatchEvent;
}
//# sourceMappingURL=rating-plugin.d.ts.map