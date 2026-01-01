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
  static generate(
    width: number = 180,
    height: number = 130,
    text: string = 'No Image',
    bgColor: string = '#e0e0e0',
    textColor: string = '#666'
  ): string {
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
  static generateGradient(
    width: number = 180,
    height: number = 130
  ): string {
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
  static generateSVG(
    width: number = 180,
    height: number = 130,
    text: string = 'No Image'
  ): string {
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
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Fallback image khi không thể tạo canvas
   * @returns Base64 data URL của 1x1 transparent pixel
   */
  private static getFallbackImage(): string {
    // 1x1 transparent pixel
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  /**
   * Get default placeholder cho recommendation items
   * @returns Base64 data URL
   */
  static getDefaultRecommendation(): string {
    return this.generateSVG(180, 130, '📦');
  }
}
