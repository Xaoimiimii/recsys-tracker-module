export declare class PlaceholderImage {
    /**
     * Tạo base64 placeholder image với text
     * @param width - Width của image
     * @param height - Height của image
     * @param text - Text hiển thị trên image
     * @param bgColor - Background color (hex)
     * @param textColor - Text color (hex)
     * @returns Base64 data URL của image
     */
    static generate(width?: number, height?: number, text?: string, bgColor?: string, textColor?: string): string;
    /**
     * Tạo gradient placeholder image
     * @param width - Width của image
     * @param height - Height của image
     * @returns Base64 data URL của image
     */
    static generateGradient(width?: number, height?: number): string;
    /**
     * SVG placeholder image (nhỏ gọn hơn)
     * @param width - Width của image
     * @param height - Height của image
     * @param text - Text hiển thị
     * @returns SVG data URL
     */
    static generateSVG(width?: number, height?: number, text?: string): string;
    /**
     * Fallback image khi không thể tạo canvas
     * @returns Base64 data URL của 1x1 transparent pixel
     */
    private static getFallbackImage;
    /**
     * Get default placeholder cho recommendation items
     * @returns Base64 data URL
     */
    static getDefaultRecommendation(): string;
}
//# sourceMappingURL=placeholder-image.d.ts.map