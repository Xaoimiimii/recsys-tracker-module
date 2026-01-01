// Loop Guard cho Network Requests
// Detects infinite loops hoặc excessive requests đến cùng một endpoint
// Block việc gửi event nếu phát hiện hành vi lặp vô hạn (không disable rule)

interface RequestRecord {
  count: number;
  firstSeen: number;
  lastSeen: number;
  blocked: boolean; // Track if this request pattern is being blocked
  blockedAt?: number; // When it was blocked
}

export class LoopGuard {
  private requests: Map<string, RequestRecord> = new Map();
  
  // Configuration
  private maxRequestsPerSecond: number = 5;
  private windowSize: number = 1000; // 1 second
  private blockDuration: number = 60000; // block for 60 seconds
  private cleanupInterval: number = 10000; // cleanup every 10s

  constructor(options?: {
    maxRequestsPerSecond?: number;
    windowSize?: number;
    blockDuration?: number;
  }) {
    if (options?.maxRequestsPerSecond !== undefined) {
      this.maxRequestsPerSecond = options.maxRequestsPerSecond;
    }
    if (options?.windowSize !== undefined) {
      this.windowSize = options.windowSize;
    }
    if (options?.blockDuration !== undefined) {
      this.blockDuration = options.blockDuration;
    }

    // Periodic cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  // Generate key for request tracking
  private generateKey(
    url: string,
    method: string,
    ruleId: number
  ): string {
    return `${method}:${url}:${ruleId}`;
  }

  // Record a request and check if it exceeds threshold
  // Returns true if request should be BLOCKED
  checkAndRecord(
    url: string,
    method: string,
    ruleId: number
  ): boolean {
    const key = this.generateKey(url, method, ruleId);
    const now = Date.now();

    let record = this.requests.get(key);
    
    if (!record) {
      // First request
      this.requests.set(key, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        blocked: false
      });
      return false; // Allow request
    }

    // Check if this request pattern is currently blocked
    if (record.blocked && record.blockedAt) {
      if (now - record.blockedAt < this.blockDuration) {
        return true; // Still blocked
      } else {
        // Unblock and reset
        record.blocked = false;
        record.blockedAt = undefined;
        record.count = 1;
        record.firstSeen = now;
        record.lastSeen = now;
        return false; // Allow request
      }
    }

    // Check if we're still in the same window
    const timeElapsed = now - record.firstSeen;

    if (timeElapsed > this.windowSize) {
      // Reset window
      record.count = 1;
      record.firstSeen = now;
      record.lastSeen = now;
      return false; // Allow request
    }

    // Increment count
    record.count++;
    record.lastSeen = now;

    // Check threshold
    const requestsPerSecond = (record.count / timeElapsed) * 1000;

    if (requestsPerSecond > this.maxRequestsPerSecond) {
      // Abuse detected! Block this request pattern temporarily
      record.blocked = true;
      record.blockedAt = now;
      return true; // Block this event
    }

    return false; // Allow request
  }

  // Cleanup old records
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    // Cleanup request records
    this.requests.forEach((record, key) => {
      // Delete records that haven't been seen for a while and aren't blocked
      if (!record.blocked && now - record.lastSeen > this.windowSize * 2) {
        toDelete.push(key);
      }
      // Delete blocked records after block duration expires
      if (record.blocked && record.blockedAt && now - record.blockedAt > this.blockDuration * 2) {
        toDelete.push(key);
      }
    });

    toDelete.forEach(key => this.requests.delete(key));
  }

  // Clear all records (for testing)
  clear(): void {
    this.requests.clear();
  }

  // Get stats about blocked patterns
  getBlockedCount(): number {
    let count = 0;
    this.requests.forEach(record => {
      if (record.blocked) count++;
    });
    return count;
  }
}
