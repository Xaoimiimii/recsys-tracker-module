// // src/api.js

// // Hàm này sẽ gọi API thật của bạn sau này
// export async function fetchRecommendations(slotName, siteId) {
//     console.log(`[API] Fetching for slot: ${slotName}, site: ${siteId}`);
    
//     // Giả lập network delay
//     await new Promise(r => setTimeout(r, 500));

//     // Dữ liệu giả lập (Mock)
//     return [
//         { id: 1, name: "Áo Thun Nam Đơn Giản", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "199.000đ" },
//         { id: 2, name: "Giày Sneaker Thể Thao", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "799.000đ" },
//         { id: 3, name: "Túi Đeo Chéo Unisex", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "249.000đ" }
//     ];
// }








////////////////////////////////////////////
// 2
////////////////////////////////////////////

// // src/api.js

// // Vite sẽ thay thế __API_URL__ bằng chuỗi link thật khi build
// // Nếu đang chạy dev (chưa build), ta fallback về localhost hoặc để trống
// const API_BASE = typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'http://localhost:3000';

// export async function fetchRecommendations(slotName, siteId) {
//     // 1. Nếu là môi trường DEV (Localhost) -> Trả về Mock Data để test cho nhanh
//     if (import.meta.env.DEV) {
//         console.log(`[Mock API] Fetching ${slotName}...`);
//         await new Promise(r => setTimeout(r, 500));
//         return [
//             { id: 1, name: "Áo Thun Nam Đơn Giản", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "199.000đ" },
//             { id: 2, name: "Giày Sneaker Thể Thao", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "799.000đ" },
//             { id: 3, name: "Túi Đeo Chéo Unisex", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "249.000đ" }
//         ];
//     }

//     // 2. Nếu là môi trường PRODUCTION (Đã build) -> Gọi Server thật
//     try {
//         const response = await fetch(`${API_BASE}/recommendations?siteId=${siteId}&slot=${slotName}`);
//         if (!response.ok) throw new Error('API Error');
//         return await response.json();
//     } catch (err) {
//         console.error("[MyRecSDK] API Fetch Error:", err);
//         return [];
//     }
// }




////////////////////////////////////////////
// 3
////////////////////////////////////////////

// src/api.js

// Lấy URL từ config build, nếu không có thì fallback
const API_BASE = typeof __API_URL__ !== 'undefined' ? __API_URL__ : '';

export async function fetchRecommendations(slotName, siteId) {
    console.log(`[SDK] Fetching recommendations for ${slotName}...`);

    // --- SỬA ĐỔI: Luôn trả về Mock Data để test UI (Bỏ check môi trường DEV) ---
    // Khi nào có Backend thật thì xóa đoạn này đi
    const useMock = true; 

    if (useMock) {
        await new Promise(r => setTimeout(r, 500)); // Giả lập mạng chậm
        return [
            { id: 1, name: "Áo Thun Nam Đơn Giản", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "199.000đ" },
            { id: 2, name: "Giày Sneaker Thể Thao", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "799.000đ" },
            { id: 3, name: "Túi Đeo Chéo Unisex", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQflPrgv4PvP55D0Qhg8nfVjey8Azwm-cDGbw&s", price: "249.000đ" }
        ];
    }

    // --- Code gọi API thật (Sẽ chạy khi biến useMock = false) ---
    try {
        const response = await fetch(`${API_BASE}/recommendations?siteId=${siteId}&slot=${slotName}`);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (err) {
        console.error("[MyRecSDK] API Fetch Error:", err);
        return [];
    }
}