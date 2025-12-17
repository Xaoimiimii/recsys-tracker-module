import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class FormPlugin extends BasePlugin {
    readonly name = "FormPlugin";
    private context;
    private detector;
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleSubmit;
    private extractFormData;
}
//# sourceMappingURL=form-plugin.d.ts.map