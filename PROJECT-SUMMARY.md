# RecSys Tracker - Tóm Tắt Dự Án

## Tổng Quan

RecSys Tracker là một hệ thống tracking events cho recommendation systems, bao gồm:
- **SDK (Client-side)**: JavaScript SDK để track user interactions
- **Server (Backend)**: NestJS API để nhận và xử lý events

---

## SDK - Client Side

### Các Module Chính

#### 1. **ConfigLoader** (`config-loader.ts`)
- **Chức năng**: Load và quản lý cấu hình tracker
- **Flow**:
  1. Đọc `domainKey` từ `window.__RECSYS_DOMAIN_KEY__`
  2. Tạo config mặc định với các endpoint
  3. Fetch remote config từ server (3 API song song):
     - `GET /domain/:key` - Lấy thông tin domain
     - `GET /rule/domain/:key` - Lấy danh sách rules
     - `GET /domain/return-method/:key` - Lấy return methods
  4. Fetch chi tiết từng rule: `GET /rule/:id`
  5. Merge config remote với config local

#### 2. **OriginVerifier** (`origin-verifier.ts`)
- **Chức năng**: Xác thực origin của website đang sử dụng SDK
- **Phương thức**:
  - Verify bằng `window.location.origin` (ưu tiên)
  - Fallback: verify bằng `document.referrer`
  - Hỗ trợ test mode với `file://` protocol
- **Bảo mật**: Chặn SDK hoạt động nếu origin không khớp với domain đã đăng ký

#### 3. **EventBuffer** (`event-buffer.ts`)
- **Chức năng**: Quản lý queue events với offline support
- **Tính năng**:
  - Buffer events trong memory và localStorage
  - Retry mechanism với maxRetries
  - Batch processing
  - Khôi phục queue sau khi reload page
- **Interface**:
  ```typescript
  interface TrackedEvent {
    id: string;
    timestamp: string | Date;
    triggerTypeId: number;
    domainKey: string;
    payload: { UserId: number; ItemId: number; };
    rate?: { Value: number; Review: string; };
    retryCount?: number;
  }
  ```

#### 4. **EventDispatcher** (`event-dispatcher.ts`)
- **Chức năng**: Gửi events lên server
- **Strategies** (theo thứ tự ưu tiên):
  1. `navigator.sendBeacon` - Tốt nhất cho page unload
  2. `fetch` with keepalive - Modern browsers
- **Flow**:
  1. Verify origin trước khi gửi
  2. Chuyển events thành JSON payload
  3. Thử gửi theo thứ tự strategies
  4. Fallback nếu method hiện tại thất bại

#### 5. **DisplayManager** (`display-manager.ts`)
- **Chức năng**: Quản lý các phương thức hiển thị recommendations
- **Return Methods hỗ trợ**:
  - **Popup Display** (returnMethodId: 1): Hiển thị popup với recommendations
  - **Inline Display** (returnMethodId: 2): Nhúng vào element trên page
- **Config**: Được load từ server qua API

#### 6. **ErrorBoundary** (`error-boundary.ts`)
- **Chức năng**: Wrap các operations để đảm bảo SDK không crash website
- **Features**:
  - Try-catch wrapper cho sync/async operations
  - Silent fail mode
  - Error logging

#### 7. **MetadataNormalizer** (`metadata-normalizer.ts`)
- **Chức năng**: Thu thập metadata về user và device
- **Thông tin thu thập**:
  - User agent, screen size, viewport
  - Page URL, title, referrer
  - Device type detection
  - Timestamp và session info

### Main SDK Class (`index.ts`)

**Phương thức public**:
- `init()`: Khởi tạo SDK (tự động gọi)
- `track(eventData)`: Track custom events
- `flush()`: Gửi tất cả events ngay lập tức
- `getConfig()`: Lấy config hiện tại
- `setUserId(userId)`: Set user ID

---

