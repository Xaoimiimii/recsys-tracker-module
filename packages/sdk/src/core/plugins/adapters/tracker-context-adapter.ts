// import { IRecsysContext, TrackingRule, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData, IPayloadBuilder } from '../interfaces/recsys-context.interface';
// import { getUserIdentityManager } from '../utils/user-identity-manager';
// import { getAIItemDetector } from '../utils/ai-item-detector';
// import { RecSysTracker } from '../../..';
// import { PayloadExtractor } from '../../../types';

// export class TrackerContextAdapter implements IRecsysContext {
//     private tracker: RecSysTracker;

//     constructor(tracker: RecSysTracker) {
//         this.tracker = tracker;
//     }

//     public config = {
//         getRules: (triggerEventId: number): TrackingRule[] => {
//             const config = this.tracker.getConfig();
//             if (!config?.trackingRules) return [];
            
//             return config.trackingRules
//                 .filter(rule => rule.triggerEventId === triggerEventId);
//         },
//     };

//     get payloadBuilder(): IPayloadBuilder {
//         // Giả định: Trong class RecSysTracker bạn đã khởi tạo: public payloadBuilder = new PayloadBuilder();
//         // Ép kiểu as unknown as IPayloadBuilder để khớp với Interface Overload
//         return this.tracker.payloadBuilder as unknown as IPayloadBuilder;
//     }

//     public payloadBuilder = {
//         build: (element: Element | IAIItemDetectionResult | null, rule: TrackingRule, extraData: IPayloadExtraData = {}): IRecsysPayload => {
//             const userIdentityManager = getUserIdentityManager();
            
//             const payload: IRecsysPayload = {
//                 event: rule.triggerEventId === 1 ? "item_click" : "page_view",
//                 url: window.location.href,
//                 timestamp: Date.now(),
//                 ruleName: rule.name,
//                 userId: userIdentityManager.getRealUserId(),
//                 itemId: 'N/A' 
//             };
            
//             // Build payload extractor from rule data
//             const targetValue = rule.targetElement.targetElementValue || '';
//             const isRegex = targetValue.startsWith('^');
//             const extractor: PayloadExtractor = {
//                 source: isRegex ? 'regex_group' : 'ai_detect',
//                 eventKey: 'itemId',
//                 pattern: isRegex ? targetValue : undefined,
//                 groupIndex: isRegex ? 1 : undefined,
//             };
            
//             let detectionResult: IAIItemDetectionResult | null = null;

//             if (!extractor || typeof extractor.source === 'undefined') {
//                 console.error(`[PayloadBuilder Error] Rule '${rule.name}' is missing a valid payloadExtractor or source.`);
//                 return {
//                     ...payload,
//                     itemId: 'N/A (Invalid Rule Config)',
//                     itemName: 'Invalid Rule',
//                     confidence: 0,
//                     source: 'invalid_rule_config'
//                 };
//             }

//             if (extractor.source === 'regex_group' && extraData.regexMatch) {
//                 const match = extraData.regexMatch;
//                 const groupIndex = extractor.groupIndex;

//                 if (groupIndex !== undefined && match.length > groupIndex) {
//                     const itemId = match[groupIndex];
                    
//                     return {
//                         ...payload,
//                         itemId: itemId,
//                         itemName: itemId, 
//                         itemType: 'song',
//                         confidence: 1.0, 
//                         source: 'regex_url'
//                     };
//                 }
//             }

//             if (extractor.source === 'ai_detect') {
//                 const detector = getAIItemDetector();
                
//                 if (rule.triggerEventId === 3 && element && (element as IAIItemDetectionResult).id) {
//                     detectionResult = element as IAIItemDetectionResult;
//                 } else if (detector && element instanceof Element) {
//                     detectionResult = detector.detectItem(element); 
//                 }

