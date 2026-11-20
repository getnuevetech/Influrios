/** Shared workroom action result shape (safe for client type imports). */

export type WorkroomActionResult = {
  ok: false;
  error: string;
  errorKind?: "validation" | "upload" | "file" | "auth";
};
