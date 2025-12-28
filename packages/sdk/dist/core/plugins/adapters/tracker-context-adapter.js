// import { IRecsysContext, TrackingRule, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData, IPayloadBuilder } from '../interfaces/recsys-context.interface';
// import { getUserIdentityManager } from '../utils/user-identity-manager';
// import { getAIItemDetector } from '../utils/ai-item-detector';
// import { RecSysTracker } from '../../..';
// import { PayloadExtractor } from '../../../types';
export class TrackerContextAdapter {
    constructor(tracker) {
        this.config = {
            getRules: (eventTypeId) => {
                const config = this.tracker.getConfig();
                if (!(config === null || config === void 0 ? void 0 : config.trackingRules))
                    return [];
                return config.trackingRules
                    .filter(rule => rule.eventTypeId === eventTypeId);
            },
        };
        /**
         * [FIX QUAN TRỌNG]
         * Thay vì hard-code logic build payload ở đây, ta trỏ nó về
         * instance payloadBuilder của tracker (Class PayloadBuilder xịn đã viết).
         * Dùng getter và ép kiểu để TypeScript hiểu nó hỗ trợ Overload.
         */
        this.eventBuffer = {
            enqueue: (payload) => {
                // 1. Map Event Type từ Plugin sang ENUM của Database
                let eventType = 'page_view';
                switch (payload.event) {
                    case 'item_click':
                        eventType = 'click';
                        break;
                    case 'rate_submit':
                        eventType = 'rating';
                        break; // FormPlugin cũ
                    case 'review':
                        eventType = 'review';
                        break; // ReviewPlugin mới
                    case 'scroll_depth':
                        eventType = 'scroll';
                        break;
                    case 'page_view':
                        eventType = 'page_view';
                        break;
                    default: eventType = 'page_view';
                }
                // 2. Chuẩn bị object phẳng (Flat Data)
                const trackData = {
                    eventType,
                    // Map User/Item Value
                    userValue: String(payload.userId || ''),
                    userField: 'user_id', // Mặc định hoặc lấy từ metadata nếu cần
                    itemValue: String(payload.itemId || ''),
                    itemField: 'item_id', // Mặc định
                };
                // 3. Map Rating & Review Value từ Metadata
                if (payload.metadata) {
                    // Trường hợp 1: Review Plugin mới (Review nằm trong content)
                    if (eventType === 'review' && payload.metadata.content) {
                        trackData.reviewValue = String(payload.metadata.content);
                    }
                    // Trường hợp 2: Form Plugin cũ (Rate + Review chung)
                    // Map vào RatingValue
                    if (payload.metadata.rateValue !== undefined) {
                        const rateVal = Number(payload.metadata.rateValue);
                        if (!isNaN(rateVal)) {
                            trackData.ratingValue = rateVal;
                        }
                    }
                    // Map vào ReviewValue (nếu form đó có cả review text)
                    if (payload.metadata.reviewText) {
                        trackData.reviewValue = String(payload.metadata.reviewText);
                    }
                }
                // 4. Chỉ gửi nếu có ItemID hợp lệ (tùy logic bên bạn)
                if (trackData.itemValue && !trackData.itemValue.startsWith('N/A')) {
                    this.tracker.track(trackData);
                }
            },
        };
        this.tracker = tracker;
    }
    get payloadBuilder() {
        // Dùng (this.tracker as any) để tránh lỗi nếu RecSysTracker chưa kịp cập nhật type
        return this.tracker.payloadBuilder;
    }
    updateIdentity(newUserId) {
        console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
        this.tracker.setUserId(newUserId);
    }
}
//# sourceMappingURL=tracker-context-adapter.js.map