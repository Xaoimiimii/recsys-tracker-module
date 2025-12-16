export const TRIGGER_MAP = {
  CLICK: 1,
  RATE: 2,
  VIEW: 3,
};

export const PATTERN_MAP = {
  CSS_SELECTOR: 1,  // Như trong JSON ví dụ của bạn
  URL_PARAM: 2,     // Ví dụ
  DOM_ATTRIBUTE: 3,
  DATA_ATTRIBUTE: 4, // Ví dụ
  REGEX: 5          // Ví dụ
};

// Map với bảng Operator trong DB
export const OPERATOR_MAP = {
    CONTAINS: 1,
    NOT_CONTAINS: 2,
    STARTS_WITH: 3,
    ENDS_WITH: 4,
    EQUALS: 5,
    NOT_EQUALS: 6, 
    REGREX: 7,
    EXISTS: 8,
    NOT_EXISTS: 9
};