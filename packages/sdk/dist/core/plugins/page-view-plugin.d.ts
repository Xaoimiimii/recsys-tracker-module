import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class PageViewPlugin extends BasePlugin {
    readonly name = "PageViewPlugin";
    readonly version = "1.0.0";
    private context;
    private detector;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handlePageChange;
    private trackCurrentPage;
}
//# sourceMappingURL=page-view-plugin.d.ts.map