import { ElementExtractor } from "./extractors/element-extractor";
import { NetworkExtractor } from "./extractors/network-extractor";
import { StorageExtractor } from "./extractors/storage-extractor";
import { UrlExtractor } from "./extractors/url-extractor";
import { RequestUrlExtractor } from "./extractors/request-url-extractor";
export class PayloadBuilder {
    constructor() {
        this.extractors = new Map();
        this.trackerConfig = null;
        // NEW: Quản lý các pending collections (đang chờ thu thập dữ liệu)
        this.pendingCollections = new Map();
        this.elementExtractor = new ElementExtractor();
        this.networkExtractor = new NetworkExtractor();
        this.storageExtractor = new StorageExtractor();
        this.urlExtractor = new UrlExtractor();
        this.requestUrlExtractor = new RequestUrlExtractor();
        this.registerExtractors();
        // Pass reference to self so extractors can notify when data is ready
        this.networkExtractor.setPayloadBuilder(this);
        this.requestUrlExtractor.setPayloadBuilder(this);
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
        console.log('[PayloadBuilder.build] Rule:', rule.name, 'Mappings:', rule.payloadMappings);
        const payload = {};
        if (!rule || !rule.payloadMappings || rule.payloadMappings.length === 0) {
            console.warn('[PayloadBuilder.build] No payload mappings');
            return payload;
        }
        for (const mapping of rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            console.log('[PayloadBuilder.build] Processing mapping:', {
                field: mapping.field,
                source: source,
                value: mapping.value
            });
            let val = null;
            // Chọn Extractor dựa trên source
            const extractor = this.extractors.get(source);
            if (extractor) {
                val = extractor.extract(mapping, context);
                console.log('[PayloadBuilder.build] Extracted value:', val, 'for field:', mapping.field);
            }
            else {
                console.warn('[PayloadBuilder.build] No extractor found for source:', source);
            }
            if (this.isValid(val)) {
                payload[mapping.field] = val;
            }
            else {
                console.warn('[PayloadBuilder.build] Invalid value, not adding to payload');
            }
        }
        console.log('[PayloadBuilder.build] Final payload:', payload);
        return payload;
    }
    /**
     * NEW FLOW: Bắt đầu thu thập dữ liệu cho một rule
     * Được gọi bởi tracking plugins khi phát hiện trigger event
     *
     * @param context - Context của trigger event (element, timestamp, etc.)
     * @param rule - Tracking rule cần thu thập dữ liệu
     * @param callback - Callback được gọi khi đã thu thập đủ dữ liệu
     */
    startCollection(context, rule, callback) {
        console.log('[PayloadBuilder] startCollection for rule:', rule.name);
        // Phân tích xem cần thu thập những field nào
        const requiredFields = this.analyzeRequiredFields(rule);
        const hasNetworkFields = this.hasNetworkFields(rule);
        console.log('[PayloadBuilder] Required fields:', Array.from(requiredFields));
        console.log('[PayloadBuilder] Has network fields:', hasNetworkFields);
        // Tạo pending collection
        const pending = {
            rule,
            context: {
                ...context,
                triggerTimestamp: Date.now() // Lưu timestamp của trigger để so sánh với requests
            },
            timestamp: Date.now(),
            callback,
            collectedData: new Map(),
            requiredFields,
            networkCaptured: false
        };
        this.pendingCollections.set(rule.id, pending);
        console.log('[PayloadBuilder] Created pending collection for rule:', rule.id);
        // Nếu cần network data → Enable interceptor NGAY LÚC NÀY
        if (hasNetworkFields) {
            console.log('[PayloadBuilder] Enabling network interceptor for rule:', rule.id);
            this.enableNetworkInterceptorForRule(rule);
        }
        // Thu thập non-network data ngay (localStorage, cookie, element, url, etc.)
        this.collectNonNetworkData(pending);
        // Check xem đã đủ chưa (trường hợp không cần network data)
        this.checkAndComplete(rule.id);
    }
    /**
     * LEGACY: Build payload and call back with the result (OLD FLOW - Deprecated)
     * Used by tracking plugins (click, rating, review, scroll, pageview)
     * NOT used by network plugin
     *
     * @deprecated Use startCollection() instead for better async handling
     */
    buildWithCallback(context, rule, callback) {
        console.log('[PayloadBuilder] buildWithCallback (LEGACY) called for rule:', rule.name);
        const payload = this.build(context, rule);
        console.log('[PayloadBuilder] Payload built:', payload);
        callback(payload, rule, context);
        console.log('[PayloadBuilder] Callback executed');
    }
    /**
     * Set tracker configuration and check if network tracking should be enabled
     */
    setConfig(config) {
        this.trackerConfig = config;
        // REMOVED: Không enable network tracking lúc init nữa
        // Network tracking sẽ được enable on-demand khi có trigger event
        // this.checkAndEnableNetworkTracking();
        // this.checkAndEnableRequestUrlTracking();
        console.log('[PayloadBuilder] Config set, network tracking will be enabled on-demand');
    }
    /**
     * NEW: Phân tích xem rule cần thu thập những field nào
     */
    analyzeRequiredFields(rule) {
        const fields = new Set();
        if (rule.payloadMappings) {
            for (const mapping of rule.payloadMappings) {
                fields.add(mapping.field);
            }
        }
        return fields;
    }
    /**
     * NEW: Check xem rule có field nào cần network data không
     */
    hasNetworkFields(rule) {
        if (!rule.payloadMappings)
            return false;
        return rule.payloadMappings.some((m) => {
            const source = (m.source || '').toLowerCase();
            return [
                'requestbody',
                'responsebody',
                'request_body',
                'response_body',
                'requesturl',
                'request_url'
            ].includes(source);
        });
    }
    /**
     * NEW: Enable network interceptor cho một rule cụ thể
     */
    enableNetworkInterceptorForRule(rule) {
        var _a, _b;
        console.log('[PayloadBuilder] Enabling network interceptor for rule:', rule.name);
        // Enable RequestUrl tracking
        const hasRequestUrlMappings = (_a = rule.payloadMappings) === null || _a === void 0 ? void 0 : _a.some((m) => {
            const source = (m.source || '').toLowerCase();
            return source === 'requesturl' || source === 'request_url';
        });
        if (hasRequestUrlMappings) {
            this.requestUrlExtractor.enableTracking();
        }
        // Enable NetworkExtractor tracking
        const hasRequestBodyMappings = (_b = rule.payloadMappings) === null || _b === void 0 ? void 0 : _b.some((m) => {
            const source = (m.source || '').toLowerCase();
            return source === 'requestbody' || source === 'request_body';
        });
        if (hasRequestBodyMappings) {
            if (!this.trackerConfig) {
                console.warn('[PayloadBuilder] Cannot enable network tracking: config not set');
                return;
            }
            // Only enable if not already enabled
            if (!this.networkExtractor.isTracking()) {
                this.networkExtractor.enableTracking(this.trackerConfig, (matchedRule, extractedData, _context) => {
                    console.log('[PayloadBuilder] Network match callback:', {
                        rule: matchedRule.name,
                        data: extractedData
                    });
                    // This callback can be used for additional logic if needed
                });
            }
        }
    }
    /**
     * NEW: Thu thập non-network data ngay lập tức
     */
    collectNonNetworkData(pending) {
        console.log('[PayloadBuilder] Collecting non-network data for rule:', pending.rule.name);
        for (const mapping of pending.rule.payloadMappings) {
            const source = (mapping.source || '').toLowerCase();
            // Skip network sources (sẽ được xử lý bởi interceptor)
            if ([
                'requestbody',
                'responsebody',
                'request_body',
                'response_body',
                'requesturl',
                'request_url'
            ].includes(source)) {
                console.log('[PayloadBuilder] Skipping network source:', source, 'for field:', mapping.field);
                continue;
            }
            // Thu thập data từ non-network sources
            const extractor = this.extractors.get(source);
            if (extractor) {
                const val = extractor.extract(mapping, pending.context);
                if (this.isValid(val)) {
                    pending.collectedData.set(mapping.field, val);
                    console.log('[PayloadBuilder] Collected:', mapping.field, '=', val);
                }
            }
        }
    }
    /**
     * NEW: Được gọi bởi NetworkExtractor/RequestUrlExtractor khi có network data
     */
    notifyNetworkData(ruleId, field, value) {
        const pending = this.pendingCollections.get(ruleId);
        if (!pending) {
            console.warn('[PayloadBuilder] No pending collection for rule:', ruleId);
            return;
        }
        console.log('[PayloadBuilder] Network data received for rule:', ruleId, 'field:', field, 'value:', value);
        pending.collectedData.set(field, value);
        pending.networkCaptured = true;
        // Check xem đã đủ dữ liệu chưa
        this.checkAndComplete(ruleId);
    }
    /**
     * NEW: Check xem đã thu thập đủ dữ liệu chưa và complete nếu đủ
     */
    checkAndComplete(ruleId) {
        const pending = this.pendingCollections.get(ruleId);
        if (!pending)
            return;
        // Check timeout (5 giây)
        if (Date.now() - pending.timestamp > 5000) {
            console.warn('[PayloadBuilder] Timeout waiting for data for rule:', ruleId);
            this.completePendingCollection(ruleId, true); // Complete with timeout flag
            return;
        }
        // Check xem đã có tất cả required fields chưa
        const collectedFields = Array.from(pending.collectedData.keys());
        const missingFields = Array.from(pending.requiredFields).filter(field => !pending.collectedData.has(field));
        console.log('[PayloadBuilder] Check complete for rule:', ruleId);
        console.log('[PayloadBuilder] Collected fields:', collectedFields);
        console.log('[PayloadBuilder] Missing fields:', missingFields);
        // Nếu còn thiếu network fields nhưng đã bắt được network request → wait
        const hasNetworkFields = this.hasNetworkFields(pending.rule);
        if (hasNetworkFields && !pending.networkCaptured) {
            console.log('[PayloadBuilder] Waiting for network data...');
            // Set timeout để tự động complete sau 5s
            setTimeout(() => {
                if (this.pendingCollections.has(ruleId)) {
                    console.warn('[PayloadBuilder] Network timeout for rule:', ruleId);
                    this.completePendingCollection(ruleId, true);
                }
            }, 5000);
            return;
        }
        // Nếu đã đủ dữ liệu hoặc đã timeout → Complete
        if (missingFields.length === 0 || pending.networkCaptured) {
            this.completePendingCollection(ruleId, false);
        }
    }
    /**
     * NEW: Hoàn thành việc thu thập và gọi callback
     */
    completePendingCollection(ruleId, isTimeout) {
        const pending = this.pendingCollections.get(ruleId);
        if (!pending)
            return;
        console.log('[PayloadBuilder] Completing collection for rule:', ruleId, 'timeout:', isTimeout);
        // Build final payload
        const finalPayload = {};
        pending.collectedData.forEach((value, key) => {
            finalPayload[key] = value;
        });
        console.log('[PayloadBuilder] Final payload:', finalPayload);
        // Cleanup
        this.pendingCollections.delete(ruleId);
        // Disable network interceptor nếu không còn pending nào
        if (this.pendingCollections.size === 0) {
            console.log('[PayloadBuilder] No more pending collections, disabling network tracking');
            this.disableNetworkTracking();
        }
        // Call callback
        pending.callback(finalPayload);
    }
    /**
     * LEGACY: Enable network tracking (kept for backward compatibility)
     */
    enableNetworkTracking() {
        console.warn('[PayloadBuilder] enableNetworkTracking() is deprecated. Network tracking is now on-demand.');
    }
    /**
     * Disable network tracking
     */
    disableNetworkTracking() {
        this.networkExtractor.disableTracking();
        this.requestUrlExtractor.disableTracking();
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