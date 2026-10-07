export type NfcUrlRecord = { recordType: "url"; data: string };

/** An https URL is the only record the in-app writer will put on a tag. */
export function nfcUrlRecord(url: string): NfcUrlRecord | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return { recordType: "url", data: parsed.toString() };
}

export function nfcWriteErrorMessage(name: string): string {
  if (name === "NotAllowedError") return "Allow NFC when the browser asks. The tag was not written.";
  if (name === "NotSupportedError") return "This browser cannot write NFC tags.";
  if (name === "NotReadableError") return "Hold the tag flat against the phone and try again.";
  if (name === "AbortError") return "Writing was cancelled. The tag was not changed.";
  if (name === "NetworkError") return "Keep the tag against the phone until the write finishes.";
  return "The tag was not written.";
}
