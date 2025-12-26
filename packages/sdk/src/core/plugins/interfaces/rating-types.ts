export interface IRatingResult {
    originalValue: number;   // Giá trị gốc bắt được (vd: 8)
    maxValue: number;        // Thang điểm gốc phát hiện được (vd: 10)
    normalizedValue: number; // Giá trị đã quy đổi về hệ 1-5 (vd: 4)
    reviewText: string;      // Nội dung review (nếu có)
    type: 'star' | 'numeric' | 'binary' | 'unknown'; // Loại đánh giá
    captureMethod: 'click_item' | 'form_submit' | 'input_change'; // Cách bắt
}