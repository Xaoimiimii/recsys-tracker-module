export interface PopupConfig {
  minDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  autoCloseDelay?: number; // milliseconds
  pages?: string[]; // URL patterns to show popup
}

export interface InlineConfig {
  pages?: string[]; // URL patterns to show inline
}