## Flow Hoạt Động của SDK

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIALIZATION                                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    User thêm script vào website:
    <script>window.__RECSYS_DOMAIN_KEY__ = "abc123";</script>
    <script src="https://cdn.../loader.js"></script>
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Loader Script tải và khởi tạo SDK                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CONFIG LOADING (ConfigLoader)                                │
│   ├─ Đọc domainKey từ window.__RECSYS_DOMAIN_KEY__            │
│   ├─ Tạo config mặc định                                       │
│   └─ Fetch remote config từ server (song song):                │
│       ├─ GET /domain/:key                                      │
│       ├─ GET /rule/domain/:key                                 │
│       ├─ GET /domain/return-method/:key                        │
│       └─ GET /rule/:id (cho từng rule)                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ORIGIN VERIFICATION (OriginVerifier)                        │
│   ├─ Kiểm tra window.location.origin                          │
│   ├─ Fallback: kiểm tra document.referrer                     │
│   └─ Nếu fail → Dừng SDK (bảo mật)                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. COMPONENT INITIALIZATION                                     │
│   ├─ EventDispatcher với domainUrl để verify                  │
│   ├─ DisplayManager với return methods                        │
│   └─ Batch sending interval setup                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. EVENT TRACKING                                              │
│   User interactions → RecSysTracker.track(...)                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. EVENT BUFFERING (EventBuffer)                               │
│   ├─ Add event to in-memory queue                             │
│   ├─ Persist to localStorage                                   │
│   └─ Metadata enrichment (MetadataNormalizer)                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. BATCH PROCESSING                                            │
│   Every batchDelay (default: 2000ms):                          │
│   ├─ Get batch (default: 10 events)                           │
│   └─ Send to EventDispatcher                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. EVENT DISPATCHING (EventDispatcher)                         │
│   ├─ Verify origin again (OriginVerifier)                     │
│   ├─ Try sendBeacon()                                         │
│   ├─ Fallback: fetch() with keepalive                         │
│   └─ POST /event                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. RESULT HANDLING                                             │
│   ├─ Success → removeBatch() from buffer                      │
│   └─ Fail → markFailed() → retry later                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. PAGE UNLOAD                                                │
│   beforeunload/pagehide/visibilitychange:                      │
│   └─ Flush all remaining events (sendBeacon)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Server - Backend API (NestJS)

### Database Schema (Prisma)

**Tables**:
- `Ternant`: Quản lý tenants
- `Domain`: Domains đã đăng ký
- `TriggerEvent`: Loại events (click, view, rate, etc.)
- `EventPattern`: Patterns cho events
- `PayloadPattern`: Patterns cho payload
- `Operator`: Operators cho rules
- `Rule`: Tracking rules
- `ReturnMethod`: Phương thức trả về recommendations
- `DomainReturnMethod`: Mapping domain ↔ return method
- `Interaction`: Lưu trữ user interactions

---

## Server APIs

### 1. **Domain Module** (`/domain`)

#### `GET /domain/:key`
- **Mô tả**: Lấy thông tin domain theo domain key
- **Response**: 
  ```json
  {
    "Id": 1,
    "Key": "abc123",
    "Url": "https://example.com",
    "Type": 0,
    "TernantId": 1
  }
  ```

#### `POST /domain/create`
- **Mô tả**: Tạo domain mới
- **Body**:
  ```json
  {
    "ternantId": 1,
    "url": "https://example.com",
    "type": 0
  }
  ```

#### `GET /domain/ternant/:id`
- **Mô tả**: Lấy danh sách domains của một tenant

---

### 2. **Event Module** (`/event`)

#### `POST /event`
- **Mô tả**: Nhận và lưu tracking events từ SDK
- **Body**:
  ```json
  {
    "triggerTypeId": 1,
    "domainKey": "abc123",
    "payload": {
      "UserId": 123,
      "ItemId": 456
    },
    "rate": {
      "Value": 5,
      "Review": "Great product!"
    }
  }
  ```
- **Response**:
  ```json
  {
    "statusCode": 201,
    "message": "Event was created successfully",
    "eventId": "uuid-here"
  }
  ```

---

### 3. **Rule Module** (`/rule`)

#### `GET /rule/event-patterns`
- **Mô tả**: Lấy danh sách event patterns
- **Response**: Array of event patterns

#### `GET /rule/payload-patterns`
- **Mô tả**: Lấy danh sách payload patterns
- **Response**: Array of payload patterns

#### `GET /rule/operators`
- **Mô tả**: Lấy danh sách operators
- **Response**: Array of operators

#### `POST /rule/create`
- **Mô tả**: Tạo tracking rule mới
- **Body**: CreateRuleDto

#### `GET /rule/:id`
- **Mô tả**: Lấy chi tiết một rule theo ID
- **Response**: Rule object với đầy đủ thông tin

