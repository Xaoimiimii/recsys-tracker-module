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
        console.log('[REC] Creating new context - executionId:', executionId, 'ruleId:', ruleId, 'requiredFields:', requiredFields);
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
            console.log('[REC] Context timeout reached for executionId:', executionId);
            this.expireContext(executionId);
        }, this.MAX_WAIT_TIME);
        this.contexts.set(executionId, context);
        console.log('[REC] Context created successfully, total active contexts:', this.contexts.size);
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
        console.log('[REC] collectField - executionId:', executionId, 'field:', field, 'value:', value);
        const context = this.contexts.get(executionId);
        if (!context) {
            console.error('[REC] Context not found for executionId:', executionId);
            return;
        }
        if (context.status !== 'pending') {
            console.warn('[REC] Context status is not pending:', context.status);
            return;
        }
        context.collectedFields.set(field, value);
        console.log('[REC] Field collected, total collected fields:', context.collectedFields.size, '/', context.requiredFields.size);
        console.log('[REC] Collected fields:', Array.from(context.collectedFields.keys()));
        console.log('[REC] Required fields:', Array.from(context.requiredFields));
        // Check nếu đã đủ dữ liệu
        this.checkCompletion(executionId);
    }
    /**
     * Kiểm tra nếu context đã thu thập đủ dữ liệu
     */
    checkCompletion(executionId) {
        console.log('[REC] checkCompletion - executionId:', executionId);
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            console.log('[REC] Context not found or not pending');
            return;
        }
        // Check nếu tất cả required fields đã có
        const requiredFieldsArray = Array.from(context.requiredFields);
        const missingFields = requiredFieldsArray.filter(field => !context.collectedFields.has(field));
        console.log('[REC] Missing fields:', missingFields);
        const allFieldsCollected = missingFields.length === 0;
        console.log('[REC] All fields collected?', allFieldsCollected);
        if (allFieldsCollected) {
            console.log('[REC] All required fields collected, completing context');
            this.completeContext(executionId);
        }
        else {
            console.log('[REC] Still waiting for fields:', missingFields);
        }
    }
    /**
     * Đánh dấu context là completed và trigger callback
     */
    completeContext(executionId) {
        console.log('[REC] completeContext - executionId:', executionId);
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            console.log('[REC] Context not found or not pending');
            return;
        }
        context.status = 'completed';
        console.log('[REC] Context marked as completed');
        // Clear timeout
        if (context.timeoutHandle) {
            clearTimeout(context.timeoutHandle);
        }
        // Build payload từ collected fields
        const payload = {};
        context.collectedFields.forEach((value, key) => {
            payload[key] = value;
        });
        console.log('[REC] Built payload from collected fields:', payload);
        // Trigger callback
        if (context.onComplete) {
            console.log('[REC] Triggering onComplete callback with payload');
            context.onComplete(payload);
        }
        else {
            console.warn('[REC] No onComplete callback defined');
        }
        // Cleanup sau 1s (giữ một chút để debug)
        setTimeout(() => {
            this.contexts.delete(executionId);
            console.log('[REC] Context cleaned up, remaining contexts:', this.contexts.size);
        }, 1000);
    }
    /**
     * Đánh dấu context là expired (timeout)
     */
    expireContext(executionId) {
        console.log('[REC] expireContext - executionId:', executionId);
        const context = this.contexts.get(executionId);
        if (!context || context.status !== 'pending') {
            console.log('[REC] Context not found or not pending');
            return;
        }
        context.status = 'expired';
        console.warn('[REC] Context expired - collected:', context.collectedFields.size, 'required:', context.requiredFields.size);
        console.warn('[REC] Missing fields:', Array.from(context.requiredFields).filter(f => !context.collectedFields.has(f)));
        // Cleanup
        setTimeout(() => {
            this.contexts.delete(executionId);
            console.log('[REC] Expired context cleaned up, remaining contexts:', this.contexts.size);
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