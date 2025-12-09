# RecSys Tracker SDK - Testing Guide

## Hướng dẫn Test SDK

### 1. Chuẩn bị

#### Bước 1: Khởi động Server API
```bash
cd packages/server
npm run start:dev
```
Server sẽ chạy tại: `http://localhost:3000`

#### Bước 2: Build SDK
```bash
cd packages/sdk
npm run build
```

#### Bước 3: Khởi động Test Server
```bash
cd packages/sdk/test
npx http-server -p 8080 --cors
```
Test page sẽ chạy tại: `http://localhost:8080`

### 2. Các Trang Test

#### 2.1. Test Manual (index.html)
Mở: `http://localhost:8080/index.html`

Trang này cho phép test thủ công từng API:
- Nhập domain key
- Test API `GET /domain/{key}`
- Test API `GET /rule/domain/{key}`
- Test API `GET /domain/return-method/{key}`
- Xem full config của SDK

#### 2.2. Demo Page (demo.html)
Mở: `http://localhost:8080/demo.html`

Trang demo thực tế với:
- Button tracking (Add to Cart, Buy Now, Wishlist)
- Product card click tracking
- Link click tracking
- Real-time event log hiển thị trên page

### 3. Tích hợp vào Website

#### Cách 1: Sử dụng IIFE (Khuyến nghị cho script tag)
```html
<head>
  <!-- Bước 1: Cấu hình trước -->
  <script>
    window.RecSysTrackerConfig = {
      domainKey: 'YOUR_DOMAIN_KEY_HERE',
      debug: true // Tắt trong production
    };
  </script>
  
  <!-- Bước 2: Load SDK -->
  <script src="https://your-cdn.com/recsys-tracker.iife.js"></script>
</head>
```

#### Cách 2: Sử dụng ESM (Cho modern apps)
```javascript
import RecSysTracker from '@recsys-tracker/sdk';

const tracker = new RecSysTracker();
await tracker.init();
```

### 4. Lấy Domain Key

#### Tạo domain key mới:
```bash
# Gọi API create domain
POST http://localhost:3000/domain/create
Content-Type: application/json

{
  "ternantId": 1,
  "url": "https://your-website.com",
  "type": 1
}
```

Response sẽ chứa `Key` (domain key) để sử dụng.

### 5. Kiểm tra trong Browser Console

Sau khi load SDK, kiểm tra:
```javascript
// Kiểm tra SDK đã load
console.log(window.RecSysTracker);

// Kiểm tra config
console.log(window.RecSysTrackerConfig);
```

Logs từ SDK:
- `[RecSysTracker] Initializing...` - SDK đang khởi tạo
- `[RecSysTracker] Loading remote config...` - Đang fetch config từ server
- `[RecSysTracker] Tracker initialized successfully` - Thành công!

### 6. Troubleshooting

#### Lỗi: Failed to fetch
- Kiểm tra server đang chạy tại port 3000
- Kiểm tra CORS đã được enable trong server
- Kiểm tra domain key có tồn tại trong database

#### Lỗi: SDK not loaded
- Kiểm tra đường dẫn file SDK đúng
- Kiểm tra SDK đã được build (`npm run build`)

#### Lỗi: Config not found
- Đảm bảo `window.RecSysTrackerConfig` được set TRƯỚC khi load SDK
- Kiểm tra domain key đúng format

### 7. Test Checklist

- [ ] Server API chạy ở port 3000
- [ ] SDK đã build thành công
- [ ] Test server chạy ở port 8080
- [ ] Có domain key hợp lệ từ database
- [ ] Mở index.html và test các API
- [ ] Mở demo.html và test tracking events
- [ ] Kiểm tra console logs
- [ ] Kiểm tra Network tab (F12) xem requests

### 8. File Structures

```
packages/sdk/test/
├── index.html              # Manual test page
├── demo.html               # Demo tracking page
├── loader-example.html     # Example loader script
└── README.md              # This file
```

### 9. Next Steps

Sau khi test thành công:
1. Deploy SDK lên CDN
2. Cập nhật API_URL trong .env (production)
3. Tích hợp vào website thực tế
4. Setup tracking rules trong admin panel
5. Monitor events trong dashboard
