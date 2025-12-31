import { NetworkExtractor } from "./extractors/network-extractor";
import { TrackingRule } from "../../types";
export declare class PayloadBuilder {
    private extractors;
    private elementExtractor;
    private networkExtractor;
    private storageExtractor;
    private urlExtractor;
    private requestUrlExtractor;
    private trackerConfig;
    constructor();
    private registerExtractors;
    build(context: any, rule: TrackingRule): Record<string, any>;
    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    setConfig(config: any): void;
    /**
     * Check if config has network rules and enable tracking if needed
     */
    private checkAndEnableNetworkTracking;
    /**
     * Check if config has request url rules and enable tracking if needed
     */
    private checkAndEnableRequestUrlTracking;
    /**
     * Enable network tracking
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
//# sourceMappingURL=payload-builder.d.ts.map