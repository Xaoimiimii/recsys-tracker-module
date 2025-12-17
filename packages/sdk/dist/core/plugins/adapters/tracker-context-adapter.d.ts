import { IRecsysContext, TrackingRule, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData } from '../interfaces/recsys-context.interface';
import { RecSysTracker } from '../../..';
export declare class TrackerContextAdapter implements IRecsysContext {
    private tracker;
    constructor(tracker: RecSysTracker);
    config: {
        getRules: (triggerEventId: number) => TrackingRule[];
    };
    payloadBuilder: {
        build: (element: Element | IAIItemDetectionResult | null, rule: TrackingRule, extraData?: IPayloadExtraData) => IRecsysPayload;
    };
    eventBuffer: {
        enqueue: (payload: IRecsysPayload) => void;
    };
    updateIdentity(newUserId: string): void;
}
//# sourceMappingURL=tracker-context-adapter.d.ts.map