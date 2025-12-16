import { RecSysTracker } from '../..';

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
  
  public init(tracker: RecSysTracker): void {
    if (this.tracker) {
      console.warn(`[${this.name}] Plugin already initialized`);
      return;
    }
    
    this.tracker = tracker;
    console.log(`[${this.name}] Plugin initialized`);
  }
  
  public abstract start(): void;
  
  public stop(): void {
    this.active = false;
    console.log(`[${this.name}] Plugin stopped`);
  }
  
  public destroy(): void {
    this.stop();
    this.tracker = null;
    console.log(`[${this.name}] Plugin destroyed`);
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
}
