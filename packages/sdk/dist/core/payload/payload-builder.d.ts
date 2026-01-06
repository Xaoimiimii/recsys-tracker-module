/**
 * PayloadBuilder - The Orchestrator
 *
 * TRÁCH NHIỆM:
 * 1. Điều phối toàn bộ quá trình build payload
 * 2. Biết rule cần field nào
 * 3. Biết field đó lấy từ đâu (sync hay async)
 * 4. Là NƠI DUY NHẤT chốt payload
 * 5. Quản lý RuleExecutionContext
 *
 * FLOW:
 * 1. Plugin trigger → gọi handleTrigger()
 * 2. Phân loại sync/async sources
 * 3. Resolve sync sources ngay
 * 4. Đăng ký async sources với NetworkObserver
 * 5. Khi đủ dữ liệu → dispatch event
 */
import { TrackingRule } from '../../types';
import { RuleExecutionContextManager } from '../execution/rule-execution-context';
/**
 * PayloadBuilder v2 - Full Orchestrator
 */
export declare class PayloadBuilder {
    private recManager;
    private networkObserver;
    constructor();
    /**
     * Main entry point - được gọi bởi tracking plugins
     *
     * @param rule - Tracking rule được trigger
     * @param triggerContext - Context của trigger (element, eventType, etc.)
     * @param onComplete - Callback khi payload sẵn sàng để dispatch
     */
    handleTrigger(rule: TrackingRule, triggerContext: any, onComplete: (payload: Record<string, any>) => void): void;
    /**
     * Phân loại mappings thành sync và async
     */
    private classifyMappings;
    /**
     * Xác định source type
     */
    private getSourceType;
    /**
     * Resolve tất cả sync mappings
     */
    private resolveSyncMappings;
    /**
     * Resolve một sync mapping
     */
    private resolveSyncMapping;
    /**
     * Extract từ element
     */
    private extractFromElement;
    /**
     * Get value từ element (text, value, attribute)
     */
    private getElementValue;
    /**
     * Extract từ cookie
     */
    private extractFromCookie;
    /**
     * Extract từ localStorage
     */
    private extractFromLocalStorage;
    /**
     * Extract từ sessionStorage
     */
    private extractFromSessionStorage;
    /**
     * Extract từ page URL
     */
    private extractFromPageUrl;
    /**
     * Extract từ LoginDetector (custom integration)
     */
    private extractFromLoginDetector;
    /**
     * Check if value is valid (not null, undefined, empty string)
     */
    private isValidValue;
    /**
     * Get REC manager (for external access if needed)
     */
    getRECManager(): RuleExecutionContextManager;
    /**
     * Get active contexts count (for debugging)
     */
    getActiveContextsCount(): number;
}
//# sourceMappingURL=payload-builder.d.ts.map