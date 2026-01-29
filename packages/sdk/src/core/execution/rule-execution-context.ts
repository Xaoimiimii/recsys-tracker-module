/**
 * RuleExecutionContext (REC)
 * 
 * Đại diện cho MỘT LẦN TRIGGER CỤ THỂ của một rule.
 * Không phải là rule config, mà là instance của một lần thực thi.
 * 
 * Nguyên tắc:
 * - Mỗi trigger (click, rating, review, etc.) tạo 1 REC riêng
 * - REC theo dõi trạng thái thu thập dữ liệu
 * - REC có TIME_WINDOW để match với network requests
 * - REC có MAX_WAIT_TIME để tự cleanup nếu không hoàn thành
 */

export type RuleExecutionStatus = 'pending' | 'completed' | 'expired';

export interface RuleExecutionContext {
  /** Unique ID cho execution này (không phải ruleId) */
  executionId: string;
  
  /** Rule ID từ config */
  ruleId: number;
  
  /** Timestamp khi trigger xảy ra */
  triggeredAt: number;
  
  /** Trạng thái hiện tại */
  status: RuleExecutionStatus;
  
  /** Các field cần thu thập (từ PayloadMappings) */
  requiredFields: Set<string>;
  
  /** Dữ liệu đã thu thập được */
  collectedFields: Map<string, any>;
  
  /** Context của trigger (element, eventType, etc.) */
  triggerContext: any;
  
  /** Callback khi hoàn thành */
  onComplete?: (payload: Record<string, any>) => void;
  
  /** Timeout handler để cleanup */
  timeoutHandle?: any;
}

/**
 * RuleExecutionContextManager
 * Quản lý tất cả các REC đang active
 */
export class RuleExecutionContextManager {
  private contexts: Map<string, RuleExecutionContext> = new Map();
  private readonly TIME_WINDOW = 3000; // 3s - Request phải xảy ra trong window này
  private readonly MAX_WAIT_TIME = 1000; // 1s - Tự động expire nếu quá thời gian (giảm từ 5s để UX tốt hơn)

  /**
   * Tạo REC mới cho một trigger
   */
  createContext(
    ruleId: number,
    requiredFields: string[],
    triggerContext: any,
    onComplete?: (payload: Record<string, any>) => void
  ): RuleExecutionContext {
    const executionId = this.generateExecutionId();

    const context: RuleExecutionContext = {
      executionId,
      ruleId,
      triggeredAt: Date.now(),
      status: 'pending',
      requiredFields: new Set(requiredFields),
      collectedFields: new Map(),
      triggerContext,
      onComplete
    };

    // Setup auto-cleanup
    context.timeoutHandle = setTimeout(() => {
      this.expireContext(executionId);
    }, this.MAX_WAIT_TIME);

    this.contexts.set(executionId, context);

    return context;
  }

  /**
   * Lấy context theo executionId
   */
  getContext(executionId: string): RuleExecutionContext | undefined {
    return this.contexts.get(executionId);
  }

  /**
   * Lấy tất cả pending contexts cho một rule cụ thể
   */
  getPendingContextsForRule(ruleId: number): RuleExecutionContext[] {
    const results: RuleExecutionContext[] = [];
    
    for (const context of this.contexts.values()) {
      if (context.ruleId === ruleId && context.status === 'pending') {
        results.push(context);
      }
    }
    
    return results;
  }

  /**
   * Tìm context phù hợp cho một network request
   * Điều kiện:
   * - Status = pending
   * - RuleId match
   * - Request timestamp trong TIME_WINDOW
   */
  findMatchingContext(
    ruleId: number,
    requestTimestamp: number
  ): RuleExecutionContext | undefined {
    for (const context of this.contexts.values()) {
      if (
        context.ruleId === ruleId &&
        context.status === 'pending' &&
        requestTimestamp >= context.triggeredAt &&
        requestTimestamp <= context.triggeredAt + this.TIME_WINDOW
      ) {
        return context;
      }
    }
    return undefined;
  }

