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
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Handle submit event - TRIGGER PHASE
     */
    private handleSubmit;
    /**
     * Check if form matches rule
     */
    private matchesRule;
    /**
     * Check target match
     */
    private checkTargetMatch;
    /**
     * Check conditions
     */
    private checkConditions;
    /**
     * Check single condition
     */
    private checkCondition;
    /**
     * Check URL condition
     */
    private checkUrlCondition;
    /**
     * Check selector condition
     */
    private checkSelectorCondition;
    /**
     * Check data attribute condition
     */
    private checkDataAttributeCondition;
    /**
     * Auto-detect review content from form
     */
    private autoDetectReviewContent;
    /**
     * Dispatch tracking event
     */
    private dispatchEvent;
}
//# sourceMappingURL=review-plugin.d.ts.map