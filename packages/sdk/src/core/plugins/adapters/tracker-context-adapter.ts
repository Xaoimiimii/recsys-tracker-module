import { IRecsysContext, IRecsysRule, RuleEvent, IRecsysPayload, IAIItemDetectionResult, IPayloadExtraData } from '../interfaces/recsys-context.interface';
import { getUserIdentityManager } from '../utils/user-identity-manager';
import { getAIItemDetector } from '../utils/ai-item-detector';
import { RecSysTracker } from '../../..';
import { TrackingRule } from '../../../types';

// Adapter to convert TrackingRule to IRecsysRule
function convertToRecsysRule(trackingRule: TrackingRule): IRecsysRule | null {
    // Map triggerEventId to event type
    const triggerEvent: RuleEvent = trackingRule.triggerEventId === 1 ? 'click' : 
                                     trackingRule.triggerEventId === 2 ? 'page_view' : 'click';
    
    // Determine payload extractor source from tracking rule
    const targetValue = trackingRule.targetElementValue || '';
    const isRegex = targetValue.startsWith('^');
    
    return {
        ruleName: trackingRule.name,
        triggerEvent,
        targetSelector: targetValue,
        condition: { type: "NONE", operator: "NONE", value: null },
        payloadExtractor: {
            source: isRegex ? 'regex_group' : 'ai_detect',
            pattern: isRegex ? targetValue : undefined,
            groupIndex: isRegex ? 1 : undefined,
            eventKey: "itemId",
        },
    };
}

export class TrackerContextAdapter implements IRecsysContext {
    private tracker: RecSysTracker;

    constructor(tracker: RecSysTracker) {
        this.tracker = tracker;
    }

    public config = {
        getRules: (eventType: RuleEvent): IRecsysRule[] => {
            const config = this.tracker.getConfig();
            if (!config?.trackingRules) return [];

            const triggerEventId = eventType === 'click' ? 1 : 2;
            
            return config.trackingRules
                .filter(rule => rule.triggerEventId === triggerEventId)
                .map(convertToRecsysRule)
                .filter((rule): rule is IRecsysRule => rule !== null);
        },
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
                    detectionResult = element as IAIItemDetectionResult;
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
            // Log for debugging
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
            console.groupEnd();

            // Convert IRecsysPayload to TrackedEvent format and send to real EventBuffer
            const triggerTypeId = payload.event === 'item_click' ? 1 : 2;
            
            // Only track if itemId is valid
            if (payload.itemId && !payload.itemId.startsWith('N/A')) {
                this.tracker.track({
                    triggerTypeId,
                    userId: parseInt(payload.userId) || 0,
                    itemId: parseInt(payload.itemId) || 0,
                });
            }
        },
    };

    public updateIdentity(newUserId: string) {
        console.log(`[TrackerContext] Identity updated to: ${newUserId}`);
        this.tracker.setUserId(newUserId);
    }
}
