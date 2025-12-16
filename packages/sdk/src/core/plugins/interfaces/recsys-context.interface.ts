import type { TrackingRule } from '../../../types';

export type { TrackingRule };

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
    build: (
        element: Element | IAIItemDetectionResult | null,
        rule: TrackingRule,
        extraData?: IPayloadExtraData
    ) => IRecsysPayload;
}

export interface IEventBuffer {
    enqueue: (payload: IRecsysPayload) => void;
}

export interface IRecsysContext {
    config: {
        getRules: (triggerEventId: number) => TrackingRule[];
    };
    payloadBuilder: IPayloadBuilder;
    eventBuffer: IEventBuffer;
    updateIdentity: (newUserId: string) => void;
}