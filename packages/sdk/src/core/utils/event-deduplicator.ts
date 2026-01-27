// Event Deduplication Utility
// Ngăn chặn các sự kiện hoàn toàn giống nhau được gửi nhiều lần
// So sánh TẤT CẢ fields quan trọng: eventType, ruleId, userId, anonId, itemId, actionType, domainKey
// Chặn nếu 2 events giống nhau đến trong vòng 1 giây (theo thời gian thực, không phải event timestamp)

interface EventFingerprint {
  lastSeenTime: number; // Thời điểm lần cuối event này được nhìn thấy (Date.now())
}

export class EventDeduplicator {
  private fingerprints: Map<string, EventFingerprint> = new Map();
  private timeWindow: number = 1000; // 1 second - khoảng thời gian chặn duplicate
  private cleanupInterval: number = 30000; // cleanup every 30s (tăng từ 5s)
  private fingerprintRetentionTime: number = 15000; // Giữ fingerprints 15s (đủ lâu để catch duplicates)

  constructor(timeWindow?: number) {
    if (timeWindow !== undefined) {
      this.timeWindow = timeWindow;
    }

    //console.log('[EventDeduplicator] Created with timeWindow:', this.timeWindow);

    // Periodic cleanup of old fingerprints
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  // Generate fingerprint từ TẤT CẢ fields quan trọng (trừ timestamp)
  private generateFingerprint(
    eventTypeId: number,
    trackingRuleId: number,
    userId: string | null,
    anonymousId: string,
    itemId: string | undefined,
    actionType: string | null,
    domainKey: string
  ): string {
    // Dùng raw string để tránh hash collision
    return `${eventTypeId}:${trackingRuleId}:${userId || ''}:${anonymousId}:${itemId || ''}:${actionType || ''}:${domainKey}`;
  }

  // Check if event is duplicate
  // Returns true if event should be DROPPED (is duplicate)
  isDuplicate(
    eventTypeId: number,
    trackingRuleId: number,
    userId: string | null,
    anonymousId: string,
    itemId: string | undefined,
    actionType: string | null,
    domainKey: string
  ): boolean {
    const fingerprint = this.generateFingerprint(
      eventTypeId, 
      trackingRuleId, 
      userId, 
      anonymousId, 
      itemId, 
      actionType, 
      domainKey
    );
    
    const now = Date.now();
    const lastSeen = this.fingerprints.get(fingerprint);
    
    if (lastSeen) {
      // Check nếu event giống hệt đến trong vòng timeWindow (theo thời gian thực)
      const timeDiff = now - lastSeen.lastSeenTime;
      
      if (timeDiff < this.timeWindow) {
        // console.log('[EventDeduplicator] ❌ DROPPED duplicate event');
        // Update time để reset window
        this.fingerprints.set(fingerprint, { lastSeenTime: now });
        return true; // Is duplicate - event giống hệt đến quá nhanh
      }
    }

    // Record fingerprint với thời điểm hiện tại NGAY LẬP TỨC
    // Điều này đảm bảo event tiếp theo sẽ thấy fingerprint này
    this.fingerprints.set(fingerprint, {
      lastSeenTime: now
    });
    
    //console.log('[EventDeduplicator] ✅ New event recorded');
    
    return false; // Not duplicate
  }

  // Cleanup old fingerprints to prevent memory leak
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    console.log('[EventDeduplicator] Cleanup starting, Map size:', this.fingerprints.size);

    this.fingerprints.forEach((data, fingerprint) => {
      const age = now - data.lastSeenTime;
      // Chỉ xóa fingerprints cũ hơn fingerprintRetentionTime (15s)
      if (age > this.fingerprintRetentionTime) {
        //console.log('[EventDeduplicator] Deleting old fingerprint, age:', age, 'threshold:', this.fingerprintRetentionTime);
        toDelete.push(fingerprint);
      }
    });

    toDelete.forEach(fp => this.fingerprints.delete(fp));
    
    //console.log('[EventDeduplicator] Cleanup done, deleted:', toDelete.length, 'remaining:', this.fingerprints.size);
  }

  // Clear all fingerprints (for testing)
  clear(): void {
    this.fingerprints.clear();
  }
}
