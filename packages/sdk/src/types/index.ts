export interface TrackerConfig {
  domainKey: string;
  domainUrl?: string;
  domainType?: number;
  trackingRules?: TrackingRule[];
  returnMethods?: ReturnMethod[];
  eventTypes?: EventType[];
  searchKeywordConfig?: SearchKeywordConfig;
  userIdentityConfig?: UserIdentityConfig;
  options?: TrackerOptions;
}

export interface EventType {
  id: number;
  name: string;
}

export interface TrackingRule {
  id: number;
  name: string;
  domainId: number;
  eventTypeId: number; 
  actionType?: string | null;
  payloadMappings: PayloadMapping[];
  trackingTarget: string;
}

export interface PayloadMapping {
  id?: number;
  field: string;
  source: string;
  config: PayloadMappingConfig;
  trackingRuleId?: number;
}

export interface PayloadMappingConfig {
  // For request_url source
  RequestUrlPattern?: string;
  RequestMethod?: string;
  Value?: string; // For pathname: segment index, for query: param name, for request_body: JSON path
  ExtractType?: 'pathname' | 'query'; // Only for request_url
  
  // For request_body/response_body source
  // (RequestUrlPattern and RequestMethod already covered above)
  // Value used as JSON path for body extraction
  
  // For element source
  SelectorPattern?: string;
}

// User Identity configuration
export interface UserIdentityConfig {
  id?: number;
  source: 'request_body' | 'request_url' | 'local_storage' | 'session_storage' | 'cookie' | 'element';
  domainId: number;
  requestConfig?: UserIdentityRequestConfig | null;
  value?: string | null; // For element/cookie/local_storage/session_storage
  field: 'UserId' | 'AnonymousId';
}

export interface UserIdentityRequestConfig {
  RequestUrlPattern: string;
  RequestMethod: string;
  Value: string; // JSON path for request_body, segment index for request_url pathname
  ExtractType?: 'pathname' | 'query'; // Only for request_url
}

export interface ReturnMethod {
  Key: string;
  Id: number;
  ConfigurationName: string;
  SearchKeywordConfigId?: number | null;
  ReturnType: string; 
  Value: string;     
  OperatorId?: number;
  LayoutJson: LayoutJson;
  StyleJson: StyleJson;
  CustomizingFields: CustomizingFields;
  DelayDuration?: number | 60; 
}

export interface SearchKeywordConfig {
  Id: number;
  DomainID: number;
  ConfigurationName: string;
  InputSelector: string;
}

export interface TrackerOptions {
  maxRetries?: number;
  batchSize?: number;
  batchDelay?: number; // ms
  offlineStorage?: boolean;
}

// Plugin-related types (đồng bộ với plugin interfaces)
export type RuleSource = 'ai_detect' | 'regex_group';

export interface PayloadExtractor {
  source: RuleSource;
  eventKey: string;
  pattern?: string;
  groupIndex?: number;
}

export interface BaseDisplayConfig {
  pages?: string[];         
  layoutJson: LayoutJson;    
  styleJson: StyleJson;      
  customizingFields: CustomizingFields;
  triggerConfig?: {
      targetValue: string; // URL cần so sánh (lấy từ Value của ReturnMethod)
      operatorId?: number | 1;  // 1, 2, 3, 4 (lấy từ OperatorId)
  };
}

export interface PopupConfig extends BaseDisplayConfig {
  delay?: number; // (s)
  autoCloseDelay?: number;
}

export interface InlineConfig extends BaseDisplayConfig {
  selector?: string; // Ví dụ: "#product-detail-page"
}

export type DisplayType = 'popup' | 'inline-injection';

export interface CardImageConfig {
    enabled: boolean;
    positionByMode: {
        grid: string;
        list: string;
        carousel: string;
    };
    sizeByMode: {
        grid: { height: number; aspectRatio: string };
        list: { width: number; height: number; aspectRatio: string };
        carousel: { height: number; aspectRatio: string };
    };
}

export interface CardFieldsConfig {
    enabled: boolean;
    source: string;
    orderBy: string;
    direction: 'asc' | 'desc';
    render: 'stack' | 'inline'; 
    maxItemsByMode: {
        grid: number;
        list: number;
        carousel: number;
    };
    row: {
        labelWidth: number;
        valueAlign: 'left' | 'right' | 'center';
        gap: string; // gap nằm trong row
    };
}


export interface CardActionsConfig {
    enabled: boolean;
    positionByMode: {
        grid: string;
        list: string;
        carousel: string;
    };
    variantByMode: {
        grid: string;
        list: string;
        carousel: string;
    };
}

