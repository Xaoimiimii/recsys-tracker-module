# RecSys Tracker Module

Event tracking system with plugin architecture for recommendation systems.

## Project Structure

```
recsys-tracker-module/
├── packages/
│   ├── sdk/                 # Core SDK
│   ├── tracking-plugins/    # Built-in plugins
│   └── server/              # Collector server
└── docs/                    # Documentation
```

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
- `dist/loader.js` (Loader file)
- `dist/recsys-tracker.iife.js`(IIFE)
- `dist/recsys-tracker.umd.js` (UMD)
- `dist/recsys-tracker.esm.js` (ESM)
- `dist/recsys-tracker.cjs.js` (CJS) 

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
<!-- Simple CDN Loader (Recommended) -->
<script>window.__RECSYS_DOMAIN_KEY__ = "your-domain-key";</script>
<script src="https://cdn.jsdelivr.net/gh/Xaoimiimii/recsys-tracker-module/packages/sdk/dist/loader.js"></script>
```

### 2. Automatic Initialization

SDK auto-initializes on page load:
- Loads config from window
- Fetches remote config from server
- Sets up event buffer and dispatcher
- Starts batch sending interval

### 3. Track Events

```javascript
window.RecSysTracker.track({
  event: 'click',
  category: 'purchase_intent',
  data: {
    itemId: 'prod-001',
    userId: ''
  }
});
```