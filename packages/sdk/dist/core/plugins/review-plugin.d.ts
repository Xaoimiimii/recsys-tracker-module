/**
 * ReviewPlugin - UI Trigger Layer
 *
 * TRÁCH NHIỆM:
 * 1. Phát hiện hành vi review (form submit)
 * 2. Match với tracking rules
 * 3. Gọi PayloadBuilder.handleTrigger()
 * 4. KHÔNG lấy payload, KHÔNG bắt network
 *
 * FLOW:
 * submit event → check rules → handleTrigger → DONE
 */
import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ReviewPlugin extends BasePlugin {
    readonly name = "ReviewPlugin";
    private handleClickBound;
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Handle click event (button clicks)
     */
    private handleClick;
    /**
     * Handle submit event (form submits)
     */
    private handleSubmit;
    /**
     * Main interaction handler - TRIGGER PHASE
     * NOTE: This processes review-specific rules only (eventTypeId = 3)
     */
    private handleInteraction;
    /**
     * Find element matching rule selector
     */
    private findMatchingElement;
    /**
     * Find container (form or parent element)
     */
    private findContainer;
    /**
     * Auto-detect review content from container
     */
    private autoDetectReviewContent;
    /**
     * Dispatch tracking event
     */
    private dispatchEvent;
}
//# sourceMappingURL=review-plugin.d.ts.map