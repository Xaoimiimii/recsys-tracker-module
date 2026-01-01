export declare class EventDeduplicator {
    private fingerprints;
    private timeWindow;
    private cleanupInterval;
    constructor(timeWindow?: number);
    private generateFingerprint;
    private simpleHash;
    isDuplicate(eventTypeId: number, trackingRuleId: number, userId: string, itemId: string): boolean;
    private cleanup;
    clear(): void;
}
//# sourceMappingURL=event-deduplicator.d.ts.map