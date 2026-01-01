import { BasePlugin } from "./base-plugin";
import { TrackerConfig } from "../../types";
import { TrackerInit } from "../tracker-init";
import { SelectorMatcher, MatchMode } from "./utils/selector-matcher";

export class ClickPlugin extends BasePlugin {
  public readonly name = "click-plugin";
  private config: TrackerConfig | any;

  constructor(config?: TrackerConfig) {
    super();
    this.config = config;
  }

  public start(): void {
    const configToUse =
      this.config || (this.tracker ? this.tracker.getConfig() : null);

    if (!configToUse || !configToUse.trackingRules) {
      console.warn("[ClickPlugin] No tracking rules found. Plugin stopped.");
      return;
    }

    console.log("[ClickPlugin] Started with config:", configToUse.domainUrl);

    document.addEventListener(
      "click",
      (event: MouseEvent) => {
        this.handleDocumentClick(event, configToUse);
      },
      true
    );
  }

  private handleDocumentClick(event: MouseEvent, config: any): void {
    if (!this.tracker) return;

    const rules = config.trackingRules;
    if (!rules || rules.length === 0) return;

    const clickRules = rules.filter((r: any) => r.eventTypeId === 1);

    if (clickRules.length === 0) return;

    for (const rule of clickRules) {
      const selector = rule.trackingTarget?.value;
      if (!selector) continue;

      const clickedElement = event.target as HTMLElement;
      
      // Strategy: 
      // 1. Try STRICT match first (element itself must match selector)
      // 2. If no match, try CLOSEST (parent traversal) but ONLY if clicked element is not a button/link
      //    This prevents other interactive elements from accidentally triggering
      
      let target = SelectorMatcher.match(clickedElement, selector, MatchMode.STRICT);
      
      if (!target) {
        // Only use CLOSEST matching if clicked element is NOT an interactive element
        const isInteractiveElement = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
          clickedElement.tagName
        ) || clickedElement.hasAttribute('role') && ['button', 'link'].includes(
          clickedElement.getAttribute('role') || ''
        );

        if (!isInteractiveElement) {
          // Safe to traverse up - probably clicked on icon/text inside button
          target = SelectorMatcher.match(clickedElement, selector, MatchMode.CLOSEST);
        }
      }
      
      if (!target) continue;

      // Log for debugging
      console.log('[ClickPlugin] ✓ Click matched tracking target:', {
        element: target.className || target.tagName,
        selector: selector,
        rule: rule.name,
        matchedDirectly: clickedElement === target
      });

      if (rule.conditions?.length) {
        const conditionsMet = rule.conditions.every((cond: any) => {
          if (cond.patternId === 2 && cond.operatorId === 1) {
            return window.location.href.includes(cond.value);
          }
          return true;
        });

        if (!conditionsMet) continue;
      }

      console.log(
        "🎯 [ClickPlugin] Rule matched:",
        rule.name,
        "| ID:",
        rule.id
      );

      let payload: Record<string, any> = {};

      if (rule.payloadMappings?.length) {
        rule.payloadMappings.forEach((m: any) => {
          if (m.source === "Element" || m.source === "element") {
            const el = (target as HTMLElement).querySelector(m.value);
            if (el) {
              payload[m.field] = el.textContent?.trim();
            } else if ((target as HTMLElement).hasAttribute(m.value)) {
              payload[m.field] = (target as HTMLElement).getAttribute(m.value);
            }
          }

          if (m.source === "LocalStorage") {
            payload[m.field] = localStorage.getItem(m.value);
          }

          if (m.source === "global_variable") {
            const globalVal = (window as any)[m.value];
            payload[m.field] =
              typeof globalVal === "function" ? globalVal() : globalVal;
          }
        });
      }

      console.log("🚀 Payload collected:", payload);

      const userKey =
        Object.keys(payload).find((k) => k.toLowerCase().includes("user")) ||
        "userId";
      const itemKey =
        Object.keys(payload).find((k) => k.toLowerCase().includes("item")) ||
        "ItemId";

      const rawData = TrackerInit.handleMapping(rule, target as HTMLElement);

      this.tracker.track({
        eventTypeId: rule.eventTypeId,
        trackingRuleId: Number(rule.id),

        userField: userKey,
        userValue:
          payload[userKey] ||
          rawData.userId ||
          TrackerInit.getUsername() ||
          "guest",

        itemField: itemKey,
        itemValue:
          payload[itemKey] ||
          rawData.ItemId ||
          rawData.ItemTitle ||
          "Unknown Song",
      });

      break;
    }
  }
}
