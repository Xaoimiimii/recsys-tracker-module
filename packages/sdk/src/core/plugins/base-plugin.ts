import { RecSysTracker } from '../..';
import { ErrorBoundary } from '../error-handling/error-boundary';

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
        console.warn(`[${this.name}] Plugin already initialized`);
        return;
      }

      this.tracker = tracker;
      this.payloadBuilder = tracker.payloadBuilder;
      console.log(`[${this.name}] Plugin initialized`);
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
  protected resolvePayloadIdentity(extractedData: any): {
    userField: string;
    userValue: string;
    itemField: string;
    itemValue: string;
    value: string;
  } {
    // Common user field patterns (prioritized)
    const userFieldPatterns = ['UserId', 'Username'];
    // Common item field patterns (prioritized)
    const itemFieldPatterns = ['ItemId', 'ItemTitle'];
    // Common rating/review_value patterns (prioritized)
    const valuePatterns = ['Value'];

    let userField = 'UserId';
    let userValue = '';
    let itemField = 'ItemId';
    let itemValue = '';
    let value = '';


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
        value = key;
        value = extractedData[key];
      }
      if (userValue && itemValue && value) break;
    }

    return { userField, userValue, itemField, itemValue, value };
  }

  /**
   * Phương thức xây dựng và theo dõi payload
   * Extraction → identity resolution → payload construction → tracking
   * 
   * @param context - Context for extraction (HTMLElement, NetworkContext, etc.)
   * @param rule - Tracking rule with payload mappings
   * @param eventId - Event type ID
   * @param additionalFields - Optional additional fields (ratingValue, reviewValue, metadata, etc.)
   */
  protected buildAndTrack(
    context: any,
    rule: any,
    eventId: number,
    additionalFields?: {
      value?: string;
      metadata?: Record<string, any>;
    }
  ): void {
    if (!this.tracker) {
      console.warn(`[${this.name}] Cannot track: tracker not initialized`);
      return;
    }

    // 1. Extract data using PayloadBuilder
    const extractedData = this.tracker.payloadBuilder.build(context, rule);

    // 2. Resolve identity fields dynamically
    const { userField, userValue, itemField, itemValue } = this.resolvePayloadIdentity(extractedData);

    // 3. Construct payload
    const payload: any = {
      eventTypeId: eventId,
      trackingRuleId: rule.id,
      userField,
      userValue,
      itemField,
      itemValue,
      value: additionalFields?.value,
      ...additionalFields
    };

    // 4. Track the event
    this.tracker.track(payload);
  }
}
