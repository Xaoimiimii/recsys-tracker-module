# Display Methods Integration

Tích hợp display methods (Popup và Inline) vào RecSys Tracker SDK.

## Tính năng

SDK tự động kích hoạt display methods dựa trên `returnMethodId` từ config:

- **returnMethodId = 1**: Popup (hiển thị recommendations dạng popup)
- **returnMethodId = 2**: Inline (hiển thị recommendations inline trong trang)

## Cách hoạt động

### 1. Khởi tạo tự động

Khi SDK khởi tạo (`RecSysTracker.init()`):
1. Fetch config từ server bao gồm `returnMethods`
2. Tự động khởi tạo `DisplayManager`
3. DisplayManager kích hoạt các display methods tương ứng

### 2. Popup Display (returnMethodId = 1)

**Cách hoạt động:**
- Hiển thị popup tự động sau một khoảng thời gian ngẫu nhiên (10-20s)
- Có carousel để xem các recommendations
- Tự động lên lịch hiển thị popup tiếp theo sau khi đóng

**Config format (value field):**
```json
{
  "minDelay": 10000,      // milliseconds, mặc định 10s
  "maxDelay": 20000,      // milliseconds, mặc định 20s
  "autoCloseDelay": 5000, // milliseconds, optional - tự động đóng
  "pages": ["*"]          // URL patterns, "*" = tất cả trang
}
```

**Return method từ server:**
```json
{
  "slotName": "homepage-popup",
  "returnMethodId": 1,
  "value": "{\"minDelay\":15000,\"maxDelay\":30000,\"pages\":[\"/\",\"/products/*\"]}"
}
```

### 3. Inline Display (returnMethodId = 2)

**Cách hoạt động:**
- Tìm kiếm các elements với selector được chỉ định
- Render recommendations vào các elements đó bằng Shadow DOM
- Tự động theo dõi DOM changes (MutationObserver) để render vào elements xuất hiện muộn

**Config format (value field):**
```
Selector CSS, ví dụ: ".recsys-recommendations" hoặc "#recs-container"
```

**Return method từ server:**
```json
{
  "slotName": "homepage-inline",
  "returnMethodId": 2,
  "value": ".recsys-recommendations"
}
```

**HTML trong trang:**
```html
<!-- Element này sẽ tự động được fill recommendations -->
<div class="recsys-recommendations"></div>
```

## API Endpoints

DisplayManager tự động fetch recommendations từ:

```
GET {API_URL}/recommendations?domainKey={domainKey}&slot={slotName}
```

**Response format:**
```json
[
  {
    "id": 1,
    "name": "Sản phẩm 1",
    "img": "https://...",
    "price": "199.000đ"
  },
  {
    "id": 2,
    "name": "Sản phẩm 2",
    "img": "https://...",
    "price": "299.000đ"
  }
]
```

## Cấu trúc Code

```
src/core/display/
├── display-manager.ts     # Quản lý và khởi tạo display methods
├── popup-display.ts       # Xử lý Popup (returnMethodId = 1)
├── inline-display.ts      # Xử lý Inline (returnMethodId = 2)
└── types.ts              # TypeScript types
```

## Testing

### Test Popup

1. Thêm return method vào database:
```sql
INSERT INTO ReturnMethod (SlotName, ReturnMethodID, Value, DomainID)
VALUES ('test-popup', 1, '{"minDelay":5000,"maxDelay":10000}', your_domain_id);
```

2. SDK sẽ tự động hiển thị popup sau 5-10 giây

### Test Inline

1. Thêm return method vào database:
```sql
INSERT INTO ReturnMethod (SlotName, ReturnMethodID, Value, DomainID)
VALUES ('test-inline', 2, '.my-recs', your_domain_id);
```

2. Thêm element vào HTML:
```html
<div class="my-recs"></div>
```

3. SDK sẽ tự động render recommendations vào element đó

## Shadow DOM

Cả popup và inline đều sử dụng Shadow DOM để:
- Tránh CSS conflicts với trang web
- Đảm bảo styling độc lập
- Không ảnh hưởng đến DOM của trang

## Cleanup

Khi `RecSysTracker.destroy()` được gọi:
- Tất cả timeouts/intervals được clear
- MutationObservers được disconnect
- Shadow DOM elements được remove

## Ví dụ sử dụng

```html
<!DOCTYPE html>
<html>
<head>
  <title>Test Display Methods</title>
</head>
<body>
  <!-- Inline recommendation slot -->
  <div class="recsys-recommendations"></div>

  <!-- Load SDK -->
  <script>
    window.__RECSYS_DOMAIN_KEY__ = 'your-domain-key';
  </script>
  <script src="recsys-tracker.iife.js"></script>
</body>
</html>
```

SDK sẽ tự động:
1. Fetch config từ server
2. Nhận được returnMethods
3. Kích hoạt popup nếu returnMethodId = 1
4. Render inline nếu returnMethodId = 2 và có element `.recsys-recommendations`
