/**
 * Utility to normalize rating values to a standard 1-5 scale.
 */
export declare class RatingNormalizer {
    /**
     * Normalizes a rating value to a 1-5 scale.
     * @param value The raw rating value detected.
     * @param container The container element of the rating widget (for context detection).
     * @param maxRating Optional manual max rating override.
     * @returns The normalized rating value (1-5).
     */
    normalize(value: number, container: Element, maxRatingOverride?: number): {
        normalized: number;
        max: number;
        type: string;
    };
    private detectMaxRating;
    private isBinaryRating;
}
export declare const getRatingNormalizer: () => RatingNormalizer;
//# sourceMappingURL=rating-normalizer.d.ts.map