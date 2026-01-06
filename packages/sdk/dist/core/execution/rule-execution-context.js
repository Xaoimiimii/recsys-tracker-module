/**
 * RuleExecutionContext (REC)
 *
 * Đại diện cho MỘT LẦN TRIGGER CỤ THỂ của một rule.
 * Không phải là rule config, mà là instance của một lần thực thi.
 *
 * Nguyên tắc:
 * - Mỗi trigger (click, rating, review, etc.) tạo 1 REC riêng
 * - REC theo dõi trạng thái thu thập dữ liệu
 * - REC có TIME_WINDOW để match với network requests
 * - REC có MAX_WAIT_TIME để tự cleanup nếu không hoàn thành
 */
/**
 * RuleExecutionContextManager
 * Quản lý tất cả các REC đang active
 */
export class RuleExecutionContextManager {
    constructor() {
        this.contexts = new Map();
        this.TIME_WINDOW = 3000; // 3s - Request phải xảy ra trong window này
        this.MAX_WAIT_TIME = 5000; // 5s - Tự động expire nếu quá thời gian
    }
    /**
     * Tạo REC mới cho một trigger
     */
    createContext(ruleId, requiredFields, triggerContext, onComplete) {
        const executionId = this.generateExecutionId();
        const context = {
            executionId,
            ruleId,
            triggeredAt: Date.now(),
            status: 'pending',
            requiredFields: new Set(requiredFields),
            collectedFields: new Map(),
            triggerContext,
            onComplete
        };
        // Setup auto-cleanup
        context.timeoutHandle = setTimeout(() => {
            this.expireContext(executionId);
        }, this.MAX_WAIT_TIME);
        this.contexts.set(executionId, context);
        console.log(`[REC] Created context ${executionId} for rule ${ruleId}`, {
            requiredFields,
            timeWindow: this.TIME_WINDOW,
            maxWaitTime: this.MAX_WAIT_TIME
        });
        return context;
    }
    /**
     * Lấy context theo executionId
     */
    getContext(executionId) {
        return this.contexts.get(executionId);
    }
    /**
     * Lấy tất cả pending contexts cho một rule cụ thể
     */
    getPendingContextsForRule(ruleId) {
        const results = [];
        for (const context of this.contexts.values()) {
            if (context.ruleId === ruleId && context.status === 'pending') {
                results.push(context);
            }
        }
        return results;
    }
    /**
     * Tìm context phù hợp cho một network request
     * Điều kiện:
     * - Status = pending
     * - RuleId match
     * - Request timestamp trong TIME_WINDOW
     */
    findMatchingContext(ruleId, requestTimestamp) {
        for (const context of this.contexts.values()) {
            if (context.ruleId === ruleId &&
                context.status === 'pending' &&
                requestTimestamp >= context.triggeredAt &&
                requestTimestamp <= context.triggeredAt + this.TIME_WINDOW) {
                return context;
            }
        }
        return undefined;
    }
    /**
     * Thu thập một field vào context
     */
    collectField(executionId, field, value) {
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            return;
        }
        context.collectedFields.set(field, value);
        console.log(`[REC] Collected field "${field}" for ${executionId}:`, value);
        // Check nếu đã đủ dữ liệu
        this.checkCompletion(executionId);
    }
    /**
     * Kiểm tra nếu context đã thu thập đủ dữ liệu
     */
    checkCompletion(executionId) {
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            return;
        }
        // Check nếu tất cả required fields đã có
        const allFieldsCollected = Array.from(context.requiredFields).every(field => context.collectedFields.has(field));
        if (allFieldsCollected) {
            this.completeContext(executionId);
        }
    }
    /**
     * Đánh dấu context là completed và trigger callback
     */
    completeContext(executionId) {
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            return;
        }
        context.status = 'completed';
        // Clear timeout
        if (context.timeoutHandle) {
            clearTimeout(context.timeoutHandle);
        }
        // Build payload từ collected fields
        const payload = {};
        context.collectedFields.forEach((value, key) => {
            payload[key] = value;
        });
        console.log(`[REC] ✅ Context ${executionId} completed with payload:`, payload);
        // Trigger callback
        if (context.onComplete) {
            context.onComplete(payload);
        }
        // Cleanup sau 1s (giữ một chút để debug)
        setTimeout(() => {
            this.contexts.delete(executionId);
        }, 1000);
    }
    /**
     * Đánh dấu context là expired (timeout)
     */
    expireContext(executionId) {
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            return;
        }
        context.status = 'expired';
        console.warn(`[REC] ⏱️ Context ${executionId} expired (rule ${context.ruleId})`, {
            collectedFields: Array.from(context.collectedFields.keys()),
            missingFields: Array.from(context.requiredFields).filter(f => !context.collectedFields.has(f))
        });
        // Cleanup
        setTimeout(() => {
            this.contexts.delete(executionId);
        }, 1000);
    }
    /**
     * Cleanup một context (manual)
     */
    cleanupContext(executionId) {
        const context = this.contexts.get(executionId);
        if (context && context.timeoutHandle) {
            clearTimeout(context.timeoutHandle);
        }
        this.contexts.delete(executionId);
    }
    /**
     * Get số lượng active contexts (for debugging)
     */
    getActiveCount() {
        return Array.from(this.contexts.values()).filter(c => c.status === 'pending').length;
    }
    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Clear all contexts (for testing/cleanup)
     */
    clearAll() {
        for (const context of this.contexts.values()) {
            if (context.timeoutHandle) {
                clearTimeout(context.timeoutHandle);
            }
        }
        this.contexts.clear();
    }
}
//# sourceMappingURL=rule-execution-context.js.map