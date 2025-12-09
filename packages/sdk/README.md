# RecSys Tracker SDK

Event tracking SDK for recommendation systems with auto-loading capabilities.

## Quick Start

### Installation via CDN

Add this to your website's `<head>`:

```html
<script>window.__RECSYS_DOMAIN_KEY__ = "your-domain-key";</script>
<script src="https://cdn.jsdelivr.net/gh/Xaoimiimii/recsys-tracker-module/packages/sdk/dist/loader.js"></script>
```

That's it! The SDK will automatically load and initialize.

## Implemented Features:

1. **ConfigLoader** - Load and validate configuration
2. **ErrorBoundary** - Safe execution wrapper with silent fail
3. **EventBuffer** - Queue management with offline support
4. **EventDispatcher** - Multi-strategy event sending (sendBeacon → fetch)
5. **MetadataNormalizer** - Session & device metadata extraction
6. **Main SDK** - Auto-initialization and public API

## How It Works

### 1. Loader Script

The loader script:
- Creates a stub function to queue calls before SDK loads
- Stores your domain key
- Asynchronously loads the main IIFE bundle
- Processes queued calls once loaded

### 2. Automatic Initialization

SDK auto-initializes on page load:
- Loads config from window
- Fetches remote config from server
- Sets up event buffer and dispatcher
- Starts batch sending interval

### 3. Track Events

```javascript
// Track custom events
RecSysTracker.track({
  event: 'click',
  category: 'purchase_intent',
  data: {
    itemId: 'prod-001',
    userId: ''
  }
});

// Events are queued automatically if SDK hasn't loaded yet
RecSysTracker('init', { debug: true });
RecSysTracker('track', { event: 'pageview' });
```

## Key Features

### Error Isolation
- All operations wrapped in try-catch
- Silent fail - never breaks host website
- Optional error reporting

### Offline Queue
- Events stored in LocalStorage
- Automatic retry on reconnect
- Max retry limit
- Queue size limit

### Multi-strategy Dispatching
1. **sendBeacon** (best for page unload)
2. **fetch with keepalive** (modern browsers)

### Batch Sending
- Configurable batch size (default: 10)
- Configurable delay (default: 2000ms)
- Reduces server requests
- Better performance

### Metadata Collection
- User agent, screen size, viewport
- Page URL, title, referrer
- Device type detection
- Timestamp and session info

## Configuration Schema

```typescript
interface TrackerConfig {
  domainKey: string;
  trackEndpoint?: string;
  configEndpoint?: string;
  trackingRules?: TrackingRule[];
  returnMethods?: ReturnMethod[];
}

interface TrackingRule {
  id: string;
  name: string;
  domainId: number;
  triggerEventId: number; // (click, scroll, ...)
  targetEventPatternId: number;
  targetOperatorId: number;
  targetElementValue: string;
  conditions: Condition[];
  payload: PayloadConfig[];
  options?: TrackerOptions;
}

interface PayloadConfig {
  payloadPatternId: number;
  operatorId: number;
  value?: string;
  type?: string;
}

interface Condition {
  payloadPatternId: number;
  operatorId: number;
  value?: string;
}

interface ReturnMethod {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
}

interface TrackerOptions {
  debug?: boolean;
  maxRetries?: number;
  batchSize?: number;
  batchDelay?: number; // ms
  offlineStorage?: boolean;
}
```

## Development

### Build SDK

```bash
npm run build
```

This creates:
- `dist/loader.js` - Lightweight loader script (auto-generated)
- `dist/recsys-tracker.iife.js` - Main SDK bundle (IIFE)
- `dist/recsys-tracker.umd.js` - UMD format
- `dist/recsys-tracker.esm.js` - ES Module format
- `dist/recsys-tracker.cjs.js` - CommonJS format

### Local Testing

```html
<script>window.__RECSYS_DOMAIN_KEY__ = "test-key";</script>
<script src="http://localhost:8080/packages/sdk/dist/loader.js"></script>
```

### Environment Variables

Create `.env` file:

```bash
API_URL=http://localhost:3000
```

## Package Structure

```
sdk/
├── src/
│   ├── index.ts              # Main entry point
│   ├── core/
│   │   ├── config/           # Config loader
│   │   ├── error-handling/   # Error boundary
│   │   ├── events/           # Event buffer & dispatcher
│   │   └── metadata/         # Metadata normalizer
│   └── types/                # TypeScript types
├── dist/                     # Build output
├── rollup.config.js          # Build configuration
└── README.md
```
