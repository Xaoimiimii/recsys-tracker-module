export enum PayloadField {
    USER_ID = 'UserId',
    USERNAME = 'Username',
    ITEM_ID = 'ItemId',
    ITEM_TITLE = 'ItemTitle',
    VALUE = 'Value',
}

export enum PayloadSource {
    REQUEST_BODY = 'RequestBody',
    ELEMENT = 'Element',
    COOKIE = 'Cookie',
    LOCAL_STORAGE = 'LocalStorage',
    SESSION_STORAGE = 'SessionStorage',
    URL = 'Url',
}

export enum PayloadRequestMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
}

export enum PayloadUrlPart {
    QUERY_PARAM = 'QueryParam',
    PATHNAME = 'PathName',
    HASH = 'Hash',
}