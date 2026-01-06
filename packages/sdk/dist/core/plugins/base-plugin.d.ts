import { RecSysTracker } from '../..';
import { ErrorBoundary } from '../error-handling/error-boundary';
export interface IPlugin {
    readonly name: string;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
}
export declare abstract class BasePlugin implements IPlugin {
    abstract readonly name: string;
    protected tracker: RecSysTracker | null;
    protected active: boolean;
    protected errorBoundary: ErrorBoundary;
    protected payloadBuilder: any;
    constructor();
    init(tracker: RecSysTracker): void;
    abstract start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
    protected ensureInitialized(): boolean;
    protected wrapHandler<T extends any[]>(handler: (...args: T) => void, handlerName?: string): (...args: T) => void;
    protected wrapAsyncHandler<T extends any[]>(handler: (...args: T) => Promise<void>, handlerName?: string): (...args: T) => Promise<void>;
    protected resolvePayloadIdentity(extractedData: any, rule?: any): {
        userField: string;
        userValue: string;
        itemField: string;
        itemValue: string;
        value: string;
    };
    /**
     * NEW: Track directly with pre-collected payload from startCollection
     * Used after async data collection is complete
     */
    protected trackWithPayload(collectedData: Record<string, any>, rule: any, eventId: number): void;
    /**
     * DEPRECATED: Legacy method - not used by v2 plugins
     * V2 plugins call PayloadBuilder.handleTrigger() directly
     *
     * Phương thức xây dựng và theo dõi payload
     * New Flow: Plugin detects trigger → calls payloadBuilder with callback →
     * payloadBuilder processes and calls back → buildAndTrack constructs and tracks →
     * add to buffer → event dispatch
     *
     * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
     * @param rule - Tracking rule with payload mappings
     * @param eventId - Event type ID
     * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
     */
    protected buildAndTrack(context: any, rule: any, eventId: number): void;
}
//# sourceMappingURL=base-plugin.d.ts.map