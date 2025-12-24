import { BasePlugin } from './base-plugin';
import { RecSysTracker } from '../..';
import { IRecsysContext } from './interfaces/recsys-context.interface';
import { TrackerContextAdapter } from './adapters/tracker-context-adapter';
import { getAIItemDetector, AIItemDetector } from './utils/ai-item-detector';
import { throttle } from './utils/plugin-utils';
import { RatingUtils } from './utils/rating-utils';

export class RatingPlugin extends BasePlugin {
    public readonly name = 'RatingPlugin';

    private context: IRecsysContext | null = null;
    private detector: AIItemDetector | null = null;

    // Throttle cho click (chống spam)
    private throttledClickHandler: (event: Event) => void;
    // Không throttle submit để đảm bảo bắt dính sự kiện cuối cùng
    private submitHandler: (event: Event) => void;

    constructor() {
        super();
        // Delay 500ms cho click: User click sao liên tục thì chỉ lấy cái cuối sau khi dừng tay
        this.throttledClickHandler = throttle(
            this.wrapHandler(this.handleInteraction.bind(this, 'click'), 'handleClick'),
            500
        );
        this.submitHandler = this.wrapHandler(this.handleInteraction.bind(this, 'submit'), 'handleSubmit');
    }

    public init(tracker: RecSysTracker): void {
        this.errorBoundary.execute(() => {
            super.init(tracker);
            this.context = new TrackerContextAdapter(tracker);
            this.detector = getAIItemDetector();
            console.log(`[RatingPlugin] initialized.`);
        }, 'RatingPlugin.init');
    }

    public start(): void {
        this.errorBoundary.execute(() => {
            if (!this.ensureInitialized()) return;

            // 1. Lắng nghe Click (Interactive Rating: Stars, Likes)
            // Sử dụng capture = true để bắt sự kiện sớm, trước khi các framework (React/Vue) chặn propagation
            document.addEventListener("click", this.throttledClickHandler, true);

            // 2. Lắng nghe Submit (Traditional Forms)
            document.addEventListener("submit", this.submitHandler, true);

            console.log("[RatingPlugin] started listening (Universal Mode).");
            this.active = true;
        }, 'RatingPlugin.start');
    }

    public stop(): void {
        this.errorBoundary.execute(() => {
            document.removeEventListener("click", this.throttledClickHandler, true);
            document.removeEventListener("submit", this.submitHandler, true);
            super.stop();
        }, 'RatingPlugin.stop');
    }

    /**
     * Hàm xử lý trung tâm
     */
    private handleInteraction(eventType: 'click' | 'submit', event: Event): void {
        try {
            if (!this.context || !this.detector) return;

            // Trigger ID = 2 cho Rating (Lấy từ server config)
            const rules = this.context.config.getRules(2);
            if (rules.length === 0) return;

            const target = event.target as Element;
            if (!target) return;

            for (const rule of rules) {
                const selector = rule.trackingTarget.value;
                if (!selector) continue;

                // Kiểm tra xem user có tương tác đúng khu vực quy định không
                // closest() giúp tìm ngược lên trên nếu click vào phần tử con (vd click vào path trong svg)
                const matchedElement = target.closest(selector);

                if (matchedElement) {
                    // Xác định "Container" bao quanh toàn bộ widget đánh giá để quét ngữ cảnh
                    // Logic: Tìm Form cha, hoặc Div bao quanh, hoặc chính là parent của nút bấm
                    const container = matchedElement.closest('form') ||
                        matchedElement.closest('.rating-container') ||
                        matchedElement.closest('.review-box') ||
                        matchedElement.parentElement ||
                        document.body;

                    // Gọi Utils để "thám thính"
                    const result = RatingUtils.processRating(container, matchedElement, eventType);

                    // Lọc rác: Nếu không bắt được điểm và cũng không có text -> Bỏ qua
                    if (result.originalValue === 0 && !result.reviewText) {
                        continue;
                    }

                    console.log(`[RatingPlugin] 🎯 Captured [${eventType}]: Raw=${result.originalValue}/${result.maxValue} -> Norm=${result.normalizedValue}`);

                    // Detect Item ID (Sản phẩm nào đang được đánh giá?)
                    // Dùng AI quét Container trước vì nó gần nhất, chính xác hơn quét cả body
                    let structuredItem = null;
                    if (!rule.trackingTarget.value?.startsWith('^')) {
                        structuredItem = this.detector.detectItem(container);
                    }

                    // Build Payload
                    const payload = this.context.payloadBuilder.build(structuredItem || matchedElement, rule);

                    payload.event = 'rate_submit';
                    payload.metadata = {
                        ...payload.metadata,
                        // Dữ liệu quan trọng nhất
                        rateValue: result.normalizedValue,
                        reviewText: result.reviewText,

                        // Dữ liệu phụ để debug/analytics
                        rawRateValue: result.originalValue,
                        rateMax: result.maxValue,
                        rateType: result.type,
                        captureMethod: result.captureMethod
                    };

                    this.context.eventBuffer.enqueue(payload);

                    // Break ngay sau khi khớp rule đầu tiên để tránh duplicate event
                    break;
                }
            }
        } catch (error) {
            // Safety guard: Không bao giờ để lỗi plugin làm ảnh hưởng trải nghiệm user
            console.warn('[RatingPlugin] Error processing interaction:', error);
        }
    }
}