// Loop Guard cho Network Requests
// Detects infinite loops hoặc excessive requests đến cùng một endpoint
// Block việc gửi event nếu phát hiện hành vi lặp vô hạn (không disable rule)
export class LoopGuard {
    constructor(options) {
        this.requests = new Map();
        // Configuration
        this.maxRequestsPerSecond = 5;
        this.windowSize = 1000; // 1 second
        this.blockDuration = 60000; // block for 60 seconds
        this.cleanupInterval = 10000; // cleanup every 10s
        if ((options === null || options === void 0 ? void 0 : options.maxRequestsPerSecond) !== undefined) {
            this.maxRequestsPerSecond = options.maxRequestsPerSecond;
        }
        if ((options === null || options === void 0 ? void 0 : options.windowSize) !== undefined) {
            this.windowSize = options.windowSize;
        }
        if ((options === null || options === void 0 ? void 0 : options.blockDuration) !== undefined) {
            this.blockDuration = options.blockDuration;
        }
        // Periodic cleanup
        if (typeof window !== 'undefined') {
            setInterval(() => this.cleanup(), this.cleanupInterval);
        }
    }
    // Generate key for request tracking
    generateKey(url, method, ruleId) {
        return `${method}:${url}:${ruleId}`;
    }
    // Record a request and check if it exceeds threshold
    // Returns true if request should be BLOCKED
    checkAndRecord(url, method, ruleId) {
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
            }
            else {
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
    cleanup() {
        const now = Date.now();
        const toDelete = [];
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
    clear() {
        this.requests.clear();
    }
    // Get stats about blocked patterns
    getBlockedCount() {
        let count = 0;
        this.requests.forEach(record => {
            if (record.blocked)
                count++;
        });
        return count;
    }
}
//# sourceMappingURL=loop-guard.js.map