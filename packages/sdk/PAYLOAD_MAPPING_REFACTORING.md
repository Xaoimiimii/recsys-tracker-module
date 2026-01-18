# Payload Mapping Refactoring - API Structure Changes

## Tổng quan

Document này mô tả các thay đổi trong SDK để hỗ trợ cấu trúc API mới với:
1. **Config object** trong PayloadMapping (bắt buộc - không còn legacy fields)
2. **UserIdentity** tách riêng khỏi PayloadMapping
3. **ExtractType** mới cho request_url source (pathname/query)
4. **Flexible URL pattern matching** (hỗ trợ nhiều cách config pattern)

> **⚠️ BREAKING CHANGES:** SDK chỉ hỗ trợ cấu trúc mới với Config object. Legacy format đã bị loại bỏ hoàn toàn.

## 1. API Response Structure

### PayloadMapping Structure (CHỈ MỚI)

```json
{
  "Field": "ItemId",
  "Source": "request_url",
  "Config": {
    "RequestUrlPattern": "/api/song/{id}",
    "RequestMethod": "GET",
    "Value": "3",
    "ExtractType": "pathname"
  }
}
```

### UserIdentity Structure (Mới)

UserIdentity giờ là một config riêng biệt, không còn trong PayloadMapping:

```json
{
  "Id": 1,
  "Source": "request_body",
  "DomainId": 20,
  "RequestConfig": {
    "RequestUrlPattern": "/api/user/profile",
    "RequestMethod": "GET",
    "Value": "data.userId"
  },
  "Field": "UserId"
}
```

## 2. ExtractType cho request_url

### Pathname Extraction

Lấy segment từ URL path theo index (0-based):

```json
{
  "Field": "ItemId",
  "Source": "request_url",
  "Config": {
    "RequestUrlPattern": "/api/song/{id}",
    "RequestMethod": "GET",
    "Value": "3",
    "ExtractType": "pathname"
  }
}
```

**URL:** `https://example.com/api/song/2912917937/details`
**Result:** `2912917937` (segment tại index 3)

### Query Parameter Extraction

Lấy giá trị từ query parameter:

```json
{
  "Field": "ItemId",
  "Source": "request_url",
  "Config": {
    "RequestUrlPattern": "/api/song/{id}",
    "RequestMethod": "GET",
    "Value": "item_id",
    "ExtractType": "query"
  }
}
```

**URL:** `https://example.com/api/song?item_id=123`
**Result:** `123`

## 3. Flexible URL Pattern Matching

SDK giờ hỗ trợ nhiều cách config URL pattern:

### Ví dụ URL: `https://example.com/api/product/2912917937/details`

**Các pattern sau ĐỀU MATCH được:**

```
✅ "/api/product/:id/details"
✅ "/api/product/{id}/details"
✅ "api/product/:id/details"       (không có leading slash)
✅ "product/:id/details"            (partial path)
✅ "api/product"                    (partial path)
✅ "product"                        (partial path)
```

**Logic matching:**
- **Exact match**: Pattern phải match chính xác với full path
- **Partial match**: Các segments trong pattern tồn tại theo thứ tự trong URL
- **Dynamic segments**: `:param` hoặc `{param}` match với bất kỳ giá trị nào

## 4. Changes Summary

### Files Modified

1. **types/index.ts**
   - Thêm `PayloadMappingConfig` interface
   - Thêm `UserIdentityConfig` và `UserIdentityRequestConfig` interfaces
   - Cập nhật `PayloadMapping` để hỗ trợ `config` object
   - Giữ legacy fields để backward compatibility

2. **config/config-loader.ts**
   - Cập nhật `transformPayloadMappings()` để map Config object sang PayloadMapping
   - Đơn giản hóa, không còn flatten vào legacy fields

3. **user/user-identity-manager.ts** (MỚI)
   - Class mới để quản lý user identity riêng biệt
   - Load user identity config từ API (mock)
   - Extract user info từ network/static sources
   - Save vào localStorage
   - Provide user info khi gửi event

4. **utils/path-matcher.ts**
   - Cải thiện `match()` để hỗ trợ flexible patterns
   - Thêm `matchPartialPath()` cho partial matching
   - Thêm `extractParams()` để extract dynamic values
   - Thêm `extractByIndex()` để extract by segment index

5. **payload/extractors/url-extractor.ts**
   - Chỉ hỗ trợ Config object với ExtractType
   - Xử lý 'query' và 'pathname' ExtractType
   - **Đã xóa legacy format**

6. **network/network-observer.ts**
   - Tích hợp UserIdentityManager
   - Chỉ đọc từ Config object
   - **Đã xóa logic backward compatibility**
   - Xóa `registerUserInfoMappings()` (không còn cần)

7. **payload/payload-builder.ts**
   - Xóa logic user info cũ
   - Cập nhật extractors để dùng Config object
   - **Đã xóa legacy field access**

8. **index.ts**
   - Thêm `userIdentityManager` instance
   - Initialize UserIdentityManager trong init lifecycle
   - Connect UserIdentityManager với NetworkObserver
   - Cập nhật `track()` để lấy user info từ UserIdentityManager

## 5. Breaking Changes

### ⚠️ Legacy Format Đã Bị Xóa

SDK **không còn hỗ trợ** cấu trúc cũ. API backend PHẢI trả về Config object.

