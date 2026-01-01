# Event Tracking Architecture - AND Logic Implementation

## Vấn đề cũ: OR Logic

Trước đây, SDK có "OR logic ngầm":
- **ClickPlugin**: `(click .play-button)` → tạo event
- **NetworkPlugin**: `(request /api/song/:id/player)` → tạo event

→ **Kết quả**: 2 events được tạo từ 1 hành động!

## Kiến trúc mới: AND Logic

### 1. Phân tách rõ ràng Event Types

```typescript
// UI-triggered events (ONLY triggered by user interaction)
EventTypeId 1 = Click       → Handled by ClickPlugin
EventTypeId 2 = Scroll      → Handled by ScrollPlugin  
EventTypeId 3 = Rating      → Handled by RatingPlugin
EventTypeId 4 = Review      → Handled by ReviewPlugin

// System-triggered events (NO user interaction required)
EventTypeId 5+ = Network, PageView, etc. → Handled by NetworkPlugin
```

### 2. NetworkPlugin - Skip UI Events

NetworkPlugin bây giờ **BỎ QUA** tất cả rules có eventTypeId = 1, 2, 3, 4:

```typescript
// In network-plugin.ts
const uiEventTypes = [1, 2, 3, 4]; // Click, Scroll, Rating, Review
if (uiEventTypes.includes(rule.eventTypeId)) {
    continue; // Skip - Let UI plugins handle these
}
```

### 3. Tracking Logic Flow

#### Scenario: Click Play Button → API Call

**User clicks `.play-button`**:

1. **ClickPlugin** detects click
2. Check tracking target: `.play-button` ✓
3. Check conditions ✓
4. **Resolve payload** from:
   - Element attributes
   - LocalStorage  
   - **Network request** (if PayloadMapping has RequestUrl)
5. **Create event** với payload đầy đủ
6. Add to buffer

**API `/api/song/:id/player` is called**:

1. **NetworkPlugin** intercepts request
2. Check rule eventTypeId
3. **eventTypeId = 1 (Click)** → SKIP! ✗
4. No event created

→ **Kết quả**: Chỉ 1 event được tạo!

#### Scenario: API Call (không có click)

**API `/api/song/:id/player` is called** (từ nút khác):

1. **NetworkPlugin** intercepts request
2. Check rule eventTypeId = 1 (Click)
3. **SKIP** vì đây là UI event ✗
4. No event created

→ **Kết quả**: Không có event! ✓

### 4. PayloadMapping với RequestUrl

Với rule có PayloadMapping:

```json
{
  "Field": "ItemId",
  "Source": "RequestUrl",
  "RequestUrlPattern": "/api/song/:id/player",
  "RequestMethod": "GET"
}
```

**Cách hoạt động**:
- **ClickPlugin** tạo event khi click
- **PayloadBuilder** resolve payload từ network request
- Nếu request chưa xảy ra → dùng giá trị default hoặc đợi
- **NetworkPlugin** KHÔNG tạo event riêng

## Anti-Duplication Mechanisms

### 1. Event Fingerprint Deduplication

Tránh duplicate events trong 3 giây:

```typescript
fingerprint = hash(
  eventTypeId +
  trackingRuleId +
  userId +
  itemId
)

if (sentFingerprints.has(fingerprint, within 3s)) {
  drop event
}
```

**Khi nào bị drop**:
- User double-click nhanh
- Plugin được trigger 2 lần
- Race condition trong payload resolution

**Code**:
```typescript
// In RecSysTracker.track()
const isDuplicate = this.eventDeduplicator.isDuplicate(
  eventTypeId,
  trackingRuleId,
  userValue,
  itemValue
);

if (isDuplicate) {
  console.log('[RecSysTracker] Duplicate event dropped');
  return;
}
```

### 2. Loop Guard for Network Requests

Tránh infinite loops từ network requests:

```typescript
if (requests > 5 per second for same endpoint) {
  disable rule for 60 seconds
}
```

**Khi nào trigger**:
- API polling quá nhanh
- Infinite redirect loop
- Bug trong code khiến API được gọi liên tục

**Code**:
```typescript
// In NetworkPlugin.handleRequest()
const shouldBlock = this.tracker.loopGuard.checkAndRecord(
  url, 
  method, 
  rule.id
);

if (shouldBlock) {
  console.warn('[NetworkPlugin] Request blocked by loop guard');
  continue;
}
```

