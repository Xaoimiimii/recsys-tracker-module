import { Plugin, PluginContext, TrackingRule } from '../types';
const TRIGGER_MAP = {
  CLICK: 1,       
  FORM_SUBMIT: 2,  
  CHANGE: 3,     
  KEYDOWN: 4      
}; 

export class FormPlugin implements Plugin {
  name = 'strict-form-plugin';
  version = '4.2.0-full-features';

  private context: PluginContext | null = null;
  private activeRules: TrackingRule[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Bind handlers để giữ context 'this'
  private handleSubmitBound = this.handleSubmit.bind(this);
  private handleKeydownBound = this.handleKeydown.bind(this);
  private handleClickBound = this.handleClick.bind(this);
  private handleChangeBound = this.handleChange.bind(this);

  init(context: PluginContext) {
    this.context = context;
  }

  start() {
    if (!this.context || !this.context.config) return;

    // 1. Lấy tất cả rules từ config
    const rules = this.context.config.trackingRules || [];

    // 2. Lọc rules áp dụng cho trang hiện tại & thuộc về Form Plugin
    // Logic: Rule phải khớp điều kiện (URL...) VÀ là loại sự kiện ta quan tâm
    const supportedEvents = Object.values(TRIGGER_MAP);
    
    this.activeRules = rules.filter(rule => {
      // Rule có phải Click/Submit/Change/Keydown không?
      if (!supportedEvents.includes(rule.triggerEventId)) return false;
      // Rule có thỏa mãn điều kiện trang hiện tại không?
      return this.checkConditions(rule);
    });

    if (this.activeRules.length === 0) return;

    // 3. Đăng ký Listeners dựa trên rules đã lọc
    const captureOptions = { capture: true, composed: true };

    // Nếu có rule Submit -> Lắng nghe Submit
    if (this.hasRule(TRIGGER_MAP.FORM_SUBMIT)) {
        document.addEventListener('submit', this.handleSubmitBound, { capture: true });
    }

    // Nếu có rule Change -> Lắng nghe Change
    if (this.hasRule(TRIGGER_MAP.CHANGE)) {
        document.addEventListener('change', this.handleChangeBound, captureOptions);
    }

    // Nếu có rule Click -> Lắng nghe Click
    if (this.hasRule(TRIGGER_MAP.CLICK)) {
        document.addEventListener('click', this.handleClickBound, captureOptions);
    }

    // Nếu có rule Keydown -> Lắng nghe Keydown
    if (this.hasRule(TRIGGER_MAP.KEYDOWN)) {
        document.addEventListener('keydown', this.handleKeydownBound, captureOptions);
    }

    if((this.context.config.options as any)?.['debug']) {
        console.log(`[FormPlugin] 🛡️ Started with ${this.activeRules.length} active rules.`);
    }
  }

  stop() {
    document.removeEventListener('submit', this.handleSubmitBound);
    document.removeEventListener('change', this.handleChangeBound);
    document.removeEventListener('click', this.handleClickBound);
    document.removeEventListener('keydown', this.handleKeydownBound);
  }

  // --- HANDLER: CLICK ---
  private handleClick(event: Event) {
    // 1. Tìm rule CLICK phù hợp
    const rule = this.matchRule(TRIGGER_MAP.CLICK, event.target as Element);
    if (!rule) return;

    const target = event.target as HTMLElement;
    const form = target.closest('form');
    if (!form) return;

    // Logic tìm nút bấm (giữ nguyên logic của bạn)
    const btn = target.closest('button') || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'submit' ? target : null);
    if (!btn) return;

    const buttonText = (btn.innerText || (btn as HTMLInputElement).value || '').trim();
    const formData = this.scrapeInputs(form.elements);

    // Track
    this.trackEvent('FORM_ACTION', {
        ruleId: rule.id, // Gắn ID rule
        formId: form.id || form.getAttribute('name'),
        actionType: 'button_click',
        triggerElement: buttonText,
        content: formData
    });
  }

