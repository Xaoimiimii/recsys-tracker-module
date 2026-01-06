# Phân tích Flow Hiện tại vs Flow Mong muốn

## 🎯 Flow Mong muốn

### 1. **Listen Event (Tracking Plugin)**
- Listen các hành vi: click, rating, review, scroll, page view
- Khi phát hiện event khớp với `TrackingTarget` → Set flag "chờ dữ liệu" → Gọi Payload Builder

### 2. **Payload Builder Thu thập Dữ liệu**
- Xem `PayloadMappings` để biết cần thu thập những field nào
- Với mỗi `Source` (LocalStorage, Cookie, RequestBody, RequestUrl, etc.):
  - Gọi extractor tương ứng
  - **ĐẶC BIỆT**: Với network sources (RequestBody, RequestUrl) → **Init network interceptor** để observe network

### 3. **Network Interceptor Chờ Request**
- Sau khi trigger element được tương tác → Request sẽ xuất hiện
- **LƯU Ý QUAN TRỌNG**:
  - Request cần bắt thường xuất hiện **NGAY SAU** tương tác
  - Có thể bị **duplicate request** → Cần chọn request khớp gần nhất có chứa dữ liệu
  - **Chỉ bắt request khi flag = "chờ dữ liệu"**
  - Sau khi bắt được request → Ignore các request tương tự cho đến khi flag được reset

### 4. **Hoàn thiện Payload và Gửi Event**
- Khi đủ dữ liệu → Tạo payload hoàn chỉnh
- Gửi lại cho tracking plugin
- Plugin set flag = "không chờ" → Gửi event về server

---

## 🔍 Flow Hiện tại

### Vấn đề chính:

#### ❌ **1. Network Interceptor được khởi tạo quá sớm**
**File**: `packages/sdk/src/core/payload/payload-builder.ts`

```typescript
public setConfig(config: any): void {
    this.trackerConfig = config;
    this.checkAndEnableNetworkTracking();  // ← Khởi tạo ngay khi set config
    this.checkAndEnableRequestUrlTracking();
}
```

**Vấn đề**: 
- Network interceptor được bật ngay khi có config
- Không chờ đến khi có trigger event
- Bắt TẤT CẢ requests → Không biết request nào liên quan đến event nào

#### ❌ **2. Không có cơ chế "chờ dữ liệu" cho từng rule**
**File**: `packages/sdk/src/core/plugins/click-plugin.ts`

```typescript
if (requiresNetworkData) {
    console.log('[ClickPlugin] Rule requires network data. Signaling pending network event for rule:', rule.id);
    if (this.tracker && typeof this.tracker.addPendingNetworkRule === 'function') {
        this.tracker.addPendingNetworkRule(rule.id);  // ← Chỉ set flag global
    }
    break;
}
```

**Vấn đề**:
- Chỉ set flag "có pending rule"
- KHÔNG gọi PayloadBuilder để bắt đầu thu thập dữ liệu
- Không truyền context (element, timestamp, etc.) để PayloadBuilder biết event nào cần xử lý

#### ❌ **3. Network Interceptor không biết request nào cần bắt**
**File**: `packages/sdk/src/core/payload/extractors/network-extractor.ts`

```typescript
private handleNetworkRequest(url: string, method: string, reqBody: any, resBody: any): void {
    // Bắt TẤT CẢ requests
    // Không có thông tin về:
    // - Rule nào đang chờ dữ liệu
    // - Trigger event xảy ra lúc nào
    // - Element nào được tương tác
    // - Request nào là "gần nhất" sau trigger
}
```

**Vấn đề**:
- Bắt tất cả requests mà không quan tâm đến trigger
- Không có timestamp để xác định request "gần nhất"
- Không có cơ chế ignore duplicate

#### ❌ **4. RequestUrlExtractor không đủ thông minh**
**File**: `packages/sdk/src/core/payload/extractors/request-url-extractor.ts`

