import { ElementExtractor } from "./extractors/element-extractor";
import { NetworkExtractor } from "./extractors/network-extractor";
import { StorageExtractor } from "./extractors/storage-extractor";
import { UrlExtractor } from "./extractors/url-extractor";
import { RequestUrlExtractor } from "./extractors/request-url-extractor";
export class PayloadBuilder {
    constructor() {
        this.extractors = new Map();
        this.trackerConfig = null;
        this.elementExtractor = new ElementExtractor();
        this.networkExtractor = new NetworkExtractor();
        this.storageExtractor = new StorageExtractor();
        this.urlExtractor = new UrlExtractor();
        this.requestUrlExtractor = new RequestUrlExtractor();
        this.registerExtractors();
    }
    registerExtractors() {
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
    build(context, rule) {
        const payload = {};
        if (!rule || !rule.payloadMappings || rule.payloadMappings.length === 0) {
            return payload;
        }
        for (const mapping of rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            let val = null;
            // Chọn Extractor dựa trên source
            const extractor = this.extractors.get(source);
            if (extractor) {
                val = extractor.extract(mapping, context);
                console.log(`[PayloadBuilder] Extracting ${mapping.field} from ${source}:`, val);
            }
            else {
                console.warn(`[PayloadBuilder] No extractor found for source: ${source}`);
            }
            if (this.isValid(val)) {
                payload[mapping.field] = val;
            }
        }
        console.log('[PayloadBuilder] Final payload:', payload);
        return payload;
    }
    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    setConfig(config) {
        this.trackerConfig = config;
        this.checkAndEnableNetworkTracking();
        this.checkAndEnableRequestUrlTracking();
    }
    /**
     * Check if config has network rules and enable tracking if needed
     */
    checkAndEnableNetworkTracking() {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        const hasNetworkRules = this.trackerConfig.trackingRules.some((rule) => rule.payloadMappings && rule.payloadMappings.some((m) => {
            const source = (m.source || '').toLowerCase();
            // Hỗ trợ cả RequestBody và request_body format
            return source === 'request_body' || source === 'requestbody' ||
                source === 'response_body' || source === 'responsebody';
        }));
        if (hasNetworkRules && !this.networkExtractor.isTracking()) {
            console.log('[PayloadBuilder] Enabling network tracking');
            this.enableNetworkTracking();
        }
        else if (!hasNetworkRules && this.networkExtractor.isTracking()) {
            this.disableNetworkTracking();
        }
    }
    /**
     * Check if config has request url rules and enable tracking if needed
     */
    checkAndEnableRequestUrlTracking() {
        if (!this.trackerConfig || !this.trackerConfig.trackingRules)
            return;
        const hasRequestUrlRules = this.trackerConfig.trackingRules.some((rule) => rule.payloadMappings && rule.payloadMappings.some((m) => {
            const source = (m.source || '').toLowerCase();
            // Hỗ trợ cả RequestUrl và request_url format
            return source === 'request_url' || source === 'requesturl';
        }));
        if (hasRequestUrlRules) {
            console.log('[PayloadBuilder] Enabling request URL tracking');
            this.requestUrlExtractor.enableTracking();
        }
        else {
            this.requestUrlExtractor.disableTracking();
        }
    }
    /**
     * Enable network tracking
     */
    enableNetworkTracking() {
        if (!this.trackerConfig) {
            console.warn('[PayloadBuilder] Cannot enable network tracking: config not set');
            return;
        }
        this.networkExtractor.enableTracking(this.trackerConfig, (rule, extractedData, context) => {
            // Callback when network request matches a rule
            // This can be extended to dispatch events or perform other actions
            console.log('[PayloadBuilder] Network match:', {
                rule: rule.name,
                data: extractedData,
                url: context.url,
                method: context.method
            });
        });
    }
    /**
     * Disable network tracking
     */
    disableNetworkTracking() {
        this.networkExtractor.disableTracking();
    }
    /**
     * Check if network tracking is currently active
     */
    isNetworkTrackingActive() {
        return this.networkExtractor.isTracking();
    }
    /**
     * Get the network extractor instance for advanced usage
     */
    getNetworkExtractor() {
        return this.networkExtractor;
    }
    isValid(val) {
        return val !== null && val !== undefined && val !== '';
    }
}
//# sourceMappingURL=payload-builder.js.map