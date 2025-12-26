import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ReviewPlugin extends BasePlugin {
    readonly name = "ReviewPlugin";
    private context;
    private detector;
    private identityManager;
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleSubmit;
    /**
     * Logic xây dựng Payload theo thứ tự ưu tiên:
     * Config (PayloadBuilder) -> Fallback (AI/Radar/Identity)
     */
    private constructPayload;
    private checkTargetMatch;
    private checkConditions;
    private autoDetectReviewContent;
    private scanSurroundingContext;
    private compareValues;
}
//# sourceMappingURL=review-plugin.d.ts.map