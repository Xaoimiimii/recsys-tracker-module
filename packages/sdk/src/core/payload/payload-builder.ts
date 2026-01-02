import { IPayloadExtractor } from "./extractors/payload-extractor.interface";
import { ElementExtractor } from "./extractors/element-extractor";
import { NetworkExtractor } from "./extractors/network-extractor";
import { StorageExtractor } from "./extractors/storage-extractor";
import { UrlExtractor } from "./extractors/url-extractor";
import { RequestUrlExtractor } from "./extractors/request-url-extractor";
import { TrackingRule, PayloadMapping } from "../../types";

export class PayloadBuilder {
    private extractors: Map<string, IPayloadExtractor> = new Map();
    private elementExtractor: ElementExtractor;
    private networkExtractor: NetworkExtractor;
    private storageExtractor: StorageExtractor;
    private urlExtractor: UrlExtractor;
    private requestUrlExtractor: RequestUrlExtractor;
    private trackerConfig: any = null;

    constructor() {
        this.elementExtractor = new ElementExtractor();
        this.networkExtractor = new NetworkExtractor();
        this.storageExtractor = new StorageExtractor();
        this.urlExtractor = new UrlExtractor();
        this.requestUrlExtractor = new RequestUrlExtractor();

        this.registerExtractors();
    }

    private registerExtractors(): void {
        // Element
        this.extractors.set('element', this.elementExtractor);

        // Network
        this.extractors.set('requestbody', this.networkExtractor);

        // Request Url
        this.extractors.set('requesturl', this.requestUrlExtractor);

        // Url
        this.extractors.set('url', this.urlExtractor);

        // Storage
        this.extractors.set('cookie', this.storageExtractor);
        this.extractors.set('localstorage', this.storageExtractor);
        this.extractors.set('sessionstorage', this.storageExtractor);
    }

    // Tạo payload dựa trên rule và context
    public build(context: any, rule: TrackingRule): Record<string, any> {
        const payload: Record<string, any> = {};

        if (!rule || !rule.payloadMappings || rule.payloadMappings.length === 0) {
            return payload;
        }

        for (const mapping of rule.payloadMappings as PayloadMapping[]) {
            const source = (mapping.source || '').toLowerCase();
            let val = null;

            // Chọn Extractor dựa trên source
            const extractor = this.extractors.get(source);
            if (extractor) {
                val = extractor.extract(mapping, context);
            }

            if (this.isValid(val)) {
                payload[mapping.field] = val;
            }
        }

        return payload;
    }

    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    public setConfig(config: any): void {
        this.trackerConfig = config;
        this.checkAndEnableNetworkTracking();
        this.checkAndEnableRequestUrlTracking();
    }

    /**
     * Check if config has network rules and enable tracking if needed
     */
    private checkAndEnableNetworkTracking(): void {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules) return;

        const hasNetworkRules = this.trackerConfig.trackingRules.some((rule: any) =>
            rule.payloadMappings && rule.payloadMappings.some((m: any) => {
                const source = (m.source || '').toLowerCase();
                // Hỗ trợ cả RequestBody và request_body format
                return source === 'request_body' || source === 'requestbody' || 
                       source === 'response_body' || source === 'responsebody';
            })
        );

        if (hasNetworkRules && !this.networkExtractor.isTracking()) {
            this.enableNetworkTracking();
        } else if (!hasNetworkRules && this.networkExtractor.isTracking()) {
            this.disableNetworkTracking();
        }
    }

    /**
     * Check if config has request url rules and enable tracking if needed
     */
    private checkAndEnableRequestUrlTracking(): void {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules) return;

        const hasRequestUrlRules = this.trackerConfig.trackingRules.some((rule: any) =>
            rule.payloadMappings && rule.payloadMappings.some((m: any) => {
                const source = (m.source || '').toLowerCase();
                // Hỗ trợ cả RequestUrl và request_url format
                return source === 'request_url' || source === 'requesturl';
            })
        );

        if (hasRequestUrlRules) {
            this.requestUrlExtractor.enableTracking();
        } else {
            this.requestUrlExtractor.disableTracking();
        }
    }

    /**
     * Enable network tracking
     */
    public enableNetworkTracking(): void {
        if (!this.trackerConfig) {
            console.warn('[PayloadBuilder] Cannot enable network tracking: config not set');
            return;
        }

        this.networkExtractor.enableTracking(
            this.trackerConfig,
            (rule, extractedData, context) => {
                // Callback when network request matches a rule
                // This can be extended to dispatch events or perform other actions
                console.log('[PayloadBuilder] Network match:', {
                    rule: rule.name,
                    data: extractedData,
                    url: context.url,
                    method: context.method
                });
            }
        );
    }

    /**
     * Disable network tracking
     */
    public disableNetworkTracking(): void {
        this.networkExtractor.disableTracking();
    }

    /**
     * Check if network tracking is currently active
     */
    public isNetworkTrackingActive(): boolean {
        return this.networkExtractor.isTracking();
    }

    /**
     * Get the network extractor instance for advanced usage
     */
    public getNetworkExtractor(): NetworkExtractor {
        return this.networkExtractor;
    }

    private isValid(val: any): boolean {
        return val !== null && val !== undefined && val !== '';
    }
}
