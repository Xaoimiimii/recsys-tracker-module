import { Plugin, PluginContext, TrackingRule, PayloadConfig } from '../../types';
import { TRIGGER_MAP, PATTERN_MAP, OPERATOR_MAP } from '../../constants/index'; // Import constants từ index.ts

export class FormPlugin implements Plugin {
  name = 'smart-form-plugin';
  version = '5.0.0-pattern-matching';

  private context: PluginContext | null = null;
  private activeRules: TrackingRule[] = [];

  // Bind handlers để giữ context 'this'
  private handleSubmitBound = this.handleSubmit.bind(this);

  init(context: PluginContext) {
    this.context = context;
  }

  start() {
    if (!this.context || !this.context.config) return;

    const rules = this.context.config.trackingRules || [];
    
    // Lọc các rule liên quan đến plugin này
    // Ở đây ta quan tâm đến sự kiện RATE (ID: 2) -> Tương ứng hành động Submit Form đánh giá
    // Và CLICK (ID: 1) nếu muốn track click nút (tùy nhu cầu, nhưng code này tập trung vào Form/Rate)
    this.activeRules = rules.filter(r => 
        r.triggerEventId === TRIGGER_MAP.RATE || 
        r.triggerEventId === TRIGGER_MAP.CLICK
    );

    if (this.activeRules.length === 0) return;

    // Đăng ký listener
    // "thu thập ngay khi gửi dùng ấn nút" -> Lắng nghe sự kiện submit
    document.addEventListener('submit', this.handleSubmitBound, { capture: true });

    if ((this.context.config.options as any)?.['debug']) {
        console.log(`[FormPlugin] 🛡️ Started with ${this.activeRules.length} active rules.`);
    }
  }

  stop() {
    document.removeEventListener('submit', this.handleSubmitBound);
  }

  // --- HANDLER CHÍNH: SUBMIT (Dùng cho cả RATE) ---
  private handleSubmit(event: Event) {
    const form = event.target as HTMLFormElement;

    // Tìm Rule khớp với sự kiện này
    const rule = this.activeRules.find(r => {
      // 1. Check Trigger Type: Chỉ xử lý nếu rule là RATE (2) hoặc CLICK (1) nhưng xảy ra trên form submit
      // Lưu ý: Nếu user định nghĩa RATE là triggerId=2, ta map nó vào hành động submit
      const isRateOrSubmit = r.triggerEventId === TRIGGER_MAP.RATE;
      if (!isRateOrSubmit) return false;

      // 2. Check Target Element (Element nào đang submit?)
      if (!this.checkTargetMatch(form, r)) return false;

      // 3. Check Conditions (URL, Time, Global var...)
      return this.checkConditions(r);
    });

    if (!rule) return; // Không khớp rule nào -> Bỏ qua

    // Logic lấy payload dựa trên cấu hình rule
    const content = this.extractPayload(form, rule);

    // Gửi sự kiện đi
    this.trackEvent('RATE', { // Tên event generic, server sẽ dựa vào ruleId/triggerTypeId để phân loại
      ruleId: rule.id,
      triggerTypeId: rule.triggerEventId, // Gửi kèm ID để server biết đây là RATE
      content: content
    });
  }

  // --- CORE MATCHING LOGIC (Kiểm tra Target Element) ---
  /**
   * Kiểm tra xem Form hiện tại có khớp với Rule config không
   * Dựa trên: TargetEventPatternId (CSS/Attribute...) + TargetOperatorId + TargetElementValue
   */
  private checkTargetMatch(element: HTMLElement, rule: TrackingRule): boolean {
    const patternId = rule.targetEventPatternId;
    const operatorId = rule.targetOperatorId;
    const targetValue = rule.targetElementValue; // Giá trị từ config (VD: "#review-form" hoặc "Target-Element-Test")

    // 1. TRÍCH XUẤT GIÁ TRỊ THỰC TẾ (Actual Value) TỪ ELEMENT
    let actualValue: string | null = null;

    switch (patternId) {
      case PATTERN_MAP.CSS_SELECTOR:
        // Pattern 1: CSS Selector
        // Kiểm tra element có khớp selector không
        if (element.matches(targetValue)) return true;
        // Hoặc kiểm tra ID nếu selector là #ID
        if (targetValue.startsWith('#') && element.id === targetValue.substring(1)) return true;
        return false;

      case PATTERN_MAP.DOM_ATTRIBUTE:
        // Pattern 3: DOM Attribute (Mặc định lấy ID hoặc Name để so sánh)
        // Nếu config là "Target-Element-Test", ta so sánh nó với ID hoặc Name của form
        actualValue = element.id || element.getAttribute('name') || '';
        break;

      case PATTERN_MAP.DATA_ATTRIBUTE:
        // Pattern 4: Data Attribute (VD: data-test="value")
        // Giả sử targetValue format là "key=value" hoặc chỉ check value của data-id
        // Ở đây implement đơn giản: check data-testid hoặc data-id
        actualValue = element.getAttribute('data-testid') || element.getAttribute('data-id') || '';
        break;
        
      case PATTERN_MAP.REGEX:
        // Pattern 5: Regex trên ID
        actualValue = element.id;
        break;

      default:
        // Mặc định fallback về ID
        actualValue = element.id;
    }

    if (actualValue === null) return false;

    // 2. SO SÁNH (COMPARE) DỰA TRÊN OPERATOR
    return this.compareValues(actualValue, targetValue, operatorId);
  }

