"use client";

import { useEffect, useState } from "react";
import { nfcUrlRecord, nfcWriteErrorMessage } from "@/lib/nfc-writer";

type NdefWriter = {
  write: (message: { records: { recordType: string; data: string }[] }) => Promise<void>;
};

export function NfcWriter({ url }: { url: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = nfcUrlRecord(url);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function writeTag() {
    if (!record) {
      setStatus("This NFC address cannot be written.");
      return;
    }
    const Reader = (window as unknown as { NDEFReader?: new () => NdefWriter }).NDEFReader;
    if (!Reader) {
      setStatus("This browser cannot write NFC tags.");
      return;
    }
    setBusy(true);
    setStatus("Hold a blank NFC tag against this phone until the write finishes.");
    try {
      const writer = new Reader();
      await writer.write({ records: [record] });
      setStatus("The tag now opens this NFC URL. Write the same URL onto another blank tag if you need a spare.");
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setStatus(name ? nfcWriteErrorMessage(name) : "The tag was not written.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {supported ? (
        <button type="button" onClick={writeTag} disabled={busy || !record} className="btn-secondary !py-1.5 text-xs">
          {busy ? "Waiting for the tag…" : "Write to NFC tag"}
        </button>
      ) : supported === false ? (
        <p className="text-xs text-muted">
          This browser cannot write NFC tags. Android Chrome can, from this same button. iPhone does not let a website
          write a tag, so use the Shortcuts app with this URL.
        </p>
      ) : null}
      {status ? <p className="text-xs text-indigo">{status}</p> : null}
    </div>
  );
}
