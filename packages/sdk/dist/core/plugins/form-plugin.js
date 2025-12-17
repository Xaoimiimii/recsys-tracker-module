// file: core/plugins/form-plugin.ts
import { BasePlugin } from './base-plugin'; // Giả sử BasePlugin có sẵn như PageViewPlugin
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector } from './utils/ai-item-detector';
export class FormPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this.name = 'FormPlugin';
        this.context = null;
        this.detector = null;
        this.handleSubmitBound = this.handleSubmit.bind(this);
    }
    init(tracker) {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector();
            console.log(`[FormPlugin] initialized.`);
        }, 'FormPlugin.init');
    }
    start() {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized())
                return;
            // Lắng nghe sự kiện submit toàn cục
            document.addEventListener('submit', this.handleSubmitBound, { capture: true });
            console.log("[FormPlugin] started listening for form submissions.");
            this.active = true;
        }, 'FormPlugin.start');
    }
    stop() {
        this.errorBoundary.execute(() => {
            document.removeEventListener('submit', this.handleSubmitBound, { capture: true });
            super.stop();
        }, 'FormPlugin.stop');
    }
    handleSubmit(event) {
        if (!this.context || !this.detector)
            return;
        const form = event.target;
        // 1. Lấy rules có Trigger là RATE (Giả sử ID = 2)
        const rateRules = this.context.config.getRules(2);
        if (rateRules.length === 0)
            return;
        for (const rule of rateRules) {
            // 2. Check xem Form này có khớp với Rule không (dựa vào selector)
            const selector = rule.targetElement.targetElementValue || '';
            if (!selector)
                continue;
            // Logic check khớp selector đơn giản (giống checkTargetMatch cũ nhưng gọn hơn)
            let isMatch = false;
            try {
                if (form.matches(selector))
                    isMatch = true;
                // Fallback check ID nếu selector là #id
                else if (selector.startsWith('#') && form.id === selector.substring(1))
                    isMatch = true;
            }
            catch (e) {
                console.warn('Invalid selector', selector);
            }
            if (isMatch) {
                // 1. Detect Item Context
                const structuredItem = this.detector.detectItem(form);
                // 2. Extract Form Data
                const { rateValue, reviewText } = this.extractFormData(form, rule);
                // 3. Build Payload cơ bản
                const payload = this.context.payloadBuilder.build(structuredItem, rule);
                // 4. Override event type
                payload.event = 'rate_submit';
                // 5. Đưa dữ liệu vào METADATA (Merge với metadata cũ nếu có)
                payload.metadata = {
                    ...(payload.metadata || {}),
                    rateValue: rateValue,
                    reviewText: reviewText
                };
                // 6. Gửi đi
                this.context.eventBuffer.enqueue(payload);
                return;
            }
        }
    }
    // Helper: Lấy dữ liệu từ form
    extractFormData(form, rule) {
        // Cách đơn giản: Scrape toàn bộ input
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });
        // Logic "Thám tử" tìm trường rate và review (giống smart-form cũ)
        let rateValue = 0;
        let reviewText = '';
        // Ưu tiên config từ Rule (nếu có PayloadConfig)
        if (rule.payload && rule.payload.length > 0) {
            rule.payload.forEach((p) => {
                // Giả sử type='number' là rate, type='string' là review
                // Cần logic map payloadPatternId cụ thể ở đây theo config của bạn
                const val = data[p.value]; // p.value là tên field name
                if (p.type === 'number')
                    rateValue = Number(val);
                else
                    reviewText = String(val);
            });
        }
        else {
            // Auto-detect nếu không có config
            // Tìm field có tên chưa 'rate', 'star', 'score'
            for (const [key, val] of Object.entries(data)) {
                const k = key.toLowerCase();
                if ((k.includes('rate') || k.includes('star') || k.includes('score')) && !isNaN(Number(val))) {
                    rateValue = Number(val);
                }
                if (k.includes('comment') || k.includes('review') || k.includes('content') || k.includes('message')) {
                    reviewText = String(val);
                }
            }
        }
        return { rateValue, reviewText };
    }
}
//# sourceMappingURL=form-plugin.js.map