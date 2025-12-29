import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
export declare class NetworkExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, context?: any): any;
    private matchesUrl;
    private traverseObject;
    private isValid;
}
//# sourceMappingURL=network-extractor.d.ts.map