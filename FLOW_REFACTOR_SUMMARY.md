# 🎯 Tổng kết Refactor Flow Tracking Plugins & Payload Builder

## ✅ Hoàn thành

Đã refactor toàn bộ flow hoạt động của tracking plugins và payload builder để đáp ứng đúng yêu cầu:

### 📋 Các file đã thay đổi:

1. **`packages/sdk/src/core/payload/payload-builder.ts`** - Refactored
2. **`packages/sdk/src/core/payload/extractors/network-extractor.ts`** - Refactored
3. **`packages/sdk/src/core/payload/extractors/request-url-extractor.ts`** - Refactored
4. **`packages/sdk/src/core/plugins/click-plugin.ts`** - Updated
5. **`packages/sdk/src/core/plugins/rating-plugin.ts`** - Updated
6. **`packages/sdk/src/core/plugins/review-plugin.ts`** - Updated

---

## 🔄 Flow Mới (Chi tiết)

### 1️⃣ **Tracking Plugin phát hiện trigger event**

**Trước:**
```typescript
// ❌ OLD: Chỉ set flag và dừng
if (requiresNetworkData) {
    this.tracker.addPendingNetworkRule(rule.id);
    break;
}
```

**Sau:**
```typescript
// ✅ NEW: Gọi startCollection với đầy đủ context
if (requiresNetworkData) {
    const context = {
        element: target,
        eventType: 'click',
        triggerTimestamp: Date.now()  // ← Lưu timestamp để so sánh với requests
    };
    
    this.tracker.payloadBuilder.startCollection(
        context,
        rule,
        (finalPayload) => {
            // Callback khi đủ dữ liệu
            this.buildAndTrack(target, rule, rule.eventTypeId);
        }
    );
    break;
}
```

**Thay đổi:**
- ✅ Lưu `triggerTimestamp` để filter requests
- ✅ Pass context đầy đủ cho PayloadBuilder
- ✅ Cung cấp callback để xử lý khi đủ dữ liệu
- ✅ Không còn rely vào global flag

---

### 2️⃣ **PayloadBuilder quản lý pending collections**

**Thêm mới:**

```typescript
interface PendingCollection {
    rule: TrackingRule;
    context: any;
    timestamp: number;
    callback: (payload: Record<string, any>) => void;
    collectedData: Map<string, any>;
    requiredFields: Set<string>;
    networkCaptured: boolean;  // ← Anti-duplicate flag
}

public pendingCollections: Map<number, PendingCollection> = new Map();
```

**Method mới: `startCollection()`**

```typescript
public startCollection(
    context: any,
    rule: TrackingRule,
    callback: (payload: Record<string, any>) => void
): void {
    // 1. Phân tích required fields
    const requiredFields = this.analyzeRequiredFields(rule);
    const hasNetworkFields = this.hasNetworkFields(rule);
    
    // 2. Tạo pending collection
    const pending: PendingCollection = {
        rule,
        context: { ...context, triggerTimestamp: Date.now() },
        timestamp: Date.now(),
        callback,
        collectedData: new Map(),
        requiredFields,
        networkCaptured: false
    };
    
    this.pendingCollections.set(rule.id, pending);
    
    // 3. Enable network interceptor CHỈ KHI CẦN
    if (hasNetworkFields) {
        this.enableNetworkInterceptorForRule(rule);
    }
    
    // 4. Thu thập non-network data ngay
    this.collectNonNetworkData(pending);
    
    // 5. Check xem đã đủ chưa
    this.checkAndComplete(rule.id);
}
```

**Thay đổi quan trọng:**
- ❌ **XÓA**: `checkAndEnableNetworkTracking()` - Network không còn được enable lúc init
- ✅ **THÊM**: Enable network interceptor **on-demand** (chỉ khi có trigger event)
- ✅ **THÊM**: Quản lý pending collections với đầy đủ context
- ✅ **THÊM**: Auto-disable khi không còn pending

---

### 3️⃣ **NetworkExtractor chỉ bắt request khi có pending**

**Trước:**
```typescript
// ❌ OLD: Bắt TẤT CẢ requests
private handleNetworkRequest(...) {
    for (const rule of this.trackerConfig.trackingRules) {
        // Check pattern match
        // Extract data
        // Call callback
    }
}
```

