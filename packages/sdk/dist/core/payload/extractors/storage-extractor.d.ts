import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
export declare class StorageExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, _context?: any): string | null;
    private extractFromStorage;
    private extractFromCookie;
    private getNestedValue;
}
//# sourceMappingURL=storage-extractor.d.ts.map