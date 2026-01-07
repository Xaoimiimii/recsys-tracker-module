import { IRatingResult } from "../interfaces/rating-types";

export class RatingUtils {

    /**
     * Hàm Main: Phân tích DOM để lấy rating
     */
    public static processRating(container: Element, triggerElement: Element, eventType: 'submit' | 'click'): IRatingResult {
        let rawValue = 0;
        let maxValue = 5;

        // BƯỚC 1: TRÍCH XUẤT GIÁ TRỊ (EXTRACTION)
        // Chiến thuật 1: Nếu click trực tiếp vào item (sao/nút), ưu tiên lấy value từ chính nó
        if (eventType === 'click') {
            rawValue = this.extractValueFromTarget(container, triggerElement);
        }

        // Chiến thuật 2: Nếu là submit form hoặc Chiến thuật 1 thất bại (click vào viền chẳng hạn)
        // Quét toàn bộ container xem cái nào đang "checked" hoặc "active"
        if (rawValue === 0) {
            rawValue = this.extractValueFromContainerState(container);
        }

        // BƯỚC 2: PHÁT HIỆN THANG ĐIỂM (SCALE DETECTION)
        const isBinary = this.detectBinaryContext(container, triggerElement);

        if (isBinary) {
            maxValue = 1; // Hệ nhị phân
            // Nếu click nút Like/Upvote thì rawValue = 1
            if (eventType === 'click' && this.isPositiveAction(triggerElement)) {
                rawValue = 1;
            }
            // Nếu submit form, rawValue đã được lấy ở bước 1 (từ input checked)
        } else {
            // Hệ chấm điểm (5, 10, 100)
            maxValue = this.detectMaxScale(container, rawValue);
        }

        // BƯỚC 3: LẤY REVIEW TEXT
        const reviewText = this.extractReviewText(container);

        // BƯỚC 4: CHUẨN HÓA
        const normalized = this.normalizeScore(rawValue, maxValue, isBinary);

        return {
            originalValue: rawValue,
            maxValue: maxValue,
            normalizedValue: normalized,
            reviewText: reviewText,
            type: isBinary ? 'binary' : (maxValue > 5 ? 'numeric' : 'star'),
            captureMethod: eventType === 'submit' ? 'form_submit' : 'click_item'
        };
    }

    // --- CÁC HÀM "THÁM TỬ" (HEURISTICS) ---

    private static extractValueFromTarget(container: Element, target: Element): number {
        let current: Element | null = target;

        // Leo ngược từ target lên container (tối đa 5 cấp để tránh loop vô hạn)
        let depth = 0;
        while (current && current !== container.parentElement && depth < 5) {
            // Check 1: Data Attributes (Phổ biến nhất)
            const val = current.getAttribute('data-value') || current.getAttribute('value') || current.getAttribute('aria-valuenow');
            if (val) {
                const num = parseFloat(val);
                if (!isNaN(num)) return num;
            }

            // Check 2: Index (Sao thứ mấy trong danh sách?)
            // Áp dụng nếu element hiện tại là item trong list (li, span, button)
            if (['LI', 'SPAN', 'DIV', 'BUTTON', 'I', 'SVG', 'polygon', 'path'].includes(current.tagName.toUpperCase())) {
                // Tìm parent chứa tất cả các stars
                let starContainer: Element | null = current.parentElement;
                let depth2 = 0;
                
                while (starContainer && depth2 < 3) {
                    const siblings = Array.from(starContainer.children).filter(el => {
                        const tag = el.tagName.toUpperCase();
                        const className = (el.className || '').toString().toLowerCase();
                        return (
                            ['LI', 'SPAN', 'DIV', 'BUTTON', 'I', 'SVG'].includes(tag) &&
                            (className.includes('star') || className.includes('rate') || tag === 'SVG')
                        );
                    });

                    // Nếu tìm thấy list stars (3-10 items)
                    if (siblings.length >= 3 && siblings.length <= 10) {
                        // Tìm element nào chứa current (có thể là parent của current)
                        for (let i = 0; i < siblings.length; i++) {
                            if (siblings[i].contains(current) || siblings[i] === current) {
                                return i + 1;
                            }
                        }
                    }
                    
                    starContainer = starContainer.parentElement;
                    depth2++;
                }
            }

            // Check 3: Accessibility Attribute (aria-posinset="4")
            const pos = current.getAttribute('aria-posinset');
            if (pos) return parseFloat(pos);

            current = current.parentElement;
            depth++;
        }
        return 0;
    }