  /**
   * Thay thế một required field bằng field khác
   * Dùng cho fallback UserId/Username -> AnonymousId
   */
  replaceRequiredField(executionId: string, oldField: string, newField: string): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      return;
    }
    if (context.status !== 'pending') {
      return;
    }

    if (context.requiredFields.has(oldField)) {
      context.requiredFields.delete(oldField);
      context.requiredFields.add(newField);
    }
  }

  /**
   * Thu thập một field vào context
   */
  collectField(executionId: string, field: string, value: any): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      return;
    }

    if (context.status !== 'pending') {
      return;
    }

    context.collectedFields.set(field, value);
    
    // Check nếu đã đủ dữ liệu
    this.checkCompletion(executionId);
  }

  /**
   * Kiểm tra nếu context đã thu thập đủ dữ liệu
   */
  private checkCompletion(executionId: string): void {
    const context = this.contexts.get(executionId);
    if (!context || context.status !== 'pending') {
      return;
    }

    // Check nếu tất cả required fields đã có
    const requiredFieldsArray = Array.from(context.requiredFields);
    const missingFields = requiredFieldsArray.filter(
      field => !context.collectedFields.has(field)
    );
    
    const allFieldsCollected = missingFields.length === 0;

    if (allFieldsCollected) {
      this.completeContext(executionId);
    }
  }

  /**
   * Đánh dấu context là completed và trigger callback
   */
  private completeContext(executionId: string): void {
    const context = this.contexts.get(executionId);
    if (!context || context.status !== 'pending') {
      return;
    }

    context.status = 'completed';
    
    // Clear timeout
    if (context.timeoutHandle) {
      clearTimeout(context.timeoutHandle);
    }

    // Build payload từ collected fields
    const payload: Record<string, any> = {};
    context.collectedFields.forEach((value, key) => {
      payload[key] = value;
    });

    // Trigger callback
    if (context.onComplete) {
      context.onComplete(payload);
    }

    // Cleanup sau 1s (giữ một chút để debug)
    setTimeout(() => {
      this.contexts.delete(executionId);
    }, 1000);
  }

  /**
   * Đánh dấu context là expired (timeout)
   * QUAN TRỌNG: Vẫn gọi callback với data đã có, kể cả khi không đủ required fields
   * Điều này đảm bảo event vẫn được gửi ngay cả khi user không đăng nhập
   */
  private expireContext(executionId: string): void {
    const context = this.contexts.get(executionId);
    if (!context || context.status !== 'pending') {
      return;
    }

    //console.log('[REC] Context expired, calling callback with collected data:', executionId);

    context.status = 'expired';

    // Build payload từ collected fields (dù có đủ hay không)
    const payload: Record<string, any> = {};
    context.collectedFields.forEach((value, key) => {
      payload[key] = value;
    });

    //console.log('[REC] Collected payload on timeout:', payload);

    // Trigger callback với data đã có
    if (context.onComplete) {
      context.onComplete(payload);
    }

    // Cleanup
    setTimeout(() => {
      this.contexts.delete(executionId);
    }, 1000);
  }

  /**
   * Cleanup một context (manual)
   */
  cleanupContext(executionId: string): void {
    const context = this.contexts.get(executionId);
    if (context && context.timeoutHandle) {
      clearTimeout(context.timeoutHandle);
    }
    this.contexts.delete(executionId);
  }

  /**
   * Get số lượng active contexts (for debugging)
   */
  getActiveCount(): number {
    return Array.from(this.contexts.values()).filter(
      c => c.status === 'pending'
    ).length;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear all contexts (for testing/cleanup)
   */
  clearAll(): void {
    for (const context of this.contexts.values()) {
      if (context.timeoutHandle) {
        clearTimeout(context.timeoutHandle);
      }
    }
    this.contexts.clear();
  }
}