**Configuration**:
```typescript
new LoopGuard({
  maxRequestsPerSecond: 5,     // Max 5 requests/second
  windowSize: 1000,             // 1 second window
  disableDuration: 60000        // Disable for 60s
})
```

## Rule Configuration Examples

### ✅ ĐÚNG: Click với Network Payload

```json
{
  "Name": "Click Play Button",
  "EventTypeID": 1,              ← Click event
  "TrackingTarget": {
    "Value": ".play-button"      ← Click trigger
  },
  "PayloadMappings": [
    {
      "Field": "ItemId",
      "Source": "RequestUrl",    ← Resolve từ network
      "RequestUrlPattern": "/api/song/:id/player",
      "RequestMethod": "GET"
    }
  ]
}
```

**Logic**: Click `.play-button` AND (resolve ItemId từ API call)

### ❌ SAI: Pure Network Event với Click EventTypeID

```json
{
  "Name": "Auto Track Song Play",
  "EventTypeID": 1,              ← Click (SAI!)
  "PayloadMappings": [
    {
      "Source": "RequestUrl",
      "RequestUrlPattern": "/api/song/:id/player"
    }
  ]
}
```

**Vấn đề**: EventTypeID = 1 (Click) nhưng không có TrackingTarget → NetworkPlugin sẽ skip

**Sửa**: Dùng EventTypeID khác (VD: 5 = NetworkEvent)

### ✅ ĐÚNG: Pure Network Event

```json
{
  "Name": "API Call Tracking",
  "EventTypeID": 5,              ← Network event
  "PayloadMappings": [
    {
      "Source": "RequestUrl",
      "RequestUrlPattern": "/api/song/:id/player"
    }
  ]
}
```

**Logic**: Tự động track khi API được gọi

## Testing

### Test Deduplication

```javascript
// Rapid clicks
button.click();
button.click();
button.click();

// Expected: Only 1 event in buffer
console.log(tracker.eventBuffer.size()); // 1
```

### Test Loop Guard

```javascript
// Spam API calls
for (let i = 0; i < 10; i++) {
  fetch('/api/song/123/player');
}

// Expected: First 5 pass, rest blocked
// Console: "[LoopGuard] Rule disabled due to excessive requests"
```

### Test UI Event Skipping

```javascript
// Another button triggers same API
otherButton.click(); // → calls /api/song/:id/player

// Expected: No event created
// NetworkPlugin skips because eventTypeId = 1 (Click)
```

## Migration Guide

Nếu bạn có rules cũ cần migrate:

1. **Kiểm tra EventTypeID**:
   - Nếu rule cần user interaction → giữ EventTypeID = 1, 2, 3, 4
   - Nếu rule chỉ track network → đổi sang EventTypeID >= 5

2. **Thêm TrackingTarget** cho UI events:
   - Click events PHẢI có `.trackingTarget.value`
   - Không có TrackingTarget → event không bao giờ trigger

3. **Payload từ Network**:
   - Dùng `Source: "RequestUrl"` để resolve payload
   - UI Plugin sẽ tự đợi network request nếu cần

## Architecture Diagram

```
User Action (Click/Rate/Review)
         ↓
    UI Plugin (ClickPlugin/RatingPlugin/ReviewPlugin)
         ↓
   Check TrackingTarget ✓
         ↓
   Check Conditions ✓
         ↓
   [Event Deduplicator] → Check fingerprint
         ↓
   Resolve Payload (from Element/LocalStorage/Network)
         ↓
   Create Event → EventBuffer
         ↓
   EventDispatcher → API


Network Request
         ↓
    NetworkPlugin
         ↓
   Check EventTypeID
         ↓
   Is UI Event (1,2,3,4)? → YES → SKIP ✗
         ↓ NO
   [Loop Guard] → Check excessive requests
         ↓
   Match RequestUrlPattern ✓
         ↓
   Create Event → EventBuffer
```

## Benefits

1. **No duplicate events**: 1 user action = 1 event
2. **Clear separation**: UI events vs Network events
3. **Protection**: Deduplication + Loop guard
4. **Flexibility**: Payload có thể đến từ nhiều nguồn
5. **Predictability**: Logic rõ ràng, dễ debug
