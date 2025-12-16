// Config
export { ConfigLoader } from './config/config-loader';

// Error Handling
export { ErrorBoundary, ErrorHandler } from './error-handling/error-boundary';

// Events
export { EventBuffer, TrackedEvent } from './events/event-buffer';
export { EventDispatcher, SendStrategy, DispatchOptions } from './events/event-dispatcher';

// Metadata
export {
  MetadataNormalizer,
  SessionData,
  PageMetadata,
  DeviceMetadata,
  Metadata
} from './metadata/metadata-normalizer';

// Utils
export { OriginVerifier } from './utils/origin-verifier';

// Display
export { DisplayManager } from './display/display-manager';
export { PopupDisplay } from './display/popup-display';
export { InlineDisplay } from './display/inline-display';
export * from './display/types';

// Plugins
export { IPlugin, BasePlugin } from './plugins/base-plugin';
export { PluginManager } from './plugins/plugin-manager';
export { ClickPlugin } from './plugins/click-plugin';
export { PageViewPlugin } from './plugins/page-view-plugin';
export { TrackerContextAdapter } from './plugins/adapters/tracker-context-adapter';
export { IRecsysContext } from './plugins/interfaces/recsys-context.interface';
