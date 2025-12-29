import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class RatingPlugin extends BasePlugin {
    readonly name = "RatingPlugin";
    private detector;
    private throttledClickHandler;
    private submitHandler;
    constructor();
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleInteraction;
}
//# sourceMappingURL=rating-plugin.d.ts.map