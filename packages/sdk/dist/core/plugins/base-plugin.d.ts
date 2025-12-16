import { RecSysTracker } from '../..';
export interface IPlugin {
    readonly name: string;
    readonly version: string;
    init(tracker: RecSysTracker): void;
    start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
}
export declare abstract class BasePlugin implements IPlugin {
    abstract readonly name: string;
    abstract readonly version: string;
    protected tracker: RecSysTracker | null;
    protected active: boolean;
    init(tracker: RecSysTracker): void;
    abstract start(): void;
    stop(): void;
    destroy(): void;
    isActive(): boolean;
    protected ensureInitialized(): boolean;
}
//# sourceMappingURL=base-plugin.d.ts.map