  // --- HANDLER: KEYDOWN ---
  private handleKeydown(event: Event) {
    // 1. Tìm rule KEYDOWN phù hợp
    const rule = this.matchRule(TRIGGER_MAP.KEYDOWN, event.target as Element);
    if (!rule) return;

    const target = event.target as HTMLInputElement;
    const keyboardEvent = event as KeyboardEvent;
    
    // Chỉ track input trong form
    if (!target.closest('form') || target.tagName !== 'INPUT') return;

    // Case 1: Nhấn Enter -> Coi như hành động Search/Submit
    if (keyboardEvent.key === 'Enter') {
        if(this.debounceTimer) clearTimeout(this.debounceTimer);
        
        this.trackEvent('SEARCH_ACTION', {
            ruleId: rule.id,
            keyword: target.value,
            trigger: 'enter_press',
            formId: target.closest('form')?.id
        });
        return;
    }

    // Case 2: Typing (có Debounce)
    if (keyboardEvent.key.length > 1 && keyboardEvent.key !== 'Backspace') return; // Bỏ qua phím chức năng

    if(this.debounceTimer) clearTimeout(this.debounceTimer);
    
    // Đợi 2s sau khi ngừng gõ mới gửi event
    this.debounceTimer = setTimeout(() => {
        if (target.value && target.value.trim().length > 1) {
             this.trackEvent('FIELD_INTERACTION', {
                ruleId: rule.id,
                fieldName: target.name || target.id,
                value: this.maskValue(target.name, target.type, target.value),
                trigger: 'typing_debounce'
            });
        }
    }, 2000);
  }

  // --- HANDLER: SUBMIT ---
  private handleSubmit(event: Event) {
    const form = event.target as HTMLFormElement;
    
    const rule = this.matchRule(TRIGGER_MAP.FORM_SUBMIT, form);
    if (!rule) return;

    const content = this.scrapeInputs(form.elements);
    
    this.trackEvent('FORM_SUBMIT', {
      ruleId: rule.id,
      formId: form.id || form.getAttribute('name'),
      action: form.action,
      method: form.method,
      content: content
    });
  }

  // --- HANDLER: CHANGE ---
  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const form = target.closest('form');
    
    // Nếu không trong form hoặc không tìm thấy rule CHANGE -> bỏ qua
    const rule = this.matchRule(TRIGGER_MAP.CHANGE, target);
    if (!form || !rule) return; 

    const name = target.name || target.id;
    if (!name) return;

    let value = target.value;
    if (target.type === 'checkbox') value = target.checked ? 'true' : 'false';

    this.trackEvent('FIELD_CHANGE', {
        ruleId: rule.id,
        formId: form.id || form.getAttribute('name') || 'unknown_form',
        fieldName: name,
        value: this.maskValue(name, target.type, value),
        inputType: target.type
    });
  }

  // --- HELPERS (Logic Rule Engine) ---

  // Kiểm tra xem có rule nào cho loại sự kiện này không
  private hasRule(triggerId: number): boolean {
    return this.activeRules.some(r => r.triggerEventId === triggerId);
  }

  // Tìm rule cụ thể khớp với loại sự kiện VÀ element mục tiêu (Target Element)
  private matchRule(triggerId: number, element: Element): TrackingRule | undefined {
    return this.activeRules.find(r => {
        // 1. Phải đúng loại sự kiện
        if (r.triggerEventId !== triggerId) return false;

        // 2. Kiểm tra Target Element (nếu rule có quy định)
        // Nếu targetElementValue là '*' hoặc rỗng -> Áp dụng cho mọi element
        if (!r.targetElementValue || r.targetElementValue === '*') return true;

        // Nếu có ID/Class cụ thể -> Kiểm tra element có khớp không (Simple match id)
        if (element.id === r.targetElementValue) return true;
        
        // Hoặc check class (nếu cần)
        if (element.classList.contains(r.targetElementValue)) return true;

        return false;
    });
  }

  private checkConditions(rule: TrackingRule): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    
    // Check URL conditions (Example implementation)
    return rule.conditions.every(condition => {
        // Logic so sánh URL đơn giản: contains
        if (condition.value && window.location.href.includes(condition.value)) return true;
        return false;
    });
  }

  // --- HELPERS (Logic Data Extraction - Giữ nguyên của bạn) ---

  private scrapeInputs(inputs: any): Record<string, any> {
      const data: Record<string, any> = {};
      Array.from(inputs as ArrayLike<Element>).forEach((el) => {
          const input = el as HTMLInputElement;
          const name = input.name || input.id;
          if (!name || ['submit', 'button', 'image', 'reset'].includes(input.type)) return;

          const val = this.maskValue(name, input.type, input.value);
          if (['radio', 'checkbox'].includes(input.type)) {
              if (input.checked) data[name] = val || 'true';
          } else {
              data[name] = val;
          }
      });
      return data;
  }

  private maskValue(name: string, type: string, value: string): string {
      if (!name) return value;
      if (type === 'password') return '[HIDDEN_PASSWORD]';
      if (/password|cvv|token|card|secret/i.test(name)) return '[SENSITIVE]';
      return value;
  }

  private trackEvent(type: string, payload: any) {
      if (this.context) {
          this.context.track(type, payload);
      }
  }
}