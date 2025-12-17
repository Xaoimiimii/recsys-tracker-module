import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
export declare class FormPlugin extends BasePlugin {
    readonly name = "FormPlugin";
    private context;
    private detector;
    private identityManager;
    private handleSubmitBound;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    private handleSubmit;
    /**
     * DOM RADAR: Quét ngữ cảnh xung quanh theo phương pháp lan truyền
     * 1. Check bản thân -> 2. Check tổ tiên -> 3. Check phạm vi (Parent Scope)
     */
    private scanSurroundingContext;
    private enrichPayload;
    private extractFormData;
}
//# sourceMappingURL=form-plugin.d.ts.map