**Sau:**
```typescript
// ✅ NEW: Chỉ bắt request khi có pending + anti-duplicate
private handleNetworkRequest(url, method, reqBody, resBody) {
    if (!this.payloadBuilder?.pendingCollections) return;
    
    const timestamp = Date.now();
    
    // Lặp qua pending collections
    for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
        
        // 1. ✅ Check timestamp: Request phải SAU trigger trong 5s
        const timeSinceTrigger = timestamp - pending.timestamp;
        if (timeSinceTrigger > 5000 || timeSinceTrigger < 0) continue;
        
        // 2. ✅ Anti-duplicate: Chỉ bắt 1 lần
        if (pending.networkCaptured) {
            console.log('Already captured - IGNORING duplicate');
            continue;
        }
        
        // 3. ✅ Check pattern match
        const matchedMappings = pending.rule.payloadMappings?.filter(...);
        if (!matchedMappings?.length) continue;
        
        // 4. ✅ Validate data: Request phải có dữ liệu cần thiết
        let hasRequiredData = false;
        const extractedData = {};
        for (const mapping of matchedMappings) {
            const value = this.extract(mapping, networkContext);
            if (this.isValid(value)) {
                extractedData[mapping.field] = value;
                hasRequiredData = true;
            }
        }
        if (!hasRequiredData) continue;
        
        // ✅ Bắt được request đúng!
        console.log('🎯 Captured matching request');
        
        // Notify PayloadBuilder
        for (const [field, value] of Object.entries(extractedData)) {
            this.payloadBuilder.notifyNetworkData(ruleId, field, value);
        }
        
        break; // IMPORTANT: Sau khi bắt được thì dừng
    }
}
```

**Thay đổi:**
- ✅ Chỉ bắt request khi có pending collection
- ✅ Filter theo timestamp (5s window)
- ✅ Anti-duplicate mechanism
- ✅ Validate data trước khi accept
- ✅ Notify PayloadBuilder về data mới

---

### 4️⃣ **RequestUrlExtractor filter theo timestamp**

**Thêm:**

```typescript
extract(mapping: PayloadMapping, _context?: any): any {
    // NEW: Lấy trigger timestamp từ context
    const triggerTime = _context?.triggerTimestamp || 0;
    
    // Iterate history backwards (newest first)
    for (let i = this.history.length - 1; i >= 0; i--) {
        const req = this.history[i];
        
        // ✅ Check timestamp: Request phải SAU trigger
        if (triggerTime > 0) {
            if (req.timestamp < triggerTime) {
                console.log('Request before trigger, skipping');
                continue;
            }
            
            // ✅ Check timeout: Không quá 5s
            if (req.timestamp - triggerTime > 5000) {
                console.log('Request too late, skipping');
                continue;
            }
        }
        
        // Check pattern match...
        if (matches) {
            const extracted = this.extractValueFromUrl(...);
            
            // ✅ Notify PayloadBuilder về data mới
            if (this.payloadBuilder?.pendingCollections) {
                for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
                    const belongsToRule = pending.rule.payloadMappings?.some(
                        m => m.field === mapping.field
                    );
                    if (belongsToRule) {
                        this.payloadBuilder.notifyNetworkData(ruleId, mapping.field, extracted);
                        break;
                    }
                }
            }
            
            return extracted;
        }
    }
}
```

**Thay đổi:**
- ✅ Filter requests theo trigger timestamp
- ✅ Chỉ lấy requests trong window 5s sau trigger
- ✅ Notify PayloadBuilder khi có data

---

### 5️⃣ **PayloadBuilder complete và callback**

**Method mới:**

```typescript
public checkAndComplete(ruleId: number): void {
    const pending = this.pendingCollections.get(ruleId);
    if (!pending) return;
    
    // Check timeout (5 giây)
    if (Date.now() - pending.timestamp > 5000) {
        this.completePendingCollection(ruleId, true);
        return;
    }
    
    // Check xem đã có network data chưa (nếu cần)
    const hasNetworkFields = this.hasNetworkFields(pending.rule);
    if (hasNetworkFields && !pending.networkCaptured) {
        // Set timeout để tự động complete sau 5s
        setTimeout(() => {
            if (this.pendingCollections.has(ruleId)) {
                this.completePendingCollection(ruleId, true);
            }
        }, 5000);
        return;
    }
    
    // ✅ Đủ dữ liệu rồi → Complete
    this.completePendingCollection(ruleId, false);
}

private completePendingCollection(ruleId: number, isTimeout: boolean): void {
    const pending = this.pendingCollections.get(ruleId);
    if (!pending) return;
    
    // Build final payload
    const finalPayload = Object.fromEntries(pending.collectedData);
    
    // Cleanup
    this.pendingCollections.delete(ruleId);
    
    // ✅ Disable network nếu không còn pending nào
    if (this.pendingCollections.size === 0) {
        this.disableNetworkTracking();
    }
    
    // Call callback
    pending.callback(finalPayload);
}
```

---

## 🎯 So sánh Flow Cũ vs Mới

