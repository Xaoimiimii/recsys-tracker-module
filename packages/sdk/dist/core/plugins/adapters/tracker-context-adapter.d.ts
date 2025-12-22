import { IRecsysContext, TrackingRule, IPayloadBuilder, IEventBuffer } from '../interfaces/recsys-context.interface';
import { RecSysTracker } from '../../..';
export declare class TrackerContextAdapter implements IRecsysContext {
    private tracker;
    constructor(tracker: RecSysTracker);
    config: {
        getRules: (triggerEventId: number) => TrackingRule[];
    };
    get payloadBuilder(): IPayloadBuilder;
    /**
     * [FIX QUAN TRỌNG]
     * Thay vì hard-code logic build payload ở đây, ta trỏ nó về
     * instance payloadBuilder của tracker (Class PayloadBuilder xịn đã viết).
     * Dùng getter và ép kiểu để TypeScript hiểu nó hỗ trợ Overload.
     */
    eventBuffer: IEventBuffer;
    updateIdentity(newUserId: string): void;
}
//# sourceMappingURL=tracker-context-adapter.d.ts.map