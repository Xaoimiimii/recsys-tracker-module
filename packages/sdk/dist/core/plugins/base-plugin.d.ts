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
    protected displayManager?: any;
    constructor();
    init(tracker: RecSysTracker): void;
    abstract start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
    protected triggerRefresh(): void;
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
}
//# sourceMappingURL=base-plugin.d.ts.map