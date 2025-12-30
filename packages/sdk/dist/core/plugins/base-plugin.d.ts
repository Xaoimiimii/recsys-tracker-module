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
    protected resolvePayloadIdentity(extractedData: any): {
        userField: string;
        userValue: string;
        itemField: string;
        itemValue: string;
        value: string;
    };
    /**
     * Phương thức xây dựng và theo dõi payload
     * Extraction → identity resolution → payload construction → tracking
     *
     * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
     * @param rule - Tracking rule with payload mappings
     * @param eventId - Event type ID
     * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
     */
    protected buildAndTrack(context: any, rule: any, eventId: number, additionalFields?: {
        additionalValues?: string;
        metadata?: Record<string, any>;
    }): void;
}
//# sourceMappingURL=base-plugin.d.ts.map