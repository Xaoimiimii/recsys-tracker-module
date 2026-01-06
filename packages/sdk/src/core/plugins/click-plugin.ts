import { BasePlugin } from "./base-plugin";
import { TrackerConfig } from "../../types";
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
    console.log('[ClickPlugin] Click detected on:', event.target);

    if (!this.tracker) {
      console.warn('[ClickPlugin] Tracker not initialized');
      return;
    }

    const rules = config.trackingRules;
    if (!rules || rules.length === 0) {
      console.warn('[ClickPlugin] No tracking rules found');
      return;
    }

    const clickRules = rules.filter((r: any) => r.eventTypeId === 1);
    console.log('[ClickPlugin] Found', clickRules.length, 'click rules');

    if (clickRules.length === 0) return;

    for (const rule of clickRules) {
      const selector = rule.trackingTarget?.value;
      console.log('[ClickPlugin] Checking rule:', rule.name, 'with selector:', selector);

      if (!selector) continue;

      const clickedElement = event.target as HTMLElement;
      console.log('[ClickPlugin] Clicked element:', clickedElement.tagName, clickedElement.className);

      // Debug: Log parent chain
      let parent = clickedElement.parentElement;
      let depth = 0;
      while (parent && depth < 5) {
        console.log(`[ClickPlugin] Parent ${depth}:`, parent.tagName, parent.className, parent.classList?.toString());
        parent = parent.parentElement;
        depth++;
      }

      // Strategy: 
      // 1. Try STRICT match first (element itself must match selector)
      // 2. If no match, try CLOSEST (parent traversal) but ONLY if clicked element is not a button/link
      //    This prevents other interactive elements from accidentally triggering

      let target = SelectorMatcher.match(clickedElement, selector, MatchMode.STRICT);
      console.log('[ClickPlugin] STRICT match result:', target);

      // TEMPORARY: If selector is .play-button, also try to match elements with "play-button" in their class
      if (!target && selector === '.play-button') {
        const className = clickedElement.className;
        if (typeof className === 'string' && className.includes('play-button')) {
          target = clickedElement;
          console.log('[ClickPlugin] Matched via flexible class check on clicked element');
        }
      }

      if (!target) {
        // Only use CLOSEST matching if clicked element is NOT an interactive element
        const isInteractiveElement = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
          clickedElement.tagName
        ) || clickedElement.hasAttribute('role') && ['button', 'link'].includes(
          clickedElement.getAttribute('role') || ''
        );

        console.log('[ClickPlugin] Is interactive element:', isInteractiveElement);

        if (!isInteractiveElement) {
          // Safe to traverse up - probably clicked on icon/text inside button
          target = SelectorMatcher.match(clickedElement, selector, MatchMode.CLOSEST);
          console.log('[ClickPlugin] CLOSEST match result:', target);

          // TEMPORARY: If selector is .play-button and CLOSEST didn't find it, try manual parent search
          if (!target && selector === '.play-button') {
            let parent = clickedElement.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              const parentClassName = parent.className;
              if (typeof parentClassName === 'string' && parentClassName.includes('play-button')) {
                target = parent;
                console.log('[ClickPlugin] Matched via flexible class check on parent at depth', depth);
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        }
      }

      if (!target) {
        console.log('[ClickPlugin] No target matched for selector:', selector);
        continue;
      }

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

      // NEW FLOW: Check if rule requires network data
      let requiresNetworkData = false;
      if (rule.payloadMappings) {
        requiresNetworkData = rule.payloadMappings.some((m: any) => {
          const s = (m.source || '').toLowerCase();
          return [
            'requestbody',
            'responsebody',
            'request_body',
            'response_body',
            'requesturl',
            'request_url'
          ].includes(s);
        });
      }

      if (requiresNetworkData) {
        console.log('[ClickPlugin] ⏳ Rule requires network data. Starting collection for rule:', rule.id);
        
        // NEW FLOW: Gọi startCollection với đầy đủ context
        if (this.tracker && this.tracker.payloadBuilder) {
          const context = {
            element: target,
            eventType: 'click',
            triggerTimestamp: Date.now()
          };
          
          this.tracker.payloadBuilder.startCollection(
            context,
            rule,
            (finalPayload: Record<string, any>) => {
              console.log('[ClickPlugin] ✅ Collection complete, tracking event with payload:', finalPayload);
              // Sau khi có đủ dữ liệu → Track event
              this.buildAndTrack(target, rule, rule.eventTypeId);
            }
          );
        } else {
          console.warn('[ClickPlugin] Tracker or PayloadBuilder not available');
        }
        break;
      }

      // Không cần network data → Track ngay
      console.log('[ClickPlugin] No network data required, tracking immediately');
      this.buildAndTrack(target, rule, rule.eventTypeId);

      break;
    }
  }
}
