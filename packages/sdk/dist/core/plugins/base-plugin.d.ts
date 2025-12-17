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
    constructor();
    init(tracker: RecSysTracker): void;
    abstract start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
    protected ensureInitialized(): boolean;
    protected wrapHandler<T extends any[]>(handler: (...args: T) => void, handlerName?: string): (...args: T) => void;
    protected wrapAsyncHandler<T extends any[]>(handler: (...args: T) => Promise<void>, handlerName?: string): (...args: T) => Promise<void>;
}
//# sourceMappingURL=base-plugin.d.ts.map