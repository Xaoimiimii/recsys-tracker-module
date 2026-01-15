export interface BaseDisplayConfig {
    pages?: string[];
    layoutJson: LayoutJson;
    styleJson: StyleJson;
    customizingFields: CustomizingFields;
    triggerConfig?: {
        targetValue: string;
        operatorId: number;
    };
}
export interface PopupConfig extends BaseDisplayConfig {
    minDelay?: number;
    maxDelay?: number;
    autoCloseDelay?: number;
}
export interface InlineConfig extends BaseDisplayConfig {
    selector?: string;
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
        grid: {
            height: number;
            aspectRatio: string;
        };
        list: {
            width: number;
            height: number;
            aspectRatio: string;
        };
        carousel: {
            height: number;
            aspectRatio: string;
        };
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
        gap: string;
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
    autoplay?: {
        enabled: boolean;
        intervalMs: number;
    };
    responsive?: Record<string, any>;
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
        fontFamily: string;
        title: TypographyConfig;
        body: TypographyConfig;
        meta: TypographyConfig;
        label: TypographyConfig;
    };
    spacingScale: Record<string, number>;
    densityBySize: Record<string, DensityConfig>;
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
        padding: {
            x: number;
            y: number;
        };
        position: string;
        offset: {
            x: number;
            y: number;
        };
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
    };
    actions: {
        button: {
            variant: string;
            radiusToken: string;
            heightBySize: Record<string, number>;
            backgroundToken?: string;
            textColor?: string;
        };
        iconSizeBySize: Record<string, number>;
    };
}
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
export interface ReturnMethod {
    Key: string;
    ConfigurationName: string;
    ReturnType: string;
    Value: string;
    OperatorId: number;
    LayoutJson: LayoutJson;
    StyleJson: StyleJson;
    CustomizingFields: CustomizingFields;
    DelayDuration: number;
}
//# sourceMappingURL=types.d.ts.map