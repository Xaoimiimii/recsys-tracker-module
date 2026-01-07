import { TrackerCore } from './tracker-core';
import { TrackingRule, PayloadMapping } from '../types';

export class TrackerInit {
  private static usernameCache: string | null = null;

  static getUsername(): string {
    if (this.usernameCache !== null) {
        return this.usernameCache;
    }

    // @ts-ignore
    const user = window.LoginDetector?.getCurrentUser();
        
    return this.usernameCache = user ?? "guest";
}

// static init(): void {
//     console.log("✅ [TrackerInit] Static system initialized");
// }

  static handleMapping(rule: TrackingRule, target: HTMLElement | null = null): Record<string, any> {
    const payload: Record<string, any> = { 
      ruleId: rule.id,
      eventTypeId: rule.eventTypeId 
    };
    
    const scope = TrackerCore.findScope(target, rule.trackingTarget?.value || null);
    const mappings = rule.payloadMappings || [];

    mappings.forEach((map: PayloadMapping) => {
      const field = map.field;
      const source = map.source;
      const value = map.value;

      if (source === 'element') {
        payload[field] = TrackerCore.resolveElementValue(value, scope);
      } else if (source === 'static') {
        payload[field] = value;
      } else if (source === 'login_detector' || field.toLowerCase() === 'userid') {
        payload[field] = this.getUsername();
      }
    });

    return payload;
  }

  static checkConditions(conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return true; 
  }
}