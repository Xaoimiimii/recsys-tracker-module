import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
import { PathMatcher } from '../../utils/path-matcher';

export class NetworkExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, context?: any): any {
        if (!context) return null;

        // Validate Context Type mapping if needed, or assume caller provides correct context
        // Check if mapping matches context URL (basic validation)
        if (mapping.requestUrlPattern && context.url) {
            if (!this.matchesUrl(context.url, mapping.requestUrlPattern)) {
                return null;
            }
        }

        const source = (mapping.source || '').toLowerCase();
        const path = mapping.value || mapping.requestBodyPath; // Backward compat or direct value

        if (!path) return null;

        if (source === 'requestbody' || source === 'request_body') {
            return this.traverseObject(context.reqBody, path);
        }

        if (source === 'responsebody' || source === 'response_body') {
            return this.traverseObject(context.resBody, path);
        }

        if (source === 'network_request') {
            // Smart inference if source is generic 'network_request'
            // Try Request first, then Response? Or based on Method?
            // User logic: "Logic similar to tracker.js 'inferSource'..."

            let val = this.traverseObject(context.reqBody, path);
            if (this.isValid(val)) return val;

            val = this.traverseObject(context.resBody, path);
            if (this.isValid(val)) return val;
        }

        return null;
    }

    private matchesUrl(url: string, pattern: string): boolean {
        return PathMatcher.match(url, pattern);
    }

    private traverseObject(obj: any, path: string): any {
        if (!obj) return null;
        try {
            const keys = path.split('.');
            let current = obj;
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return null;
                }
            }
            return (typeof current === 'object') ? JSON.stringify(current) : current;
        } catch {
            return null;
        }
    }

    private isValid(val: any): boolean {
        return val !== null && val !== undefined && val !== '';
    }
}