**Không còn hoạt động:**
```typescript
{
  field: "ItemId",
  source: "request_url",
  requestUrlPattern: "/api/song/{id}",
  requestMethod: "GET",
  urlPart: "pathname",
  urlPartValue: "3"
}
```

**Bắt buộc phải dùng:**
```typescript
{
  field: "ItemId",
  source: "request_url",
  config: {
    RequestUrlPattern: "/api/song/{id}",
    RequestMethod: "GET",
    Value: "3",
    ExtractType: "pathname"
  }
}
```

### Migration Required

Nếu API backend chưa cập nhật:
1. **API PHẢI trả về Config object** - không còn fallback
2. **Tất cả mappings phải có config** - không optional
3. **registerUserInfoMappings() đã bị xóa** - dùng UserIdentityManager

## 6. Backward Compatibility

**KHÔNG CÒN BACKWARD COMPATIBILITY**

SDK chỉ hỗ trợ cấu trúc mới. Vui lòng cập nhật API backend trước khi nâng cấp SDK.

## 7. UserIdentity Flow

### Old Flow (Deprecated)
```
PayloadMapping → NetworkObserver → Cache to localStorage
```

### New Flow
```
UserIdentityConfig → UserIdentityManager → Extract & Cache
                                         ↓
                                    NetworkObserver (delegate)
                                         ↓
                                    localStorage
```8

### Khi gửi event:
```
UserIdentityManager.getUserInfo()
  → Check localStorage cache
  → Return { field: "UserId", value: "123" }
     hoặc { field: "AnonymousId", value: "anon_xxx" }
```

## 7. Testing với Mock Data

UserIdentityManager hiện đang dùng mock data:

```typescript
const mockConfig: UserIdentityConfig = {
  id: 1,
  source: 'request_body',
  domainId: 20,
  requestConfig: {
   9RequestUrlPattern: '/api/user/profile',
    RequestMethod: 'GET',
    Value: 'data.userId'
  },
  field: 'UserId'
};
```

**TODO:** Thay bằng API call thực tế khi API sẵn sàng.

## 8. Examples

### Example 1: Click Play với pathname extraction

**API Response:**
```json
{
  "Id": 57,
  "Name": "Click Play",
  "EventTypeID": 1,
  "PayloadMapping": [
    {
      "Field": "ItemId",
      "Source": "request_url",
      "Config": {
        "RequestUrlPattern": "/api/song/{id}",
        "RequestMethod": "GET",
        "Value": "3",
        "ExtractType": "pathname"
      }
    }
  ],
  "TrackingTarget": ".play-button"
}
```

**User clicks:** `.play-button`
**Network request:** `GET https://example.com/api/song/2912917937`
**SDK extracts:** `ItemId = "2912917937"` (from pathname segment 3)

### Example 2: Add to Fav với query extraction

**API Response:**
```json
{
  "Id": 58,
  "Name": "Click Add to fav",
  "EventTypeID": 1,
  "PayloadMapping": [
    {
      "Field": "ItemId",
      "Source": "request_url",
      "Config": {
        "RequestUrlPattern": "/api/song/{id}",
        "RequestMethod": "GET",
        "Value": "item_id",
        "ExtractType": "query"
      }
    }
  ],
  "TrackingTarget": ".heart-button"
}
```

**User clicks:** `.heart-button`
**Network request:** `GET https://example.com/api/song?item_id=456`
**SDK extracts:** `ItemId = "456"` (from query param)

### Example 3: Rating với request_body

**API Response:**
```json
{
  "Id": 59,
  "Name": "Rating",
  "EventTypeID": 2,
  "PayloadMapping": [
    {
      "Field": "ItemId",
      "Source": "request_body",
      "Config": {
        "RequestUrlPattern": "/api/song/rating",
        "RequestMethod": "POST",
        "Value": "songId"
      }
    },
    {
      "Field": "Rating",
      "Source": "element",
      "Config": {
         "SelectorPattern": ".rating-input"
      }
    }
  ],
  "TrackingTarget": ".rating-form"
}
```10. Migration Guide

### API Backend Changes REQUIRED

1. **Cập nhật response structure** để include Config object (BẮT BUỘC)
2. **Tách UserIdentity** thành endpoint riêng: `GET /user-identity/{domainKey}`
3. **Không có fallback** - API phải trả về đúng format

### SDK Upgrade Steps

1. **Kiểm tra API backend đã cập nhật chưa**
2. **Update SDK** - breaking changes included
3. **Test thoroughly** - không có backward compatibility

## 11Cập nhật response structure** để include Config object
2. **Tách UserIdentity** thành endpoint riêng: `GET /user-identity/{domainKey}`
3. **Không cần thay đổi ngay** - SDK vẫn hỗ trợ cấu trúc cũ

### Nếu bạn đang sử dụng SDK:

1. **Không cần thay đổi code** - SDK tự động xử lý
2. **UserIdentity tự động load** khi SDK init
3. **Flexible URL patterns** hoạt động ngay lập tức

## 10. Notes

- **0-based indexing**: Segment index bắt đầu từ 0
- **Pattern matching**: Hỗ trợ cả `:param` và `{param}` syntax
- **Partial matching**: Pattern không cần match full path
- **User identity**: Luôn có AnonymousId fallback nếu không có UserId
