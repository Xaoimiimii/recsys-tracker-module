import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';

export class UrlExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, _context?: any): string | null {
        try {
            const urlPart = mapping.urlPart || '';
            const urlPartValue = mapping.urlPartValue;

            if (!urlPart) return null;

            const currentUrl = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');

            // 1. Query Param
            if (urlPart === 'query_param') {
                if (!urlPartValue) return null;
                return currentUrl.searchParams.get(urlPartValue);
            }

            // 2. Pathname Segment
            if (urlPart === 'pathname') {
                if (!urlPartValue) return null;
                const index = parseInt(urlPartValue, 10);
                if (isNaN(index)) return null;

                const segments = currentUrl.pathname.split('/').filter(s => s.length > 0);

                // Adjust for 0-index or 1-index based on convention. 
                // Assuming 0-index for internal array, but user might pass 1-based index? 
                // Let's assume 0-indexed based on typical dev usage, or handle bounds.
                if (index >= 0 && index < segments.length) {
                    return segments[index];
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}
