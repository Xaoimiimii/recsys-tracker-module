import { IRecsysContext, IRecsysRule, RuleEvent, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData } from './IRecsysContext';
import { MockRules, ICondition, RuleSource } from './IRecsysRule';
import { getUserIdentityManager } from './UserIdentityManager';
import { getAIItemDetector } from './AIItemDetector';

const MOCK_RULES: MockRules = {
    click: [
        {
            ruleName: "Track_Item_Click",
            triggerEvent: "click",
            targetSelector: "._item-card-column_24svy_1",
            condition: { type: "NONE", operator: "NONE", value: null } as ICondition,
            payloadExtractor: {
                source: 'ai_detect' as RuleSource,
                eventKey: "itemId",
            },
        },
    ],
    page_view: [
        {
            ruleName: "Track_Song_Pageview",
            triggerEvent: "page_view",
            targetSelector: "^/song/([^/?#]+)", 
            condition: { type: "NONE", operator: "NONE", value: null } as ICondition,
            payloadExtractor: {
                source: 'regex_group' as RuleSource,
                pattern: "^/song/([^/?#]+)",
                groupIndex: 1,
                eventKey: "itemId",
            },
        }
    ]
};

export class TrackerContext implements IRecsysContext {

    public config = {
        getRules: (eventType: RuleEvent): IRecsysRule[] => MOCK_RULES[eventType] || [],
    };

    public payloadBuilder = {
        build: (element: Element | IAIItemDetectionResult | null, rule: IRecsysRule, extraData: IPayloadExtraData = {}): IRecsysPayload => {
            const userIdentityManager = getUserIdentityManager();
            
            const payload: IRecsysPayload = {
                event: rule.triggerEvent === "click" ? "item_click" : "page_view",
                url: window.location.href,
                timestamp: Date.now(),
                ruleName: rule.ruleName,
                userId: userIdentityManager.getRealUserId(),
                itemId: 'N/A' 
            };
            
            let detectionResult: IAIItemDetectionResult | null = null;
            const extractor = rule.payloadExtractor;

            if (!extractor || typeof extractor.source === 'undefined') {
                console.error(`[PayloadBuilder Error] Rule '${rule.ruleName}' is missing a valid payloadExtractor or source.`);
                return {
                    ...payload,
                    itemId: 'N/A (Invalid Rule Config)',
                    itemName: 'Invalid Rule',
                    confidence: 0,
                    source: 'invalid_rule_config'
                };
            }

            if (extractor.source === 'regex_group' && extraData.regexMatch) {
                const match = extraData.regexMatch;
                const groupIndex = extractor.groupIndex;

                if (groupIndex !== undefined && match.length > groupIndex) {
                    const itemId = match[groupIndex];
                    
                    return {
                        ...payload,
                        itemId: itemId,
                        itemName: itemId, 
                        itemType: 'song',
                        confidence: 1.0, 
                        source: 'regex_url'
                    };
                }
            }

            if (extractor.source === 'ai_detect') {
                const detector = getAIItemDetector();
                
                if (rule.triggerEvent === 'page_view' && element && (element as IAIItemDetectionResult).id) {
                    detectionResult = element as IAIItemDetectionResult; // Sử dụng structuredItem được tìm thấy trước
                } else if (detector && element instanceof Element) {
                    detectionResult = detector.detectItem(element); 
                }

                if (detectionResult && detectionResult.id && detectionResult.id !== 'N/A (AI Failed)') {
                    return {
                        ...payload,
                        itemId: detectionResult.id,
                        itemName: detectionResult.name || 'Unknown',
                        itemType: detectionResult.type || 'content',
                        confidence: detectionResult.confidence || 0,
                        source: detectionResult.source || 'dom_based',
                        metadata: detectionResult.metadata || {}
                    };
                } else {
                    return {
                        ...payload,
                        itemId: 'N/A (Failed)',
                        itemName: 'Unknown Item',
                        confidence: 0,
                        source: 'rule_match_no_ai_id'
                    };
                }
            }

            return payload;
        },
    };
    
    public eventBuffer = {
        enqueue: (payload: IRecsysPayload) => {
            console.groupCollapsed(
                `✅ [RECSYS TRACK] - ${payload.event.toUpperCase()} (UserID: ${payload.userId.substring(0, Math.min(15, payload.userId.length))}... | Confidence: ${(payload.confidence !== undefined ? payload.confidence * 100 : 0).toFixed(0)}%)`
            );
            console.log("Payload:", payload);
            if (payload.itemId && payload.itemId !== 'N/A (Failed)') {
                console.log(`✨ ITEM ID CAPTURED: ${payload.itemId} (${payload.itemName})`);
                console.log(`Source: ${payload.source} | Type: ${payload.itemType}`);
            } else {
                console.warn('⚠️ ITEM ID EXTRACTION FAILED. Check AIItemDetector logs.');
            }
            console.log(`--- Mock Sending to /track endpoint ---`);
            console.groupEnd();
        },
    };

    public updateIdentity(newUserId: string) {
        console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
    }
}