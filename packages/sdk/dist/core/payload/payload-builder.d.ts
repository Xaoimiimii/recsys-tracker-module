import { TrackingRule } from "../../types";
export declare class PayloadBuilder {
    private extractors;
    private elementExtractor;
    private networkExtractor;
    private storageExtractor;
    private urlExtractor;
    constructor();
    private registerExtractors;
    build(context: any, rule: TrackingRule): Record<string, any>;
    private isValid;
}
//# sourceMappingURL=payload-builder.d.ts.map