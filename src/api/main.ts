import { onEdit, onOpen } from ".";

(global as any).onOpen = onOpen;
(global as any).onEdit = onEdit;
