# RecSys Tracker Module

Event tracking system with plugin architecture for recommendation systems.

## Project Structure

```
recsys-tracker-module/
├── packages/
│   ├── sdk/                 # Core SDK
│   ├── plugins/             # Built-in plugins
│   └── server/              # Collector server
└── docs/                   # Documentation
```

## Implemented Features:

1. **ConfigLoader** - Load and validate configuration
2. **ErrorBoundary** - Safe execution wrapper with silent fail
3. **EventBuffer** - Queue management with offline support
4. **EventDispatcher** - Multi-strategy event sending (sendBeacon → fetch → XHR → Image)
5. **MetadataNormalizer** - Session & device metadata extraction
6. **Main SDK** - Auto-initialization and public API

## Getting Started

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install SDK dependencies
cd packages/sdk
npm install

# Install server dependencies
cd ../server
npm install
```

### 2. Build SDK

```bash
cd packages/sdk
npm run build
```

This will create:
- `dist/recsys-tracker.js` (UMD for browser)
- `dist/recsys-tracker.esm.js` (ESM)

### 3. Start Server

```bash
cd packages/server
npm run dev
```

Server will run on `http://localhost:3000`


## How It Works

### 1. Loader Script

Add to your website's `<head>`:

```html
<script>
  window.RecSysTrackerConfig = {
    domainKey: "shop-abc",
    debug: true
  };
</script>
<script src="http://localhost:8080/packages/sdk/dist/recsys-tracker.js"></script>
```

### 2. Automatic Initialization

SDK auto-initializes on page load:
- Loads config from window
- Fetches remote config from server
- Sets up event buffer and dispatcher
- Starts batch sending interval

### 3. Manual Tracking

```javascript
window.RecSysTracker.track({
  event: 'click',
  category: 'purchase_intent',
  data: {
    itemId: 'prod-001',
    price: 999
  }
});
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

### Smart Dispatching
1. **sendBeacon** (best for page unload)
2. **fetch with keepalive** (modern browsers)
3. **XMLHttpRequest** (legacy support)
4. **Image pixel** (last resort)

### Batch Sending
- Configurable batch size (default: 10)
- Configurable delay (default: 2000ms)
- Reduces server requests
- Better performance

### Session Management
- Auto session generation
- 30min timeout
- Stored in sessionStorage
- Session continuity across page loads

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

---