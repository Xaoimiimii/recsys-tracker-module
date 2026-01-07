/**
 * Selector Matcher Utility
 * Provides strict and loose matching modes for tracking targets
 */

export enum MatchMode {
  STRICT = 'strict',   // Element must directly match selector
  CLOSEST = 'closest', // Element or closest parent must match
  CONTAINS = 'contains' // Element must contain matching child
}

export class SelectorMatcher {
  /**
   * Match element against selector with specified mode
   */
  static match(
    element: HTMLElement,
    selector: string,
    mode: MatchMode = MatchMode.CLOSEST
  ): HTMLElement | null {
    if (!element || !selector) return null;

    switch (mode) {
      case MatchMode.STRICT:
        return this.strictMatch(element, selector);
      
      case MatchMode.CLOSEST:
        return this.closestMatch(element, selector);
      
      case MatchMode.CONTAINS:
        return this.containsMatch(element, selector);
      
      default:
        return this.closestMatch(element, selector);
    }
  }

  /**
   * STRICT: Element itself must match selector
   */
  private static strictMatch(element: HTMLElement, selector: string): HTMLElement | null {
    try {
      return element.matches(selector) ? element : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * CLOSEST: Element or closest parent must match selector
   */
  private static closestMatch(element: HTMLElement, selector: string): HTMLElement | null {
    try {
      return element.closest(selector) as HTMLElement | null;
    } catch (e) {
      return null;
    }
  }

  /**
   * CONTAINS: Element must contain a child matching selector
   */
  private static containsMatch(element: HTMLElement, selector: string): HTMLElement | null {
    try {
      const child = element.querySelector(selector);
      return child ? element : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if element exactly matches selector (no parent traversal)
   */
  static isExactMatch(element: HTMLElement, selector: string): boolean {
    return this.strictMatch(element, selector) !== null;
  }
}
