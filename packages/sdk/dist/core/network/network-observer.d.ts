/**
 * NetworkObserver - Passive Network Listener
 *
 * NGUYÊN TẮC:
 * 1. Init KHI SDK LOAD (không phải trong plugin)
 * 2. Luôn active và lắng nghe TẤT CẢ requests
 * 3. Chỉ xử lý request khi có REC phù hợp
 * 4. KHÔNG dispatch event (chỉ collect data vào REC)
 * 5. Passive - không can thiệp vào logic nghiệp vụ
 */
import { RuleExecutionContextManager } from '../execution/rule-execution-context';
import { TrackingRule } from '../../types';
/**
 * NetworkObserver - Singleton passive listener
 */
export declare class NetworkObserver {
    private static instance;
    private originalFetch;
    private originalXhrOpen;
    private originalXhrSend;
    private isActive;
    private recManager;
    private registeredRules;
    private userInfoMappings;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): NetworkObserver;
    /**
     * Register user info mappings từ config
     * Được gọi bởi ConfigLoader sau khi parse rules
     */
    registerUserInfoMappings(rules: TrackingRule[]): void;
    /**
     * Initialize observer với REC manager
     * PHẢI GỌI KHI SDK INIT
     */
    initialize(recManager: RuleExecutionContextManager): void;
    /**
     * Register một rule cần network data
     * Được gọi bởi PayloadBuilder khi phát hiện rule cần async data
     */
    registerRule(rule: TrackingRule): void;
    /**
     * Unregister rule (cleanup)
     */
    unregisterRule(ruleId: number): void;
    /**
     * Hook Fetch API
     */
    private hookFetch;
    /**
     * Hook XMLHttpRequest
     */
    private hookXHR;
    /**
     * Xử lý request đã intercept
     * SECURITY: Chỉ process và log khi request match với rule patterns
     * SMART: Cache user info dựa trên registered user info mappings từ config
     */
    private handleRequest;
    /**
     * Process payload mappings của rule và extract data vào REC
     */
    private processRuleMappings;
    /**
     * SMART USER INFO CACHING
     *
     * Cache user info dựa trên registered user info mappings từ config
     * Chỉ cache khi request match với patterns đã đăng ký
     *
     * @returns true nếu đã cache user info
     */
    private smartUserInfoCaching;
    /**
     * SECURITY: Tìm rules có thể match với request này
     * Check URL pattern và method TRƯỚC KHI parse body
     */
    private findPotentialMatchingRules;
    /**
     * Check nếu source là network source
     */
    private isNetworkSource;
    /**
     * Check nếu request match với pattern trong mapping
     */
    private matchesPattern;
    /**
     * Extract value từ request theo mapping config
     *
     * SMART LOGIC:
     * - Source = "RequestBody" + Method = GET → Auto extract từ ResponseBody
     * - Source = "RequestBody" + Method = POST/PUT/PATCH/DELETE → Extract từ RequestBody
     * - Source = "ResponseBody" → Luôn extract từ ResponseBody
     */
    private extractValue;
    /**
     * Extract từ request body
     */
    private extractFromRequestBody;
    /**
     * Extract từ response body
     */
    private extractFromResponseBody;
    /**
     * Extract từ request URL
     */
    private extractFromRequestUrl;
    /**
     * Parse body (JSON or text)
     */
    private parseBody;
    /**
     * Extract value by path (e.g., "data.user.id")
     */
    private extractByPath;
    /**
     * Restore original functions (for cleanup/testing)
     */
    restore(): void;
    /**
     * Check if observer is active
     */
    isObserverActive(): boolean;
    /**
     * Get registered rules count (for debugging)
     */
    getRegisteredRulesCount(): number;
}
/**
 * Helper function to get singleton instance
 */
export declare function getNetworkObserver(): NetworkObserver;
//# sourceMappingURL=network-observer.d.ts.map