/** Client message thrown when a server action id is missing from this build. */
export function isStaleServerAction(error: { name?: string; message?: string }) {
  const message = error.message ?? "";
  return (
    error.name === "UnrecognizedActionError" ||
    message.includes("was not found on the server") ||
    message.includes("failed-to-find-server-action")
  );
}