export interface CardConfig {
    blocks: string[]; 
    image: CardImageConfig;
    fields: CardFieldsConfig;
    actions: CardActionsConfig;
}

export interface InlineWrapperConfig {
    selector: string; 
    injectionMode: 'append' | 'prepend' | 'replace'; 
}


export interface PopupWrapperConfig {
    position: 'center' | 'bottom-right' | 'bottom-left' | 'top-center';
    widthMode: 'fixed' | 'responsive';
    width?: number;
}

export interface ModeConfig {
    columns?: number;
    gap?: string;
    rowGap?: string;
    itemsPerView?: number;
    showDivider?: boolean;
    imageLeftWidth?: number;
    loop?: boolean;
    peek?: number;
    autoplay?: { enabled: boolean; intervalMs: number };
    responsive?: Record<string, any>; // Cho phép responsive object
}

export interface LayoutJson {
    displayMode: DisplayType;
    contentMode?: string; 
    
    wrapper?: {
        popup?: PopupWrapperConfig;
        inline?: InlineWrapperConfig;
    };
    
    modes: {
        grid: ModeConfig;
        list: ModeConfig;
        carousel: ModeConfig;
    };
    
    card: CardConfig;
}

export interface TypographyConfig {
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    color?: string;
}

export interface DensityConfig {
    cardPadding: number;
    rowGap: number;
    imageHeight: number;
}

export interface StyleTokens {
    colors: {
        background: string;
        surface: string;
        textPrimary: string;
        textSecondary: string;
        border: string;
        muted: string;
        primary: string;
        success: string;
        danger: string;
        warning: string;
    };
    radius: {
        card: number;
        image: number;
        button: number;
        badge: number;
    };
    shadow: {
        card: string;
        cardHover: string;
    };
    typography: {
        title: TypographyConfig;
    };
    spacingScale: Record<string, number>; // xs, sm, md...
    densityBySize: Record<string, DensityConfig>; // sm, md, lg
}

export interface ComponentStyles {
    canvas: {
        backgroundToken: string;
    };
    dropdown: {
        heightBySize: Record<string, number>;
        radiusToken: string;
        borderToken: string;
        textToken: string;
    };
    card: {
        backgroundToken: string;
        border: boolean;
        borderColorToken: string;
        radiusToken: string;
        shadowToken: string;
        hover: {
            enabled: boolean;
            liftPx: number;
            shadowToken: string;
        };
    };
    image: {
        radiusFollowsCard: boolean;
        objectFit: 'cover' | 'contain' | 'fill';
        placeholder: {
            backgroundToken: string;
            iconOpacity: number;
        };
    };
    badge: {
        enabled: boolean;
        variant: 'solid' | 'outline';
        backgroundToken: string;
        textColor: string;
        radiusToken: string;
        padding: { x: number; y: number };
        position: string;
        offset: { x: number; y: number };
    };
    fieldRow: {
        layout: string;
        label: {
            colorToken: string;
            typographyToken: string;
            widthPx: number;
            truncate: boolean;
        };
        value: {
            colorToken: string;
            typographyToken: string;
            truncate: boolean;
        };
        rowGapToken: string;
        overrides?: Record<string, FieldStyleOverride>;
    };
    actions: {
        button: {
            variant: string;
            radiusToken: string;
            heightBySize: Record<string, number>;
            backgroundToken?: string; // Optional cho override
            textColor?: string;       // Optional cho override
        };
        iconSizeBySize: Record<string, number>;
    };
}

// --- Override Interfaces ---

export interface StyleModeOverride {
    card?: any;
    image?: any;
    fieldRow?: any;
    actions?: any;
    typography?: any;
}

export interface CustomizingFieldsIntegration {
    orderSource: string;
    visibleSource: string;
    fallback: {
        visible: boolean;
        order: number;
    };
    sorting: {
        direction: 'asc' | 'desc';
        tieBreaker: string;
    };
}

export interface StyleJson {
    theme: 'light' | 'dark';
    spacing: 'sm' | 'md' | 'lg';
    size: 'sm' | 'md' | 'lg';
    
    tokens: StyleTokens;
    components: ComponentStyles;
    
    modeOverrides: {
        grid: StyleModeOverride;
        list: StyleModeOverride;
        carousel: StyleModeOverride;
    };
    
    customizingFieldsIntegration: CustomizingFieldsIntegration;
}

export interface FieldConfig {
    key: string;
    position: number;
    isEnabled: boolean;
}

export interface CustomizingFields {
    fields: FieldConfig[];
}

export interface FieldStyleOverride {
    fontSize?: number;
    fontWeight?: number;
    color?: string;
}


// Window declaration for domain key
declare global {
  interface Window {
    __RECSYS_DOMAIN_KEY__?: string;
  }
}
