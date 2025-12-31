import { IRatingResult } from "../interfaces/rating-types";
export declare class RatingUtils {
    /**
     * Hàm Main: Phân tích DOM để lấy rating
     */
    static processRating(container: Element, triggerElement: Element, eventType: 'submit' | 'click'): IRatingResult;
    private static extractValueFromTarget;
    private static extractValueFromContainerState;
    private static extractReviewText;
    private static detectMaxScale;
    private static detectBinaryContext;
    private static isPositiveAction;
    private static normalizeScore;
}
//# sourceMappingURL=rating-utils.d.ts.map