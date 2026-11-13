"use client";

import { useState } from "react";
import { actionCreateDraft } from "@/app/claim/actions";
import { IconFacebook, IconInstagram, IconTikTok, IconX, IconYouTube } from "@/components/icons";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X" },
] as const;

export function CardPreviewDialog({
  source,
  utmSource,
  utmCampaign,
}: {
  source?: string;
  utmSource?: string;
  utmCampaign?: string;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("instagram");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-[#6D4AFF]">
        Preview your own card (optional)
      </button>
      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close preview" className="absolute inset-0 bg-[#1B1464]/40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-preview-title"
            className="absolute left-1/2 top-1/2 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(27,20,100,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="card-preview-title" className="font-display text-xl font-bold text-[#1B1464]">
                  Preview your influencer card
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Optional. A typed handle stays unverified until you connect the channel. This does not create an account.
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-xl text-[#667085]">
                ×
              </button>
            </div>
            <form action={actionCreateDraft} className="mt-4 space-y-3">
              <input type="hidden" name="platform" value={platform} />
              {source ? <input type="hidden" name="source" value={source} /> : null}
              {utmSource ? <input type="hidden" name="utm_source" value={utmSource} /> : null}
              {utmCampaign ? <input type="hidden" name="utm_campaign" value={utmCampaign} /> : null}
              <label className="block text-sm font-semibold text-[#1B1464]">
                Channel
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as (typeof PLATFORMS)[number]["value"])}
                  className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal"
                >
                  {PLATFORMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Handle
                <input
                  name="handle"
                  required
                  placeholder="@yourhandle"
                  className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-3 text-sm font-normal outline-none focus:border-violet"
                />
              </label>
              <button type="submit" className="w-full rounded-xl bg-[#6D4AFF] py-3 text-sm font-semibold text-white">
                Preview card
              </button>
              <p className="text-center text-xs text-[#667085]">A preview does not verify ownership.</p>
            </form>
            <div className="mt-3 flex justify-center gap-3 text-[#6D4AFF]" aria-hidden>
              <IconInstagram size={16} />
              <IconTikTok size={16} />
              <IconYouTube size={16} />
              <IconFacebook size={16} />
              <IconX size={16} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
