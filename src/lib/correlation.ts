import { randomBytes } from "crypto";

/** Short reference shown on a failed screen and written to the server log. Not a secret. */
export function newCorrelationId(): string {
  return randomBytes(4).toString("hex");
}
