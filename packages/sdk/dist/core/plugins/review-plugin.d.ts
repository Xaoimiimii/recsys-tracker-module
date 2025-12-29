import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ReviewPlugin extends BasePlugin {
    readonly name = "ReviewPlugin";
    private detector;
    private identityManager;
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleSubmit;
    private constructPayload;
    private checkTargetMatch;
    private checkConditions;
    private autoDetectReviewContent;
    private scanSurroundingContext;
    private compareValues;
}
//# sourceMappingURL=review-plugin.d.ts.map