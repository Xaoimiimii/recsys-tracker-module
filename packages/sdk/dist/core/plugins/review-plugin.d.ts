import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ReviewPlugin extends BasePlugin {
    readonly name = "ReviewPlugin";
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleSubmit;
    private checkTargetMatch;
    private checkConditions;
    private autoDetectReviewContent;
    private compareValues;
}
//# sourceMappingURL=review-plugin.d.ts.map