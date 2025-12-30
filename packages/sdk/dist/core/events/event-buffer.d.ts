export interface TrackedEvent {
    id: string;
    timestamp: string | Date;
    eventTypeId: number;
    trackingRuleId: number;
    domainKey: string;
    userField: string;
    userValue: string;
    itemField: string;
    itemValue: string;
    value?: string;
    retryCount?: number;
    lastRetryAt?: number;
    nextRetryAt?: number;
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