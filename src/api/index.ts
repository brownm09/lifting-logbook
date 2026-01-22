import { onEdit, onOpen } from "./controllers";

export * from "./controllers";
export * from "./repositories";
export * from "./ui";
export * from "./utils";

(globalThis as any).onOpen = (e: any) => onOpen(e);
(globalThis as any).onEdit = (e: any) => onEdit(e);
