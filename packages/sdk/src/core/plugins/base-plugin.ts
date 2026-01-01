import { RecSysTracker } from '../..';
import { ErrorBoundary } from '../error-handling/error-boundary';
import { TrackerInit } from '../tracker-init';

export interface IPlugin {
  readonly name: string;

  // Initialize the plugin with tracker instance
  init(tracker: RecSysTracker): void;

  // Start the plugin (begin tracking)
  start(): void;

  // Stop the plugin (pause tracking)
  stop(): void;

  // Destroy the plugin (cleanup resources)
  destroy(): void;

  // Get plugin status
  isActive(): boolean;
}

export abstract class BasePlugin implements IPlugin {
  public abstract readonly name: string;

  protected tracker: RecSysTracker | null = null;
  protected active: boolean = false;
  protected errorBoundary: ErrorBoundary;
  protected payloadBuilder: any = null;

  constructor() {
    this.errorBoundary = new ErrorBoundary(true);
  }

  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      if (this.tracker) {
        return;
      }

      this.tracker = tracker;
      this.payloadBuilder = tracker.payloadBuilder;

    }, `${this.name}.init`);
  }

  public abstract start(): void;

  public stop(): void {
    this.errorBoundary.execute(() => {
      this.active = false;
      console.log(`[${this.name}] Plugin stopped`);
    }, `${this.name}.stop`);
  }

  public destroy(): void {
    this.errorBoundary.execute(() => {
      this.stop();
      this.tracker = null;
      console.log(`[${this.name}] Plugin destroyed`);
    }, `${this.name}.destroy`);
  }

  public isActive(): boolean {
    return this.active;
  }

  protected ensureInitialized(): boolean {
    if (!this.tracker) {
      console.error(`[${this.name}] Plugin not initialized. Call init() first.`);
      return false;
    }
    return true;
  }

  // Wrap event handlers with error boundary
  protected wrapHandler<T extends any[]>(
    handler: (...args: T) => void,
    handlerName: string = 'handler'
  ): (...args: T) => void {
    return this.errorBoundary.wrap(handler, `${this.name}.${handlerName}`);
  }

  // Wrap async event handlers with error boundary
  protected wrapAsyncHandler<T extends any[]>(
    handler: (...args: T) => Promise<void>,
    handlerName: string = 'asyncHandler'
  ): (...args: T) => Promise<void> {
    return this.errorBoundary.wrapAsync(handler, `${this.name}.${handlerName}`);
  }

  // Xử lý thông tin user, item, rating/review_value từ extracted data
  protected resolvePayloadIdentity(extractedData: any, rule?: any): {
    userField: string;
    userValue: string;
    itemField: string;
    itemValue: string;
    value: string;
  } {
    // Default values
    let userField = 'UserId';
    let userValue = '';
    let itemField = 'ItemId';
    let itemValue = '';
    let value = '';

    // If rule is provided, use its mappings to determine fields
    if (rule && rule.payloadMappings && Array.isArray(rule.payloadMappings)) {
      for (const mapping of rule.payloadMappings) {
        const fieldName = mapping.Field || mapping.field; // Handle potential case differences
        const fieldValue = extractedData[fieldName];

        // Check for User fields
        if (fieldName && ['UserId', 'Username', 'AnonymousId'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
          userField = fieldName;
          userValue = fieldValue || '';
        }

        // Check for Item fields
        if (fieldName && ['ItemId', 'ItemTitle'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
          itemField = fieldName;
          itemValue = fieldValue || '';
        }

        // Check for Value field
        if (fieldName && ['Value'].some(f => f.toLowerCase() === fieldName.toLowerCase())) {
          value = fieldValue || '';
        }
      }
    } else {
      // Fallback if no rule provided
      // Common user field patterns (prioritized)
      const userFieldPatterns = ['UserId', 'Username'];
      // Common item field patterns (prioritized)
      const itemFieldPatterns = ['ItemId', 'ItemTitle'];
      // Common rating/review_value patterns (prioritized)
      const valuePatterns = ['Value'];

      // Find first available user field
      for (const key of Object.keys(extractedData)) {
        if (!userValue && userFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
          userField = key;
          userValue = extractedData[key];
        }
        if (!itemValue && itemFieldPatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
          itemField = key;
          itemValue = extractedData[key];
        }
        if (!value && valuePatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
          value = extractedData[key];
        }
        if (userValue && itemValue && value) break;
      }
    }

    return { userField, userValue, itemField, itemValue, value };
  }

  /**
   * Phương thức xây dựng và theo dõi payload
   * New Flow: Plugin detects trigger → calls payloadBuilder with callback → 
   * payloadBuilder processes and calls back → buildAndTrack constructs and tracks → 
   * add to buffer → event dispatch
   * 
   * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
   * @param rule - Tracking rule with payload mappings
   * @param eventId - Event type ID
   * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
   */
  protected buildAndTrack(
    context: any,
    rule: any,
    eventId: number
  ): void {
    if (!this.tracker) {
      console.warn(`[${this.name}] Cannot track: tracker not initialized`);
      return;
    }

    console.log(`[${this.name}] buildAndTrack called for eventId:`, eventId, 'rule:', rule.name);
    
    // New Flow: Call PayloadBuilder with callback
    this.tracker.payloadBuilder.buildWithCallback(context, rule, (extractedData, processedRule, _processedContext) => {
      console.log(`[${this.name}] Callback received - extractedData from PayloadBuilder:`, extractedData);
      
      // Use TrackerInit.handleMapping like old code for proper payload extraction from DOM
      const element = context instanceof HTMLElement ? context : null;
      const mappedData = TrackerInit.handleMapping(processedRule, element);
      console.log(`[${this.name}] Mapped data from TrackerInit:`, mappedData);
      
      // Merge: PayloadBuilder data (network, localStorage) + TrackerInit data (DOM, static)
      const finalData = { ...mappedData, ...extractedData };
      console.log(`[${this.name}] Final merged data:`, finalData);
      
      // Get values from finalData
      const userField = finalData.UserId ? 'UserId' : (finalData.Username ? 'Username' : (finalData.AnonymousId ? 'AnonymousId' : 'UserId'));
      const userValue = finalData.UserId || finalData.Username || finalData.AnonymousId || TrackerInit.getUsername() || 'guest';
      const itemField = finalData.ItemId ? 'ItemId' : (finalData.ItemTitle ? 'ItemTitle' : 'ItemId');
      const itemValue = finalData.ItemId || finalData.ItemTitle || '';
      const value = finalData.Value || '';

      // Construct payload
      const payload: any = {
        eventTypeId: Number(eventId),
        trackingRuleId: Number(processedRule.id),
        userField,
        userValue,
        itemField,
        itemValue,
        ratingValue: eventId === 2 ? Number(value) : undefined,
        ratingReview: eventId === 3 ? value : undefined,
      };
      console.log(`[${this.name}] Final payload to track:`, payload);

      // Track the event (this adds to buffer and dispatches)
      this.tracker!.track(payload);
      console.log(`[${this.name}] tracker.track() called`);
    });
  }
}
