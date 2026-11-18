"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  drawnInkHasContent,
  serializeDrawnInk,
  type DrawnInk,
  type DrawnPoint,
} from "@/lib/signing/drawn-ink";
import { renderNameSignature, signatureInitials, signatureToSvg } from "@/lib/signing/signature-engine";

type Props = {
  name: string;
  inkName?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** When true, a drawn mark is required (default). Typed name remains the legal attestation. */
  requireDrawnInk?: boolean;
};

const CANVAS_W = 560;
const CANVAS_H = 168;

/**
 * In-app e-sign pad: typed legal name + original screen-written signature.
 * Drawn ink is the primary visual mark; styled name ink is a fallback preview only.
 */
export function SignaturePad({
  name,
  inkName = "signatureInk",
  defaultValue = "",
  required,
  minLength = 2,
  maxLength = 160,
  requireDrawnInk = true,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [ink, setInk] = useState<DrawnInk | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const strokeRef = useRef<DrawnPoint[]>([]);
  const strokesRef = useRef<DrawnPoint[][]>([]);

  const redraw = useCallback((strokes: DrawnPoint[][]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1440";
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
      }
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    redraw(strokesRef.current);
  }, [redraw]);

  const commitInk = useCallback((strokes: DrawnPoint[][]) => {
    strokesRef.current = strokes;
    redraw(strokes);
    const next: DrawnInk = { version: 1, width: CANVAS_W, height: CANVAS_H, strokes };
    setInk(drawnInkHasContent(next) ? next : null);
  }, [redraw]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): DrawnPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x: Math.min(CANVAS_W, Math.max(0, x)),
      y: Math.min(CANVAS_H, Math.max(0, y)),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    if (!point) return;
    drawingRef.current = true;
    strokeRef.current = [point];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const last = strokeRef.current[strokeRef.current.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1.2) return;
    strokeRef.current = [...strokeRef.current, point];
    redraw([...strokesRef.current, strokeRef.current]);
  };

  const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (strokeRef.current.length >= 2) {
      commitInk([...strokesRef.current, strokeRef.current]);
    } else {
      redraw(strokesRef.current);
    }
    strokeRef.current = [];
  };

  const clearInk = () => {
    strokeRef.current = [];
    commitInk([]);
  };

  const styledPreview = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return null;
    const signature = renderNameSignature(trimmed, { emSize: 22 });
    return {
      initials: signatureInitials(trimmed),
      svg: signatureToSvg(signature, { stroke: "#1a1440" }),
    };
  }, [value]);

  const inkJson = ink ? serializeDrawnInk(ink) : "";
  const hasDrawn = drawnInkHasContent(ink);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-indigo">
        Legal name (printed name on the agreement)
        <input
          name={name}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 font-normal"
          placeholder="Type your full legal name"
        />
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-indigo">Original signature</p>
            <p className="text-xs text-muted">Write with your finger, stylus, or mouse — this is the ink stamped on the PDF.</p>
          </div>
          <button type="button" onClick={clearInk} className="text-xs font-semibold text-violet hover:underline">
            Clear pad
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#C8D0E8] bg-[#FAFBFF]">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="touch-none w-full max-w-full cursor-crosshair bg-[linear-gradient(180deg,#FAFBFF_0%,#F4F7FF_100%)]"
            style={{ height: CANVAS_H }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            aria-label="Draw your original signature"
          />
          <div className="border-t border-[#E4E9F5] px-3 py-2 text-xs text-muted">
            {hasDrawn
              ? "Original screen-written signature captured."
              : requireDrawnInk
                ? "Draw your signature above to continue."
                : "Optional — without a drawing, Influrios styles ink from your typed name."}
          </div>
        </div>
        <input type="hidden" name={inkName} value={inkJson} required={requireDrawnInk} />
        {requireDrawnInk ? (
          <input
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            value={hasDrawn ? "1" : ""}
            required
            onChange={() => undefined}
          />
        ) : null}
      </div>

      {styledPreview && !hasDrawn ? (
        <div className="rounded-xl border border-dashed border-[#D9DFF2] bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Styled fallback preview</p>
          <div className="mt-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: styledPreview.svg }} />
          <p className="mt-1 text-xs text-muted">
            Page endorsement initials: <span className="font-semibold text-indigo">{styledPreview.initials}</span>
          </p>
        </div>
      ) : null}

      {hasDrawn && value.trim().length >= 2 ? (
        <p className="text-xs text-muted">
          Printed name <span className="font-semibold text-indigo">{value.trim()}</span>
          {" · "}
          initials <span className="font-semibold text-indigo">{signatureInitials(value.trim())}</span>
          {" · "}
          original ink will be stamped on every signed page.
        </p>
      ) : null}
    </div>
  );
}
