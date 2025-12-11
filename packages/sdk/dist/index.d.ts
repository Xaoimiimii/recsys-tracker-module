import { TrackerConfig } from './types';
export declare class RecSysTracker {
    private configLoader;
    private errorBoundary;
    private eventBuffer;
    private eventDispatcher;
    private metadataNormalizer;
    private config;
    private userId;
    private isInitialized;
    private sendInterval;
    constructor();
    init(): Promise<void>;
    track(eventData: {
        triggerTypeId: number;
        userId: number;
        itemId: number;
        rate?: {
            Value: number;
            Review: string;
        };
    }): void;
    private setupBatchSending;
    private sendBatch;
    private setupUnloadHandler;
    flush(): Promise<void>;
    getConfig(): TrackerConfig | null;
    setUserId(userId: string | null): void;
    getUserId(): string | null;
    destroy(): void;
}
export default RecSysTracker;
export { ConfigLoader } from './core';
export type * from './types';
//# sourceMappingURL=index.d.ts.map