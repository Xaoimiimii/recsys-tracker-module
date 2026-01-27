export declare class EventDeduplicator {
    private fingerprints;
    private timeWindow;
    private cleanupInterval;
    private fingerprintRetentionTime;
    constructor(timeWindow?: number);
    private generateFingerprint;
    isDuplicate(eventTypeId: number, trackingRuleId: number, userId: string | null, anonymousId: string, itemId: string | undefined, actionType: string | null, domainKey: string): boolean;
    private cleanup;
    clear(): void;
}
//# sourceMappingURL=event-deduplicator.d.ts.map