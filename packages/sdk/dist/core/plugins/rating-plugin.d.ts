/**
 * RatingPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi rating (click, submit)
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG extract data (PayloadBuilder + NetworkObserver sẽ làm)
 *
 * FLOW:
 * click/submit → match rule → handleTrigger → DONE
 * Rating value sẽ được lấy từ request body qua NetworkObserver
 */
import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class RatingPlugin extends BasePlugin {
    readonly name = "RatingPlugin";
    private handleClickBound;
    private handleSubmitBound;
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