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
export type RuleExecutionStatus = 'pending' | 'completed' | 'expired';
export interface RuleExecutionContext {
    /** Unique ID cho execution này (không phải ruleId) */
    executionId: string;
    /** Rule ID từ config */
    ruleId: number;
    /** Timestamp khi trigger xảy ra */
    triggeredAt: number;
    /** Trạng thái hiện tại */
    status: RuleExecutionStatus;
    /** Các field cần thu thập (từ PayloadMappings) */
    requiredFields: Set<string>;
    /** Dữ liệu đã thu thập được */
    collectedFields: Map<string, any>;
    /** Context của trigger (element, eventType, etc.) */
    triggerContext: any;
    /** Callback khi hoàn thành */
    onComplete?: (payload: Record<string, any>) => void;
    /** Timeout handler để cleanup */
    timeoutHandle?: any;
}
/**
 * RuleExecutionContextManager
 * Quản lý tất cả các REC đang active
 */
export declare class RuleExecutionContextManager {
    private contexts;
    private readonly TIME_WINDOW;
    private readonly MAX_WAIT_TIME;
    /**
     * Tạo REC mới cho một trigger
     */
    createContext(ruleId: number, requiredFields: string[], triggerContext: any, onComplete?: (payload: Record<string, any>) => void): RuleExecutionContext;
    /**
     * Lấy context theo executionId
     */
    getContext(executionId: string): RuleExecutionContext | undefined;
    /**
     * Lấy tất cả pending contexts cho một rule cụ thể
     */
    getPendingContextsForRule(ruleId: number): RuleExecutionContext[];
    /**
     * Tìm context phù hợp cho một network request
     * Điều kiện:
     * - Status = pending
     * - RuleId match
     * - Request timestamp trong TIME_WINDOW
     */
    findMatchingContext(ruleId: number, requestTimestamp: number): RuleExecutionContext | undefined;
    /**
     * Thu thập một field vào context
     */
    collectField(executionId: string, field: string, value: any): void;
    /**
     * Kiểm tra nếu context đã thu thập đủ dữ liệu
     */
    private checkCompletion;
    /**
     * Đánh dấu context là completed và trigger callback
     */
    private completeContext;
    /**
     * Đánh dấu context là expired (timeout)
     */
    private expireContext;
    /**
     * Cleanup một context (manual)
     */
    cleanupContext(executionId: string): void;
    /**
     * Get số lượng active contexts (for debugging)
     */
    getActiveCount(): number;
    /**
     * Generate unique execution ID
     */
    private generateExecutionId;
    /**
     * Clear all contexts (for testing/cleanup)
     */
    clearAll(): void;
}
//# sourceMappingURL=rule-execution-context.d.ts.map