#### `GET /rule/domain/:key`
- **Mô tả**: Lấy danh sách rules của một domain
- **Response**:
  ```json
  [
    {
      "id": 1,
      "name": "Track Product View",
      "TriggerTypeName": "view"
    }
  ]
  ```

---

### 4. **Return Method Module** (`/domain/return-method`)

#### `GET /domain/return-method/:key`
- **Mô tả**: Lấy return methods của domain
- **Response**:
  ```json
  [
    {
      "returnMethodId": 1,
      "slotName": "homepage-popup",
      "value": "{\"delay\": 3000}",
      "targetUrl": "/api/recommendations"
    }
  ]
  ```

#### `POST /domain/return-method`
- **Mô tả**: Tạo return method mới cho domain
- **Body**:
  ```json
  {
    "key": "abc123",
    "slotName": "sidebar",
    "returnMethodId": 2,
    "value": "#sidebar-container",
    "targetUrl": "/api/recommendations"
  }
  ```

---

## Các Tính Năng Bảo Mật

### 1. Origin Verification
- SDK verify origin trước khi initialize
- Verify lại trước mỗi lần gửi events
- Chặn SDK nếu origin không khớp

### 2. Domain Key Authentication
- Mỗi domain có unique key
- Server validate domain key khi nhận events

### 3. Error Isolation
- SDK wrapped trong ErrorBoundary
- Không crash website host nếu có lỗi

---

## Performance Features

### 1. Batch Processing
- Events được gửi theo batch (default: 10 events)
- Giảm số lượng HTTP requests
- Configurable batch size & delay

### 2. Offline Support
- Events stored trong localStorage
- Tự động retry khi online trở lại
- Max retry limit để tránh vòng lặp

### 3. Multi-strategy Dispatching
- sendBeacon cho page unload (reliable)
- fetch với keepalive cho normal operations
- Auto fallback nếu method không support

### 4. Lazy Loading
- SDK tải async không block page
- Loader script tạo stub function để queue calls

---

## Configuration Schema

```typescript
interface TrackerConfig {
  domainKey: string;              // Required
  domainUrl: string;              // From server
  domainType: number;             // From server
  trackEndpoint?: string;         // Default: /event
  configEndpoint?: string;        // Default: /domain/:key
  trackingRules?: TrackingRule[]; // From server
  returnMethods?: ReturnMethod[]; // From server
  options?: {
    maxRetries?: number;          // Default: 3
    batchSize?: number;           // Default: 10
    batchDelay?: number;          // Default: 2000ms
    offlineStorage?: boolean;     // Default: true
  };
}
```

---

## Quick Start

### SDK Installation

```html
<!-- Add to your website's <head> -->
<script>
  window.__RECSYS_DOMAIN_KEY__ = "your-domain-key";
</script>
<script src="https://cdn.jsdelivr.net/gh/.../loader.js"></script>

<!-- Track events -->
<script>
  RecSysTracker.track({
    triggerTypeId: 1,
    userId: 123,
    itemId: 456,
    rate: { Value: 5, Review: "Great!" }
  });
</script>
```

### Server Setup

```bash
# packages/server
npm install
npx prisma migrate deploy
npm run start:dev
```

---

## Project Structure

```
packages/
├── sdk/                    # Client-side tracking SDK
│   └── src/
│       ├── index.ts       # Main SDK class
│       ├── core/
│       │   ├── config/    # ConfigLoader
│       │   ├── display/   # DisplayManager, Popup, Inline
│       │   ├── events/    # EventBuffer, EventDispatcher
│       │   ├── error-handling/  # ErrorBoundary
│       │   ├── metadata/  # MetadataNormalizer
│       │   └── utils/     # OriginVerifier
│       └── types/         # TypeScript interfaces
│
└── server/                # Backend API (NestJS)
    └── src/
        └── modules/
            ├── domain/    # Domain management
            ├── event/     # Event tracking
            ├── rule/      # Rule management
            └── prisma/    # Database service
```

---

## Tổng Kết

**SDK** cung cấp:
- Auto-initialization
- Origin verification
- Offline support với retry
- Batch processing
- Multi-strategy dispatching
- Display methods (Popup, Inline)
- Error isolation

**Server** cung cấp:
- RESTful APIs cho domain, event, rule management
- Return method configuration
- Database persistence (PostgreSQL via Prisma)
- Validation và error handling

**Flow tổng thể**: SDK tự động load config từ server → verify origin → track events → buffer & batch → dispatch với retry → server lưu vào database.
