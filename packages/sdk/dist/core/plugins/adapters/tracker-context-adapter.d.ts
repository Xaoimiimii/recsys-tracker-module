import { IRecsysContext, IRecsysRule, RuleEvent, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData } from '../interfaces/recsys-context.interface';
import { RecSysTracker } from '../../..';
/**
 * TrackerContextAdapter - Bridge between RecSysTracker and legacy IRecsysContext
 * Keeps 100% original logic, only adapts data from new SDK config
 */
export declare class TrackerContextAdapter implements IRecsysContext {
    private tracker;
    constructor(tracker: RecSysTracker);
    config: {
        getRules: (eventType: RuleEvent) => IRecsysRule[];
    };
    payloadBuilder: {
        build: (element: Element | IAIItemDetectionResult | null, rule: IRecsysRule, extraData?: IPayloadExtraData) => IRecsysPayload;
    };
    eventBuffer: {
        enqueue: (payload: IRecsysPayload) => void;
    };
    updateIdentity(newUserId: string): void;
}
//# sourceMappingURL=tracker-context-adapter.d.ts.map