# RecSys Tracker Module

Event tracking system with plugin architecture for recommendation systems.

## Project Structure

```
recsys-tracker-module/
├── packages/
│   ├── sdk/                 # Core SDK
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

Server will run on `http://localhost:3000` (Local) or `https://recsys-tracker-module.onrender.com` (Production)


## 4. Loader Script

Add to your website's `<head>`:

```html
<!-- Simple CDN Loader (Recommended) -->
<script>window.__RECSYS_DOMAIN_KEY__ = "your-domain-key";</script>
<script src="https://tracking-sdk.s3-ap-southeast-2.amazonaws.com/dist/loader.js"></script>
```