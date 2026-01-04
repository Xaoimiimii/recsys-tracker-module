import { IPayloadExtractor } from './payload-extractor.interface';
import { PayloadMapping } from '../../../types';
export declare class ElementExtractor implements IPayloadExtractor {
    extract(mapping: PayloadMapping, context?: any): string | null;
    private getValueFromElement;
    private findClosestBySelector;
}
//# sourceMappingURL=element-extractor.d.ts.map