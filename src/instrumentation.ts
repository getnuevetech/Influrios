/** Runs once when the server starts. Starts the background sweeps so they do not depend on a host crontab. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
