"use client";

import { useMemo, useState } from "react";

function localInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleStartsField() {
  const min = useMemo(() => localInputValue(new Date(Date.now() + 60_000)), []);
  const [iso, setIso] = useState("");
  return (
    <>
      <input type="hidden" name="startsAtIso" value={iso} />
      <input
        name="startsAt"
        type="datetime-local"
        required
        min={min}
        className="w-full max-w-xs rounded-xl border border-border px-3 py-2"
        onChange={(event) => {
          const parsed = new Date(event.target.value);
          setIso(Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString());
        }}
      />
    </>
  );
}
