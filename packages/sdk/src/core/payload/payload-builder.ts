import { IPayloadExtractor } from "./extractors/payload-extractor.interface";
import { ElementExtractor } from "./extractors/element-extractor";
import { NetworkExtractor } from "./extractors/network-extractor";
import { StorageExtractor } from "./extractors/storage-extractor";
import { UrlExtractor } from "./extractors/url-extractor";
import { TrackingRule, PayloadMapping } from "../../types";

export class PayloadBuilder {
    private extractors: Map<string, IPayloadExtractor> = new Map();
    private elementExtractor: ElementExtractor;
    private networkExtractor: NetworkExtractor;
    private storageExtractor: StorageExtractor;
    private urlExtractor: UrlExtractor;

    // Singleton / Shared instances
    constructor() {
        this.elementExtractor = new ElementExtractor();
        this.networkExtractor = new NetworkExtractor();
        this.storageExtractor = new StorageExtractor();
        this.urlExtractor = new UrlExtractor();

        this.registerExtractors();
    }

    private registerExtractors() {
        // Element
        this.extractors.set('element', this.elementExtractor);

        // Network
        this.extractors.set('request_body', this.networkExtractor);

        // Url
        this.extractors.set('url', this.urlExtractor);

        // Storage
        this.extractors.set('cookie', this.storageExtractor);
        this.extractors.set('local_storage', this.storageExtractor);
        this.extractors.set('session_storage', this.storageExtractor);
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

    private isValid(val: any): boolean {
        return val !== null && val !== undefined && val !== '';
    }
}
