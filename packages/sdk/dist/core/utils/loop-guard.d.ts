export declare class LoopGuard {
    private requests;
    private maxRequestsPerSecond;
    private windowSize;
    private blockDuration;
    private cleanupInterval;
    constructor(options?: {
        maxRequestsPerSecond?: number;
        windowSize?: number;
        blockDuration?: number;
    });
    private generateKey;
    checkAndRecord(url: string, method: string, ruleId: number): boolean;
    private cleanup;
    clear(): void;
    getBlockedCount(): number;
}
//# sourceMappingURL=loop-guard.d.ts.map