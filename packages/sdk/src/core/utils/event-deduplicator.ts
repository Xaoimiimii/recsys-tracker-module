// Event Deduplication Utility
// Ngăn chặn các sự kiện trùng lặp trong một khoảng thời gian ngắn
// Generate fingerprint từ eventType + itemId + userId + ruleId
// Drops events nếu same fingerprint được gửi trong timeWindow (3s mặc định)

export class EventDeduplicator {
  private fingerprints: Map<string, number> = new Map();
  private timeWindow: number = 3000; // 3 seconds
  private cleanupInterval: number = 5000; // cleanup every 5s

  constructor(timeWindow?: number) {
    if (timeWindow !== undefined) {
      this.timeWindow = timeWindow;
    }

    // Periodic cleanup of old fingerprints
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  // Generate fingerprint for an event
  private generateFingerprint(
    eventTypeId: number,
    trackingRuleId: number,
    userId: string,
    itemId: string
  ): string {
    // Simple hash: combine all identifiers
    const raw = `${eventTypeId}:${trackingRuleId}:${userId}:${itemId}`;
    return this.simpleHash(raw);
  }

  // Simple hash function (not cryptographic, just for deduplication)
  private simpleHash(str: string): string {
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
  isDuplicate(
    eventTypeId: number,
    trackingRuleId: number,
    userId: string,
    itemId: string
  ): boolean {
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
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.fingerprints.forEach((timestamp, fingerprint) => {
      if (now - timestamp > this.timeWindow) {
        toDelete.push(fingerprint);
      }
    });

    toDelete.forEach(fp => this.fingerprints.delete(fp));
  }

  // Clear all fingerprints (for testing)
  clear(): void {
    this.fingerprints.clear();
  }
}
