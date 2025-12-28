import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class RatingPlugin extends BasePlugin {
    readonly name = "RatingPlugin";
    private context;
    private detector;
    private throttledClickHandler;
    private submitHandler;
    constructor();
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    /**
     * Hàm xử lý trung tâm
     */
    private handleInteraction;
}
//# sourceMappingURL=rating-plugin.d.ts.map