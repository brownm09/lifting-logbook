import { onEdit, onOpen } from "@src/api";

export * from "@src/api";
export * from "@src/core";

(global as any).onOpen = onOpen;
(global as any).onEdit = onEdit;
