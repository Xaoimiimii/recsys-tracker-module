import { IRecsysRule, RuleEvent } from './recsys-rule.interface';
export { IRecsysRule, RuleEvent };
export interface IRecsysPayload {
    event: string;
    url: string;
    timestamp: number;
    ruleName: string;
    userId: string;
    itemId: string;
    itemName?: string;
    itemType?: string;
    confidence?: number;
    source?: string;
    metadata?: Record<string, any>;
}
export interface IAIItemDetectionResult {
    id: string;
    name: string;
    type: string;
    confidence: number;
    source: string;
    context?: string;
    metadata?: Record<string, any>;
}
export interface IPayloadExtraData {
    regexMatch?: RegExpMatchArray;
}
export interface IPayloadBuilder {
    build: (element: Element | IAIItemDetectionResult | null, rule: IRecsysRule, extraData?: IPayloadExtraData) => IRecsysPayload;
}
export interface IEventBuffer {
    enqueue: (payload: IRecsysPayload) => void;
}
export interface IRecsysContext {
    config: {
        getRules: (eventType: RuleEvent) => IRecsysRule[];
    };
    payloadBuilder: IPayloadBuilder;
    eventBuffer: IEventBuffer;
    updateIdentity: (newUserId: string) => void;
}
//# sourceMappingURL=recsys-context.interface.d.ts.map