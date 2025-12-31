export class ElementExtractor {
    extract(mapping, context) {
        if (!context || !(context instanceof HTMLElement)) {
            // Fallback: Nếu không có context, sẽ tìm kiếm trong toàn bộ document
            // Thường thì context sẽ là element đang tương tác
            // Nhưng rule selector có thể là global
        }
        const startElement = (context instanceof HTMLElement) ? context : document.body;
        const selector = mapping.value; // The selector e.g. ".title"
        if (!selector)
            return null;
        try {
            // 1. Tìm element trong phạm vi context
            let target = startElement.querySelector(selector);
            // 2. Nếu không tìm thấy và context không phải là body, tìm trong toàn bộ document
            if (!target && startElement !== document.body) {
                target = document.querySelector(selector);
            }
            // 3. Radar / Proximity Scan
            // Nếu exact selector fails, dùng "Radar" logic. 
            // Dùng Value để biết css selector... bắt ngay selector đó
            // Hoặc bắt xung quanh gần nhất nếu fail
            if (!target) {
                target = this.findClosestBySelector(startElement, selector);
            }
            if (target) {
                return this.getValueFromElement(target);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    getValueFromElement(element) {
        if (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement) {
            return element.value;
        }
        return element.innerText || element.textContent || null;
    }
    findClosestBySelector(startElement, selector) {
        // Try going up parents and searching down
        let parent = startElement.parentElement;
        let levels = 0;
        while (parent && levels < 3) {
            const found = parent.querySelector(selector);
            if (found)
                return found;
            parent = parent.parentElement;
            levels++;
        }
        return null;
    }
}
//# sourceMappingURL=element-extractor.js.map