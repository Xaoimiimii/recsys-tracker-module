export class PlaceholderImage {
    /**
     * Tạo base64 placeholder image với text
     * @param width - Width của image
     * @param height - Height của image
     * @param text - Text hiển thị trên image
     * @param bgColor - Background color (hex)
     * @param textColor - Text color (hex)
     * @returns Base64 data URL của image
     */
    static generate(width = 180, height = 130, text = 'No Image', bgColor = '#e0e0e0', textColor = '#666') {
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return this.getFallbackImage();
        }
        // Fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        // Add text
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width / 2, height / 2);
        // Convert to data URL
        return canvas.toDataURL('image/png');
    }
    /**
     * Tạo gradient placeholder image
     * @param width - Width của image
     * @param height - Height của image
     * @returns Base64 data URL của image
     */
    static generateGradient(width = 180, height = 130) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return this.getFallbackImage();
        }
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f5f5f5');
        gradient.addColorStop(0.5, '#e0e0e0');
        gradient.addColorStop(1, '#d5d5d5');
        // Fill with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        // Add icon
        ctx.fillStyle = '#999';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', width / 2, height / 2);
        return canvas.toDataURL('image/png');
    }
    /**
     * SVG placeholder image (nhỏ gọn hơn)
     * @param width - Width của image
     * @param height - Height của image
     * @param text - Text hiển thị
     * @returns SVG data URL
     */
    static generateSVG(width = 180, height = 130, text = 'No Image') {
        const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#e0e0e0"/>
        <text 
          x="50%" 
          y="50%" 
          font-family="Arial, sans-serif" 
          font-size="16" 
          font-weight="bold" 
          fill="#666" 
          text-anchor="middle" 
          dominant-baseline="middle"
        >
          ${text}
        </text>
      </svg>
    `;
        // Use URL encoding instead of btoa to support Unicode characters
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    /**
     * Fallback image khi không thể tạo canvas
     * @returns Base64 data URL của 1x1 transparent pixel
     */
    static getFallbackImage() {
        // 1x1 transparent pixel
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    /**
     * Get default placeholder cho recommendation items
     * @returns Base64 data URL
     */
    static getDefaultRecommendation() {
        return this.generateSVG(180, 130, '📦');
    }
}
//# sourceMappingURL=placeholder-image.js.map