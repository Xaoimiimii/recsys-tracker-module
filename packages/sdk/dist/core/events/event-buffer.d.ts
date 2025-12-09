export interface TrackedEvent {
    id: string;
    timestamp: number;
    event: string;
    category: string;
    userId?: string | null;
    sessionId: string;
    metadata: Record<string, any>;
    retryCount?: number;
}
export declare class EventBuffer {
    private queue;
    private storage;
    private storageKey;
    private maxQueueSize;
    private maxRetries;
    private offlineStorageEnabled;
    constructor(options?: {
        maxQueueSize?: number;
        maxRetries?: number;
        offlineStorage?: boolean;
    });
    add(event: TrackedEvent): void;
    getBatch(size: number): TrackedEvent[];
    removeBatch(eventIds: string[]): void;
    markFailed(eventIds: string[]): void;
    getAll(): TrackedEvent[];
    size(): number;
    isEmpty(): boolean;
    clear(): void;
    private persistToStorage;
    private loadFromStorage;
}
//# sourceMappingURL=event-buffer.d.ts.map