| Khía cạnh | Flow Cũ ❌ | Flow Mới ✅ |
|-----------|-----------|-----------|
| **Network Interceptor** | Enable lúc init, bắt TẤT CẢ requests | Enable on-demand, chỉ bắt khi có pending |
| **Timestamp** | Không check | Filter requests trong 5s window sau trigger |
| **Duplicate** | Không có cơ chế | Anti-duplicate: chỉ bắt 1 lần |
| **Data Validation** | Không validate | Validate xem request có data cần thiết không |
| **Context** | Chỉ có element | Đầy đủ: element, timestamp, eventType |
| **Callback** | Sync, gọi ngay | Async, chờ đủ dữ liệu mới gọi |
| **Cleanup** | Không có | Auto-cleanup, disable network khi xong |

---

## 🔧 Ví dụ Hoạt động

### Scenario: User click nút Play → Track với ItemId từ API

#### 1. **User click `.play-button`**
```
[ClickPlugin] Click detected → Match rule "Click Play Button"
[ClickPlugin] ⏳ Rule requires network data
[ClickPlugin] Starting collection with context: {
    element: <button class="play-button">,
    eventType: 'click',
    triggerTimestamp: 1704556800000
}
```

#### 2. **PayloadBuilder bắt đầu thu thập**
```
[PayloadBuilder] startCollection for rule: "Click Play Button"
[PayloadBuilder] Required fields: ['ItemId', 'AnonymousId']
[PayloadBuilder] Has network fields: true
[PayloadBuilder] Enabling network interceptor
[PayloadBuilder] Collecting non-network data...
[PayloadBuilder] Collected: AnonymousId = "abc123" (from localStorage)
[PayloadBuilder] Waiting for network data...
```

#### 3. **App gửi request `/api/song/42/player`**
```
[NetworkExtractor] Intercepted: GET /api/song/42/player
[NetworkExtractor] Checking pending rule: 23
[NetworkExtractor] Request within window: 125ms after trigger ✅
[NetworkExtractor] Already captured: false ✅
[NetworkExtractor] Pattern match: ✅
[NetworkExtractor] Has required data: ✅
[NetworkExtractor] 🎯 Captured matching request!
```

#### 4. **PayloadBuilder nhận data và complete**
```
[PayloadBuilder] Network data received: ItemId = "42"
[PayloadBuilder] Check complete
[PayloadBuilder] Collected fields: ['AnonymousId', 'ItemId']
[PayloadBuilder] Missing fields: []
[PayloadBuilder] Completing collection
[PayloadBuilder] No more pending, disabling network tracking
```

#### 5. **Callback được gọi → Track event**
```
[ClickPlugin] ✅ Collection complete, tracking event with payload: {
    AnonymousId: "abc123",
    ItemId: "42"
}
[ClickPlugin] tracker.track() called
```

#### 6. **Nếu có request duplicate `/api/song/42/player` tiếp theo**
```
[NetworkExtractor] Intercepted: GET /api/song/42/player
[NetworkExtractor] Checking pending rule: 23
[NetworkExtractor] Already captured: true ❌
[NetworkExtractor] → IGNORING duplicate request
```

---

## ✅ Lợi ích của Flow Mới

1. **🎯 Chính xác cao**
   - Chỉ bắt requests xảy ra SAU trigger event
   - Filter theo timestamp (5s window)
   - Tránh bắt requests không liên quan

2. **🚫 Chống duplicate**
   - Flag `networkCaptured` để track trạng thái
   - Ignore các requests duplicate tự động
   - Chỉ track event 1 lần

3. **⚡ Performance tốt**
   - Network interceptor chỉ hoạt động khi cần
   - Auto-disable khi không còn pending
   - Không waste resource bắt requests không cần

4. **🧩 Dễ debug**
   - Log rõ ràng từng bước
   - Thấy được timestamp, window, validation
   - Biết chính xác request nào được bắt, request nào bị ignore

5. **🔄 Flow rõ ràng**
   - Trigger → Collect → Complete → Track
   - Context được truyền đầy đủ
   - Callback async khi đủ dữ liệu

---

## 📝 Backward Compatibility

- ✅ Method cũ `buildWithCallback()` vẫn hoạt động (marked as deprecated)
- ✅ `enableNetworkTracking()` vẫn tồn tại (show warning)
- ✅ Không breaking changes cho code hiện tại không dùng network data
- ✅ Các plugins không cần network data vẫn hoạt động bình thường

---

## 🚀 Next Steps (Nếu cần)

1. **Testing**
   - Test với các scenarios khác nhau
   - Test duplicate requests
   - Test timeout scenarios

2. **Optimization**
   - Có thể thêm cache cho pending collections
   - Có thể tune timeout window (hiện tại 5s)

3. **Monitoring**
   - Add metrics để track collection success rate
   - Monitor timeout cases

4. **Documentation**
   - Update README với flow mới
   - Thêm examples cho từng use case
