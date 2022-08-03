export interface BaseDocument {
  _id: string;
  _rev: string;
  type: "clinical" | "connection";
  version: number;
}
