// Event Deduplication Utility
// Ngăn chặn các sự kiện trùng lặp trong một khoảng thời gian ngắn
// Generate fingerprint từ eventType + itemId + userId + ruleId
// Drops events nếu same fingerprint được gửi trong timeWindow (3s mặc định)
export class EventDeduplicator {
    constructor(timeWindow) {
        this.fingerprints = new Map();
        this.timeWindow = 3000; // 3 seconds
        this.cleanupInterval = 5000; // cleanup every 5s
        if (timeWindow !== undefined) {
            this.timeWindow = timeWindow;
        }
        // Periodic cleanup of old fingerprints
        if (typeof window !== 'undefined') {
            setInterval(() => this.cleanup(), this.cleanupInterval);
        }
    }
    // Generate fingerprint for an event
    generateFingerprint(eventTypeId, trackingRuleId, userId, itemId) {
        // Simple hash: combine all identifiers
        const raw = `${eventTypeId}:${trackingRuleId}:${userId}:${itemId}`;
        return this.simpleHash(raw);
    }
    // Simple hash function (not cryptographic, just for deduplication)
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    // Check if event is duplicate within time window
    // Returns true if event should be DROPPED (is duplicate)
    isDuplicate(eventTypeId, trackingRuleId, userId, itemId) {
        const fingerprint = this.generateFingerprint(eventTypeId, trackingRuleId, userId, itemId);
        const now = Date.now();
        const lastSeen = this.fingerprints.get(fingerprint);
        if (lastSeen && (now - lastSeen) < this.timeWindow) {
            return true; // Is duplicate
        }
        // Record this fingerprint
        this.fingerprints.set(fingerprint, now);
        return false; // Not duplicate
    }
    // Cleanup old fingerprints to prevent memory leak
    cleanup() {
        const now = Date.now();
        const toDelete = [];
        this.fingerprints.forEach((timestamp, fingerprint) => {
            if (now - timestamp > this.timeWindow) {
                toDelete.push(fingerprint);
            }
        });
        toDelete.forEach(fp => this.fingerprints.delete(fp));
    }
    // Clear all fingerprints (for testing)
    clear() {
        this.fingerprints.clear();
    }
}
//# sourceMappingURL=event-deduplicator.js.map