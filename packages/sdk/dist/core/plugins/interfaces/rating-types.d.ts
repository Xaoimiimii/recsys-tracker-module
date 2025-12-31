export interface IRatingResult {
    originalValue: number;
    maxValue: number;
    normalizedValue: number;
    reviewText: string;
    type: 'star' | 'numeric' | 'binary' | 'unknown';
    captureMethod: 'click_item' | 'form_submit' | 'input_change';
}
//# sourceMappingURL=rating-types.d.ts.map