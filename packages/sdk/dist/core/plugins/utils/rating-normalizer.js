/**
 * Utility to normalize rating values to a standard 1-5 scale.
 */
export class RatingNormalizer {
    /**
     * Normalizes a rating value to a 1-5 scale.
     * @param value The raw rating value detected.
     * @param container The container element of the rating widget (for context detection).
     * @param maxRating Optional manual max rating override.
     * @returns The normalized rating value (1-5).
     */
    normalize(value, container, maxRatingOverride) {
        let maxRating = maxRatingOverride || 5;
        let type = 'range';
        // 1. Detect Max Rating if not provided
        if (!maxRatingOverride) {
            const detectedMax = this.detectMaxRating(container, value);
            if (detectedMax) {
                maxRating = detectedMax;
            }
        }
        // 2. Check for Binary (Upvote/Downvote) context if value is small
        // Heuristic: If max detected is 1 (e.g. just a like button) or explicit binary checking
        // But value input is usually number. 
        // If we detected keywords like "upvote", "like" previously, we might handle it here contextually?
        // For now, let's assume 'value' is already numeric.
        // If the container looks like a binary choice (2 buttons only), we might infer.
        if (this.isBinaryRating(container)) {
            maxRating = 2; // Treat as 2-point scale? Or just map directly?
            type = 'binary';
            // If binary, usually 1 = down/bad, 2 = up/good? Or 0/1?
            // If it matches 'like' pattern, maybe map 1 -> 5 (Good).
            // This is tricky without semantic understanding of "which button".
            // Assuming the plugin extractor gave us: 
            //   1 for "up/good", 0 or -1 for "down/bad" -> We map to 5 and 1.
            // Simplification: Standardize Plugin Logic to return:
            // 1 for Positive Action, 0 for Negative/Neutral?
            // OR: Let this normalizer be dumb math first.
            // If value is > 10, it's likely a 100-point scale
        }
        else if (maxRating > 5) {
            type = 'range_' + maxRating;
        }
        // 3. Math Normalization
        let normalized = value;
        if (type === 'binary') {
            // Binary Logic:
            // If value is max (e.g. 1 out of 1, or 2 out of 2), treat as 5 stars.
            // If value is min (0 or 1 out of 2), treat as 1 star.
            if (value >= maxRating / 2) {
                normalized = 5;
            }
            else {
                normalized = 1;
            }
        }
        else {
            // Range Logic
            if (maxRating !== 5) {
                normalized = (value / maxRating) * 5;
            }
        }
        // Clamp just in case
        normalized = Math.min(5, Math.max(1, normalized));
        // Format to 1 decimal place if needed, but return number
        normalized = Math.round(normalized * 10) / 10;
        return {
            normalized,
            max: maxRating,
            type
        };
    }
    detectMaxRating(container, currentValue) {
        // Strategy 1: Count children with similar structure
        // e.g. 5 stars, 10 circles
        if (!container)
            return null;
        const children = Array.from(container.children);
        // Filter potential rating items (exclude labels if possible)
        // Heuristic: items that look like the one clicked? 
        // This is hard since we don't know which one was clicked here directly.
        // But usually all rating items are siblings.
        // If children count is between 2 and 12, assume it's the scale length.
        if (children.length >= 2 && children.length <= 12) {
            return children.length;
        }
        // If current value is > 5, then max must be at least current value -> likely 10 or 100.
        if (currentValue > 5) {
            if (currentValue <= 10)
                return 10;
            if (currentValue <= 20)
                return 20;
            if (currentValue <= 100)
                return 100;
        }
        // Look for aria-valuemax
        const ariaMax = container.getAttribute('aria-valuemax');
        if (ariaMax)
            return parseFloat(ariaMax);
        return null;
    }
    isBinaryRating(container) {
        // Check for class names indicating binary choice
        const cls = container.className.toLowerCase();
        if (cls.includes('thumbs') || cls.includes('binary') || cls.includes('like-dislike') || cls.includes('vote')) {
            return true;
        }
        // Check if only 2 interactable children
        const buttons = container.querySelectorAll('button, a, input, [role="button"]');
        if (buttons.length === 2)
            return true;
        return false;
    }
}
export const getRatingNormalizer = () => new RatingNormalizer();
//# sourceMappingURL=rating-normalizer.js.map