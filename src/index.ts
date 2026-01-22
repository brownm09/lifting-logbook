import { onEdit, onOpen } from "./api";

export * from "./api";
export * from "./core";

(global as any).onOpen = onOpen;
(global as any).onEdit = onEdit;
