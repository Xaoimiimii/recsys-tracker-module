export type RuleEvent = 'click' | 'page_view';
export type RuleSource = 'ai_detect' | 'regex_group';

export interface ICondition {
    type: string;
    operator: string;
    value: string | null;
}

export interface IPayloadExtractor {
    source: RuleSource;
    eventKey: string;
    pattern?: string;
    groupIndex?: number;
}

export interface IRecsysRule {
    ruleName: string;
    triggerEvent: RuleEvent;
    targetSelector: string;
    condition: ICondition;
    payloadExtractor: IPayloadExtractor;
}

export type MockRules = {
    [key in RuleEvent]?: IRecsysRule[];
};