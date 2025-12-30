import { PayloadMapping } from '../../../types';

export interface IPayloadExtractor {
    /**
     * Extract data based on the mapping rule
     * @param mapping The payload mapping configuration
     * @param context Context data (Element, Request object, etc.)
     */
    extract(mapping: PayloadMapping, context?: any): any;
}