```typescript
extract(mapping: PayloadMapping, _context?: any): any {
    // Chỉ lấy request gần nhất trong history
    // Không check:
    // - Request có xảy ra SAU trigger không?
    // - Request có duplicate không?
    // - Request có chứa dữ liệu cần thiết không?
}
```

#### ❌ **5. PayloadBuilder.buildWithCallback không theo đúng flow**

```typescript
public buildWithCallback(
    context: any,
    rule: TrackingRule,
    callback: (payload: Record<string, any>, rule: TrackingRule, context: any) => void
): void {
    console.log('[PayloadBuilder] buildWithCallback called for rule:', rule.name);
    const payload = this.build(context, rule);  // ← Build ngay lập tức
    console.log('[PayloadBuilder] Payload built:', payload);
    callback(payload, rule, context);  // ← Callback ngay
}
```

**Vấn đề**:
- Build payload **đồng bộ** (sync)
- Không chờ network data
- Callback được gọi ngay lập tức dù network data chưa có

---

## ✅ Giải pháp - Flow Mới

### **1. Tracking Plugin phát hiện event → Gọi PayloadBuilder với pending state**

```typescript
// click-plugin.ts
if (requiresNetworkData) {
    // Set pending state với đầy đủ context
    const pendingContext = {
        rule: rule,
        element: target,
        timestamp: Date.now(),
        eventType: 'click'
    };
    
    // Gọi PayloadBuilder để bắt đầu thu thập
    this.tracker.payloadBuilder.startCollection(
        pendingContext,
        rule,
        (finalPayload) => {
            // Callback khi đủ dữ liệu
            this.buildAndTrack(target, rule, rule.eventTypeId, finalPayload);
        }
    );
    break;
}
```

### **2. PayloadBuilder quản lý pending requests**

```typescript
// payload-builder.ts
private pendingCollections: Map<number, PendingCollection> = new Map();

interface PendingCollection {
    rule: TrackingRule;
    context: any;
    timestamp: number;
    callback: (payload: any) => void;
    collectedData: Map<string, any>;
    requiredFields: Set<string>;
}

public startCollection(
    context: any,
    rule: TrackingRule,
    callback: (payload: any) => void
): void {
    // Phân tích xem cần thu thập gì
    const requiredFields = this.analyzeRequiredFields(rule);
    const hasNetworkFields = this.hasNetworkFields(rule);
    
    // Tạo pending collection
    const pending: PendingCollection = {
        rule,
        context,
        timestamp: Date.now(),
        callback,
        collectedData: new Map(),
        requiredFields
    };
    
    this.pendingCollections.set(rule.id, pending);
    
    // Nếu cần network data → Enable interceptor NGAY LÚC NÀY
    if (hasNetworkFields) {
        this.enableNetworkInterceptorForRule(rule);
    }
    
    // Thu thập non-network data ngay
    this.collectNonNetworkData(pending);
    
    // Check xem đã đủ chưa
    this.checkAndComplete(rule.id);
}
```

### **3. Network Extractor chỉ bắt request khi có pending**

```typescript
// network-extractor.ts
private handleNetworkRequest(url: string, method: string, reqBody: any, resBody: any): void {
    const timestamp = Date.now();
    
    // Lặp qua các pending collections
    for (const [ruleId, pending] of this.payloadBuilder.pendingCollections) {
        // Check xem request có khớp với rule không
        if (!this.matchesRule(url, method, pending.rule)) continue;
        
        // Check xem request có xảy ra SAU trigger không (trong 5s)
        if (timestamp - pending.timestamp > 5000) continue;
        
        // Check xem đã bắt request cho rule này chưa (anti-duplicate)
        if (pending.collectedData.has('__network_captured')) {
            console.log('[NetworkExtractor] Ignoring duplicate request for rule:', ruleId);
            continue;
        }
        
        // Validate xem request có chứa dữ liệu cần thiết không
        if (!this.validateRequestHasRequiredData(reqBody, resBody, pending.rule)) {
            console.log('[NetworkExtractor] Request missing required data, continuing to wait...');
            continue;
        }
        
        // ✅ Bắt được request đúng!
        console.log('[NetworkExtractor] Captured matching request for rule:', ruleId);
        
        // Mark là đã bắt
        pending.collectedData.set('__network_captured', true);
        
        // Extract data
        const networkContext = { reqBody, resBody, method, url };
        for (const mapping of pending.rule.payloadMappings) {
            if (this.isNetworkSource(mapping.source)) {
                const value = this.extract(mapping, networkContext);
                pending.collectedData.set(mapping.field, value);
            }
        }
        
        // Check xem đã đủ dữ liệu chưa
        this.payloadBuilder.checkAndComplete(ruleId);
        
        // IMPORTANT: Sau khi bắt được → Disable interceptor cho rule này
        // Để tránh bắt các requests tiếp theo
        break;
    }
}
```

