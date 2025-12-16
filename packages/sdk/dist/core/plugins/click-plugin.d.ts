import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class ClickPlugin extends BasePlugin {
    readonly name = "ClickPlugin";
    readonly version = "1.0.0";
    private context;
    private detector;
    private throttledHandler;
    private readonly THROTTLE_DELAY;
    constructor();
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleDocumentClick;
}
//# sourceMappingURL=click-plugin.d.ts.map