    private static extractValueFromContainerState(container: Element): number {
        // 1. Tìm Input Radio/Checkbox đang checked (Chuẩn HTML)
        const specificSelector = `
            input[type="radio"][name*="rate"]:checked, 
            input[type="radio"][name*="rating"]:checked, 
            input[type="radio"][name*="score"]:checked,
            input[type="radio"][name*="star"]:checked
        `;

        let checked = container.querySelector(specificSelector) as HTMLInputElement;

        // Fallback: Nếu không tìm thấy cái nào có tên cụ thể, thì mới tìm radio bất kỳ (phòng hờ dev đặt tên lạ)
        if (!checked) {
            checked = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked') as HTMLInputElement;
        }

        if (checked && checked.value) {
            const val = parseFloat(checked.value);
            // Một số web để value="on" (checkbox) hoặc string lạ, ta bỏ qua
            if (!isNaN(val)) return val;
        }

        // 2. Tìm Class Active/Selected (Chuẩn CSS Custom)
        // Tìm các class thường dùng để highlight sao
        const activeSelectors = ['.active', '.selected', '.checked', '.filled', '.highlighted', '[aria-checked="true"]', '.rating', 'rating-stars', '.star', '.star-rating'];
        const activeItems = container.querySelectorAll(activeSelectors.join(', '));

        if (activeItems.length > 0) {
            // Logic: Nếu 4 sao sáng -> 4 điểm
            // Nhưng cẩn thận: check xem item cuối cùng có data-value="8" không?
            const lastItem = activeItems[activeItems.length - 1];
            const dataVal = lastItem.getAttribute('data-value');
            if (dataVal) {
                const val = parseFloat(dataVal);
                if (!isNaN(val)) return val;
            }
            return activeItems.length;
        }

        // 3. Dropdown Select
        const select = container.querySelector('select');
        if (select && select.value) return parseFloat(select.value);

        return 0;
    }

    private static extractReviewText(container: Element): string {
        // Tìm textarea hoặc input text có tên liên quan review/comment
        const inputs = container.querySelectorAll('textarea, input[type="text"]');
        for (const input of Array.from(inputs) as HTMLInputElement[]) {
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();

            // Nếu tên trường có chữ review, comment, detail, đánh giá...
            if (['review', 'comment', 'detail', 'message', 'body', 'content', 'đánh giá', 'nhận xét'].some(k => name.includes(k) || id.includes(k) || placeholder.includes(k))) {
                return input.value || '';
            }
        }
        // Fallback: Lấy textarea đầu tiên tìm thấy
        const firstTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
        return firstTextarea ? (firstTextarea.value || '') : '';
    }

    private static detectMaxScale(container: Element, currentVal: number): number {
        // 1. Check aria-valuemax (Chuẩn nhất)
        const ariaMax = container.getAttribute('aria-valuemax');
        if (ariaMax) return parseFloat(ariaMax);

        const childMax = container.querySelector('[aria-valuemax]');
        if (childMax) return parseFloat(childMax.getAttribute('aria-valuemax') || '5');

        // 2. Đếm số lượng item con (Stars)
        // Lọc các element con có class chứa 'star' hoặc 'rate' hoặc là svg/img
        const stars = container.querySelectorAll('.star, .fa-star, [class*="rating-item"], [role="radio"]');
        if (stars.length >= 3 && stars.length <= 10) return stars.length;

        // 3. Fallback theo logic số học
        if (currentVal > 5) {
            if (currentVal <= 10) return 10;
            if (currentVal <= 20) return 20; // Thang 20 điểm
            return 100; // Thang 100 điểm
        }

        return 5; // Mặc định an toàn
    }

    private static detectBinaryContext(container: Element, target: Element): boolean {
        // Gom tất cả text/class để scan keyword
        const contextStr = (container.className + ' ' + target.className + ' ' + (target.getAttribute('aria-label') || '') + ' ' + (target.id || '')).toLowerCase();

        // Keywords đặc trưng của Binary Rating
        const keywords = ['like', 'dislike', 'thumb', 'vote', 'useful', 'hữu ích', 'thích'];

        // Check keywords trước
        if (keywords.some(k => contextStr.includes(k))) {
            return true;
        }

        // Check nếu container có stars -> KHÔNG PHẢI binary
        const hasStars = contextStr.includes('star') || 
                        container.querySelector('.star, .fa-star, [class*="star"], svg[class*="star"]');
        if (hasStars) {
            return false;
        }

        // Check nếu container chỉ có đúng 2 nút bấm và có từ 'rate' -> binary
        const buttons = container.querySelectorAll('button, a[role="button"], input[type="button"]');
        const isTwoButtons = buttons.length === 2;

        return isTwoButtons && contextStr.includes('rate');
    }

    private static isPositiveAction(target: Element): boolean {
        const str = (target.className + ' ' + target.textContent + ' ' + target.id + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
        // Nếu có chữ 'dis' (dislike) hoặc 'down' (thumb-down) -> Negative
        if (str.includes('dis') || str.includes('down') || str.includes('không')) return false;
        // Nếu có chữ 'up', 'like', 'good', 'yes' -> Positive
        return str.includes('up') || str.includes('like') || str.includes('good') || str.includes('yes') || str.includes('hữu ích');
    }

    private static normalizeScore(raw: number, max: number, isBinary: boolean): number {
        if (raw <= 0) return 0;

        if (isBinary) {
            // Binary: Positive = 5 sao, Negative = 1 sao
            return raw >= 1 ? 5 : 1;
        }

        // Range Normalization: (Value / Max) * 5
        let normalized = (raw / max) * 5;

        // Làm tròn đến 0.5 (vd: 4.3 -> 4.5, 4.2 -> 4.0)
        normalized = Math.round(normalized * 2) / 2;

        // Kẹp giá trị trong khoảng 1-5
        return Math.min(5, Math.max(1, normalized));
    }
}