  // Hàm so sánh tổng quát
  private compareValues(actual: string, target: string, operatorId: number): boolean {
    if (actual === null || actual === undefined) return false;
    
    switch (operatorId) {
      case OPERATOR_MAP.EQUALS:
        return actual === target;
      case OPERATOR_MAP.NOT_EQUALS:
        return actual !== target;
      case OPERATOR_MAP.CONTAINS:
        return actual.includes(target);
      case OPERATOR_MAP.NOT_CONTAINS:
        return !actual.includes(target);
      case OPERATOR_MAP.STARTS_WITH:
        return actual.startsWith(target);
      case OPERATOR_MAP.ENDS_WITH:
        return actual.endsWith(target);
      case OPERATOR_MAP.REGREX:
        try {
          return new RegExp(target).test(actual);
        } catch (e) { return false; }
      case OPERATOR_MAP.EXISTS:
        return !!actual; // Tồn tại và không rỗng
      case OPERATOR_MAP.NOT_EXISTS:
        return !actual;
      default:
        return actual === target; // Default equals
    }
  }

  // --- LOGIC TRÍCH XUẤT PAYLOAD ---
  private extractPayload(form: HTMLFormElement, rule: TrackingRule): Record<string, any> {
    const data: Record<string, any> = {};

    // 1. Ưu tiên lấy theo cấu hình PayloadConfig trong Rule
    if (rule.payload && rule.payload.length > 0) {
        rule.payload.forEach((config: PayloadConfig) => {
            // config.value: Tên field trong form (VD: "payload-value-1")
            // config.type: Kiểu dữ liệu (string, number)
            
            // Tìm input trong form có name trùng với config.value
            const input = form.querySelector(`[name="${config.value}"]`) as HTMLInputElement;
            
            if (input) {
                let val: any = input.value;
                
                // Ép kiểu dữ liệu
                if (config.type === 'number') {
                    val = Number(val);
                } else if (config.type === 'boolean') {
                    val = val === 'true' || val === 'on' || input.checked;
                }

                // Lưu vào data với key là tên field
                data[config.value as string] = val;
            }
        });
    } 
    // 2. Nếu không có config, fallback về chế độ scrape toàn bộ (như cũ)
    else {
        Object.assign(data, this.scrapeInputs(form.elements));
    }

    // 3. Tự động bổ sung các trường chuẩn (ItemID, UserID) nếu chưa có trong data
    // (Logic Auto-detect "Thám tử" từ bài trước)
    const smartData = this.collectSmartData(form);
    
    // Merge data: Config ghi đè Auto-detect
    return { ...smartData, ...data };
  }

  // --- HELPERS BỔ TRỢ ---

  private checkConditions(rule: TrackingRule): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    return rule.conditions.every(cond => {
        // Ví dụ: Condition check URL (Pattern ID 2 = URL_PARAM trong index.ts)
        if (cond.payloadPatternId === PATTERN_MAP.URL_PARAM) { 
            return this.compareValues(window.location.href, cond.value || '', cond.operatorId);
        }
        return true;
    });
  }

  private trackEvent(type: string, payload: any) {
      if (this.context) {
          this.context.track(type, payload);
      }
  }

  // Helper: Auto-detect cơ bản (giữ lại từ phiên bản trước để đảm bảo tính tiện dụng)
  private collectSmartData(form: HTMLFormElement) {
     const inputs = this.scrapeInputs(form.elements);
     // Logic đơn giản để tìm rate/review nếu user không config
     // (Có thể mở rộng thêm logic Regex "Thám tử" ở đây nếu cần)
     return inputs;
  }

  private scrapeInputs(inputs: any): Record<string, any> {
      const data: Record<string, any> = {};
      Array.from(inputs as ArrayLike<Element>).forEach((el) => {
          const input = el as HTMLInputElement;
          const name = input.name || input.id;
          if (!name || ['submit', 'button', 'image', 'reset'].includes(input.type)) return;
          
          if (input.type === 'radio' && !input.checked) return;
          if (input.type === 'checkbox' && !input.checked) return;

          data[name] = input.value;
      });
      return data;
  }
}