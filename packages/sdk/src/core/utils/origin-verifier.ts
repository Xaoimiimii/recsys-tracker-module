export class OriginVerifier {
  /**
   * Kiểm tra xem origin hiện tại có khớp với domainUrl đã đăng ký không
   * Thứ tự ưu tiên: 1. origin, 2. referrer
   * @param domainUrl - URL domain đã đăng ký (từ config)
   * @returns true nếu origin hoặc referrer khớp, false nếu không khớp
   */
  static verify(domainUrl: string): boolean {
    try {
      if (!domainUrl) {
        console.warn('[RecSysTracker] Cannot verify: domainUrl is missing');
        return false;
      }

      // bỏ qua verification nếu đang ở local
      if (this.isDevelopment()) {
        return true;
      }

      // Bỏ qua verification khi test với file:// protocol
      if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol;
        const origin = window.location.origin;

        if (protocol === 'file:' || origin === 'null' || origin === 'file://') {
          console.warn('[RecSysTracker] Skipping origin verification for file:// protocol (testing mode)');
          return true;
        }
      }

      // 1. Thử verify bằng origin trước
      const originValid = this.verifyByOrigin(domainUrl);
      if (originValid) {
        return true;
      }

      // 2. Fallback: verify bằng referrer
      const referrerValid = this.verifyByReferrer(domainUrl);
      if (referrerValid) {
        return true;
      }

      // Không có origin hoặc referrer, hoặc cả 2 đều không khớp
      console.warn('[RecSysTracker] Origin verification failed: no valid origin or referrer');
      return false;
    } catch (error) {
      console.error('[RecSysTracker] Error during origin verification:', error);
      return false;
    }
  }

  // Verify bằng window.location.origin
  private static verifyByOrigin(domainUrl: string): boolean {
    if (typeof window === 'undefined' || !window.location || !window.location.origin) {
      return false;
    }

    const currentOrigin = window.location.origin;
    const normalizedCurrent = this.normalizeUrl(currentOrigin);
    const normalizedDomain = this.normalizeUrl(domainUrl);

    const isValid = normalizedCurrent === normalizedDomain;

    if (!isValid) {
      console.warn('[RecSysTracker] Origin mismatch:', {
        current: normalizedCurrent,
        expected: normalizedDomain
      });
    }

    return isValid;
  }

  // Verify bằng document.referrer
  // Hỗ trợ so khớp host chính xác hoặc nhiều path (referrer.startsWith(domainUrl))
  private static verifyByReferrer(domainUrl: string): boolean {
    if (typeof document === 'undefined' || !document.referrer) {
      return false;
    }

    try {
      const referrerUrl = new URL(document.referrer);
      const domainUrlObj = new URL(domainUrl);

      // So khớp origin (protocol + host + port)
      const referrerOrigin = this.normalizeUrl(referrerUrl.origin);
      const domainOrigin = this.normalizeUrl(domainUrlObj.origin);

      if (referrerOrigin === domainOrigin) {
        return true;
      }

      // Fallback: Hỗ trợ nhiều path - kiểm tra referrer có bắt đầu với domainUrl không
      const normalizedReferrer = this.normalizeUrl(document.referrer);
      const normalizedDomain = this.normalizeUrl(domainUrl);

      if (normalizedReferrer.startsWith(normalizedDomain)) {
        return true;
      }

      console.warn('[RecSysTracker] Referrer mismatch:', {
        referrer: normalizedReferrer,
        expected: normalizedDomain
      });

      return false;
    } catch (error) {
      console.warn('[RecSysTracker] Failed to parse referrer:', error);
      return false;
    }
  }

  // Normalize URL để so sánh (loại bỏ trailing slash, lowercase)
  // Giữ nguyên path nếu có
  private static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Tạo URL chuẩn: protocol + hostname + port (nếu có) + pathname
      let normalized = `${urlObj.protocol}//${urlObj.hostname}`;

      // Thêm port nếu không phải port mặc định
      if (urlObj.port &&
        !((urlObj.protocol === 'http:' && urlObj.port === '80') ||
          (urlObj.protocol === 'https:' && urlObj.port === '443'))) {
        normalized += `:${urlObj.port}`;
      }

      // Thêm pathname (loại bỏ trailing slash)
      if (urlObj.pathname && urlObj.pathname !== '/') {
        normalized += urlObj.pathname.replace(/\/$/, '');
      }

      return normalized.toLowerCase();
    } catch {
      // Nếu không parse được URL, trả về chuỗi gốc lowercase, loại bỏ trailing slash
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  /**
   * Kiểm tra xem có đang ở môi trường development không
   * (localhost, 127.0.0.1, etc.)
   */
  static isDevelopment(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const hostname = window.location?.hostname || '';
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    );
  }
}
