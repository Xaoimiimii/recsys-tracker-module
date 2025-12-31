import { BasePlugin } from './base-plugin';
import { TrackerInit } from '../tracker-init';
import { TrackerConfig, TrackingRule } from '../../types';

interface IPascalTrackingRule {
    Id: string | number;
    Name: string;
    EventType: string;
    TargetElement: {
        Pattern: string;
        Operator: string;
        Value: string;
    };
    Conditions: Array<{
        Pattern: string;
        Operator: string;
        Value: string;
    }>;
    PayloadMappings: Array<{
        Field: string;
        Source: string;
        Value: string;
    }>;
}

export class ClickPlugin extends BasePlugin {
  public readonly name = 'click-plugin';
  private config: TrackerConfig | any;

  constructor(config?: TrackerConfig) {
    super();
    this.config = config;
  }

  public start(): void {
    const configToUse = this.config || (this.tracker ? this.tracker.getConfig() : null);
    
    if (this.tracker && configToUse && configToUse.domainKey === 'e6f546d3797c6a91c22e215daf0ab0177d9f027606409e4b0fe609bde9906aaa') {
        console.warn("🚀 [ClickPlugin] Using INTERNAL MOCK config for Click Test Key");
        const mockRules = [
            {
                "TrackingRule": {
                    "Id": "44",
                    "Name": "Click-plugin",
                    "EventType": "click",
                    "TargetElement": {
                        "Pattern": "css_selector",
                        "Operator": "equals",
                        "Value": "._song-row_hjtft_317"
                    },
                    "Conditions": [
                        {
                            "Pattern": "url",
                            "Operator": "contains",
                            "Value": "/favorites" 
                        }
                    ],
                    "PayloadMappings": [
                        // {
                        //     "Field": "Title",
                        //     "Source": "element",
                        //     "Value": "._song-title-text_hjtft_367"
                        // },
                        {
                            "Field": "ItemId",
                            "Source": "element",
                            "Value": "data-rfd-draggable-id"
                        },
                        {
                            "Field": "userId",
                            "Source": "global_variable", 
                            "Value": "LoginDetector.getCurrentUser"
                        }
                    ]
                }
            }
        ];
        this.runPascalMode(mockRules);
        return;
    }

    console.log("[ClickPlugin] Starting with config:", configToUse);

    if (!configToUse || !configToUse.trackingRules) {
        console.warn("[ClickPlugin] No tracking rule found.");
        return;
    }

    const rules = configToUse.trackingRules;
    const isPascalCase = rules.length > 0 && (rules[0].TrackingRule || rules[0].TargetElement);

    console.log(`[ClickPlugin] Mode: ${isPascalCase ? 'PascalCase (New)' : 'Standard (Legacy)'}`);

    if (isPascalCase) {
        this.runPascalMode(rules);
    } else {
        this.runLegacyMode(rules);
    }
  }

  private runPascalMode(rules: any[]) {
      console.log(`[ClickPlugin] Activated with ${rules.length} PascalCase rules.`);
      
      document.addEventListener('click', (event: MouseEvent) => {
          rules.forEach((ruleWrapper: any) => {
              const rule: IPascalTrackingRule = ruleWrapper.TrackingRule || ruleWrapper;
              
              if (!rule.TargetElement || !rule.TargetElement.Value) return;

              const selector = rule.TargetElement.Value;
              const target = (event.target as HTMLElement).closest(selector);

              if (!target) return;
              // 2. Check Conditions
              if (rule.Conditions) {
                  const conditionsMet = rule.Conditions.every(cond => {
                      if (cond.Pattern === 'url' && cond.Operator === 'contains') {
                          return window.location.href.includes(cond.Value);
                      }
                      return true;
                  });
                  if (!conditionsMet) return;
              }

              console.log("🎯 [ClickPlugin] Match found for Rule:", rule.Name);

              if (rule.PayloadMappings) {
                  const targetElement = target as HTMLElement;
                  const standardMappings: any[] = [];
                  let extractedData: Record<string, any> = {};

                  // Smart Extraction Strategy
                  rule.PayloadMappings.forEach(m => {
                      if (m.Source === 'element' && m.Value) {
                          // Priority 1: Check if 'Value' is an attribute on the Target Element
                          if (targetElement.hasAttribute(m.Value)) {
                              const attrVal = targetElement.getAttribute(m.Value);
                              if (attrVal) {
                                  extractedData[m.Field] = attrVal;
                              }
                          } 
                          // Priority 2: Treat as Selector for child/global lookup (PayloadBuilder)
                          else {
                              standardMappings.push({
                                  field: m.Field,
                                  source: m.Source,
                                  value: m.Value
                              });
                          }
                      } else {
                          // Non-element sources (global_variable etc) go to standard builder
                          standardMappings.push({
                              field: m.Field,
                              source: m.Source,
                              value: m.Value
                          });
                      }
                  });

                  // Execute Standard Mappings via PayloadBuilder
                  if ((this.tracker as any)?.payloadBuilder && standardMappings.length > 0) {
                      const builderData = (this.tracker as any).payloadBuilder.build(standardMappings, targetElement);
                      extractedData = { ...extractedData, ...builderData };
                  }
                  
                  console.log("🚀 Extracted Data (Merged Smart & Standard):", extractedData);
                  
                  if (this.tracker) {
                      // Send data...
                  }
              } else {
                  console.warn("[ClickPlugin] PayloadBuilder not available or no mappings.");
              }
          });
      }, true);
  }

  private runLegacyMode(rules: TrackingRule[]) {
    const clickRules = rules.filter(rule => rule.eventTypeId === 1 || rule.eventTypeId === 44);

    if (clickRules.length === 0) {
      console.warn("[ClickPlugin] No active click rule found in config.");
      return;
    }

    console.log(`[ClickPlugin] Activated with ${clickRules.length} legacy rules.`);

    document.addEventListener('click', (event: MouseEvent) => {
      clickRules.forEach((rule: TrackingRule) => {
        const selector = rule.trackingTarget?.value;
        if (!selector) return;

        const target = (event.target as HTMLElement).closest(selector);
        
        if (target) {
          console.log("🎯 [ClickPlugin] Match found for Rule ID:", rule.id);
          const data = TrackerInit.handleMapping(rule, target as HTMLElement);
          
          if ((this as any).sdk && typeof (this as any).sdk.track === 'function') {
             console.log("🚀 Sending to SDK.track:", data);
          } else {
             console.log("🚀 Click Data collected:", data);
          }
        }
      });
    }, true);
  }
}