### **4. RequestUrlExtractor chỉ tìm request SAU trigger**

```typescript
// request-url-extractor.ts
extract(mapping: PayloadMapping, _context?: any): any {
    // Nếu có context với timestamp → chỉ lấy requests SAU đó
    const triggerTime = _context?.triggerTimestamp || 0;
    
    // Iterate backwards (newest first)
    for (let i = this.history.length - 1; i >= 0; i--) {
        const req = this.history[i];
        
        // Check timestamp: request phải xảy ra SAU trigger
        if (req.timestamp < triggerTime) continue;
        
        // Check timeout: không quá 5s
        if (req.timestamp - triggerTime > 5000) continue;
        
        // Match pattern
        if (this.matches(req, mapping)) {
            return this.extractValueFromUrl(req.url, mapping.value);
        }
    }
    
    return null;
}
```

### **5. Complete và Callback**

```typescript
// payload-builder.ts
private checkAndComplete(ruleId: number): void {
    const pending = this.pendingCollections.get(ruleId);
    if (!pending) return;
    
    // Check xem đã đủ tất cả required fields chưa
    const hasAllFields = Array.from(pending.requiredFields).every(
        field => pending.collectedData.has(field)
    );
    
    if (hasAllFields) {
        // ✅ Đủ dữ liệu rồi!
        console.log('[PayloadBuilder] All data collected for rule:', ruleId);
        
        // Build final payload
        const finalPayload = Object.fromEntries(pending.collectedData);
        
        // Cleanup
        this.pendingCollections.delete(ruleId);
        
        // Disable network interceptor nếu không còn pending nào cần
        if (this.pendingCollections.size === 0) {
            this.disableNetworkTracking();
        }
        
        // Call callback
        pending.callback(finalPayload);
    }
}
```

---

## 🎯 Kết luận

### Những điểm cần thay đổi:

1. **PayloadBuilder**:
   - Thêm quản lý `pendingCollections`
   - Thêm method `startCollection()` thay vì `buildWithCallback()`
   - Network interceptor chỉ được enable khi có pending rule
   - Auto-disable khi không còn pending

2. **Network Extractor**:
   - Thêm check timestamp (request SAU trigger)
   - Thêm check duplicate (chỉ bắt 1 lần)
   - Thêm validate data (request phải có dữ liệu cần thiết)
   - Thêm reference đến PayloadBuilder để access pending collections

3. **RequestUrl Extractor**:
   - Thêm filter theo timestamp
   - Chỉ lấy requests trong window 5s sau trigger

4. **Tracking Plugins**:
   - Gọi `startCollection()` thay vì set flag rồi dừng
   - Pass context đầy đủ (element, timestamp, etc.)

5. **RecSysTracker**:
   - Có thể bỏ `pendingNetworkRules` Map (đã được quản lý bởi PayloadBuilder)

### Lợi ích:

✅ Network interceptor chỉ hoạt động khi cần
✅ Tránh duplicate requests
✅ Chọn đúng request gần nhất sau trigger  
✅ Validate data trước khi accept
✅ Auto-cleanup và disable khi hoàn thành
✅ Flow rõ ràng: Trigger → Collect → Complete → Track