//                 if (detectionResult && detectionResult.id && detectionResult.id !== 'N/A (AI Failed)') {
//                     return {
//                         ...payload,
//                         itemId: detectionResult.id,
//                         itemName: detectionResult.name || 'Unknown',
//                         itemType: detectionResult.type || 'content',
//                         confidence: detectionResult.confidence || 0,
//                         source: detectionResult.source || 'dom_based',
//                         metadata: detectionResult.metadata || {}
//                     };
//                 } else {
//                     return {
//                         ...payload,
//                         itemId: 'N/A (Failed)',
//                         itemName: 'Unknown Item',
//                         confidence: 0,
//                         source: 'rule_match_no_ai_id'
//                     };
//                 }
//             }

//             return payload;
//         },
//     };

//     public eventBuffer = {
//         enqueue: (payload: IRecsysPayload) => {
//             let triggerTypeId = 2; 

//             switch (payload.event) {
//                 case 'item_click':
//                     triggerTypeId = 1;
//                     break;
//                 case 'rate_submit': 
//                     triggerTypeId = 2;
//                     break;
//                 case 'page_view':  
//                     triggerTypeId = 3;
//                     break;
//                 case 'review':  
//                     triggerTypeId = 5;
//                     break;
//                 default:
//                     triggerTypeId = 3;
//             }

//             const trackData: any = {
//                 triggerTypeId,
//                 userId: parseInt(payload.userId) || 0,
//                 itemId: parseInt(payload.itemId) || 0, // Lưu ý: server nhận int
//             };

//             if (payload.metadata && payload.metadata.rateValue !== undefined) {
//                 trackData.rate = {
//                     Value: Number(payload.metadata.rateValue),
//                     Review: String(payload.metadata.reviewText || '')
//                 };
//             }
//             if (payload.itemId && !payload.itemId.toString().startsWith('N/A')) {
//                 this.tracker.track(trackData);
//             }
//         },
//     };

//     public updateIdentity(newUserId: string) {
//         console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
//         this.tracker.setUserId(newUserId);
//     }
// }

import { IRecsysContext, TrackingRule, IPayloadBuilder, IEventBuffer, IRecsysPayload } from '../interfaces/recsys-context.interface';
import { RecSysTracker } from '../../..';

export class TrackerContextAdapter implements IRecsysContext {
    private tracker: RecSysTracker;

    constructor(tracker: RecSysTracker) {
        this.tracker = tracker;
    }

    public config = {
        getRules: (triggerEventId: number): TrackingRule[] => {
            const config = this.tracker.getConfig();
            if (!config?.trackingRules) return [];
            
            return config.trackingRules
                .filter(rule => rule.triggerEventId === triggerEventId);
        },
    };

    get payloadBuilder(): IPayloadBuilder {
        // Dùng (this.tracker as any) để tránh lỗi nếu RecSysTracker chưa kịp cập nhật type
        return (this.tracker as any).payloadBuilder as IPayloadBuilder;
    }

    /**
     * [FIX QUAN TRỌNG]
     * Thay vì hard-code logic build payload ở đây, ta trỏ nó về 
     * instance payloadBuilder của tracker (Class PayloadBuilder xịn đã viết).
     * Dùng getter và ép kiểu để TypeScript hiểu nó hỗ trợ Overload.
     */
    public eventBuffer: IEventBuffer = {
        enqueue: (payload: IRecsysPayload) => {
            // 1. Map Event Type từ Plugin sang ENUM của Database
            let eventType: 'click' | 'rating' | 'review' | 'scroll' | 'page_view' = 'page_view';

            switch (payload.event) {
                case 'item_click': eventType = 'click'; break;
                case 'rate_submit': eventType = 'rating'; break; // FormPlugin cũ
                case 'review': eventType = 'review'; break;      // ReviewPlugin mới
                case 'scroll_depth': eventType = 'scroll'; break;
                case 'page_view': eventType = 'page_view'; break;
                default: eventType = 'page_view';
            }

            // 2. Chuẩn bị object phẳng (Flat Data)
            const trackData: any = {
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

    public updateIdentity(newUserId: string) {
        console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
        this.tracker.setUserId(newUserId);
    }
}
