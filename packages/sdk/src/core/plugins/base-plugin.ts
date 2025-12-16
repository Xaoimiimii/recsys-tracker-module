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
  
  constructor() {
    this.errorBoundary = new ErrorBoundary(true); // Enable debug mode
  }
  
  public init(tracker: RecSysTracker): void {
    this.errorBoundary.execute(() => {
      if (this.tracker) {
        console.warn(`[${this.name}] Plugin already initialized`);
        return;
      }
      
      this.tracker = tracker;
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
}
