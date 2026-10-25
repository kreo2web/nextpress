/** A JSON value, as the test servers read it from a request and write it into a reply. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
