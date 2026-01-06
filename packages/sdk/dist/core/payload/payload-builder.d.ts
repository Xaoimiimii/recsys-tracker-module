import { NetworkExtractor } from "./extractors/network-extractor";
import { TrackingRule } from "../../types";
interface PendingCollection {
    rule: TrackingRule;
    context: any;
    timestamp: number;
    callback: (payload: Record<string, any>) => void;
    collectedData: Map<string, any>;
    requiredFields: Set<string>;
    networkCaptured: boolean;
}
export declare class PayloadBuilder {
    private extractors;
    private elementExtractor;
    private networkExtractor;
    private storageExtractor;
    private urlExtractor;
    private requestUrlExtractor;
    private trackerConfig;
    pendingCollections: Map<number, PendingCollection>;
    constructor();
    private registerExtractors;
    build(context: any, rule: TrackingRule): Record<string, any>;
    /**
     * NEW FLOW: Bắt đầu thu thập dữ liệu cho một rule
     * Được gọi bởi tracking plugins khi phát hiện trigger event
     *
     * @param context - Context của trigger event (element, timestamp, etc.)
     * @param rule - Tracking rule cần thu thập dữ liệu
     * @param callback - Callback được gọi khi đã thu thập đủ dữ liệu
     */
    startCollection(context: any, rule: TrackingRule, callback: (payload: Record<string, any>) => void): void;
    /**
     * LEGACY: Build payload and call back with the result (OLD FLOW - Deprecated)
     * Used by tracking plugins (click, rating, review, scroll, pageview)
     * NOT used by network plugin
     *
     * @deprecated Use startCollection() instead for better async handling
     */
    buildWithCallback(context: any, rule: TrackingRule, callback: (payload: Record<string, any>, rule: TrackingRule, context: any) => void): void;
    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    setConfig(config: any): void;
    /**
     * NEW: Phân tích xem rule cần thu thập những field nào
     */
    private analyzeRequiredFields;
    /**
     * NEW: Check xem rule có field nào cần network data không
     */
    private hasNetworkFields;
    /**
     * NEW: Enable network interceptor cho một rule cụ thể
     */
    private enableNetworkInterceptorForRule;
    /**
     * NEW: Thu thập non-network data ngay lập tức
     */
    private collectNonNetworkData;
    /**
     * NEW: Được gọi bởi NetworkExtractor/RequestUrlExtractor khi có network data
     */
    notifyNetworkData(ruleId: number, field: string, value: any): void;
    /**
     * NEW: Check xem đã thu thập đủ dữ liệu chưa và complete nếu đủ
     */
    checkAndComplete(ruleId: number): void;
    /**
     * NEW: Hoàn thành việc thu thập và gọi callback
     */
    private completePendingCollection;
    /**
     * LEGACY: Enable network tracking (kept for backward compatibility)
     */
    enableNetworkTracking(): void;
    /**
     * Disable network tracking
     */
    disableNetworkTracking(): void;
    /**
     * Check if network tracking is currently active
     */
    isNetworkTrackingActive(): boolean;
    /**
     * Get the network extractor instance for advanced usage
     */
    getNetworkExtractor(): NetworkExtractor;
    private isValid;
}
export {};
//# sourceMappingURL=payload-builder.d.ts.map