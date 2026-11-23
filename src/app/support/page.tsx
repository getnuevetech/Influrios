import Link from "next/link";
import { actionSendSupportMessage } from "@/app/support/actions";
import { getAccountSession } from "@/lib/accounts";
import { getSupportSettings, SUPPORT_TOPICS } from "@/lib/support";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

type Props = { searchParams: Promise<{ sent?: string; ticket?: string; error?: string; topic?: string; ref?: string }> };

const field = "mt-1 w-full rounded-xl border border-[#E4EBFF] bg-white px-3 py-2.5 text-sm text-indigo outline-none focus:border-violet";

export default async function SupportPage({ searchParams }: Props) {
  const params = await searchParams;
  const [settings, account] = await Promise.all([getSupportSettings(), getAccountSession().catch(() => null)]);
  const topic = SUPPORT_TOPICS.find((row) => row === params.topic) ?? "";
  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Help</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Contact support</h1>
          <p className="mt-3 text-white/75">
            Send us a message and we&apos;ll reply by email. Many questions are already answered in the{" "}
            <Link href="/faq" className="font-semibold text-white underline">FAQ</Link>.
          </p>
        </div>
      </section>
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:px-6">
        {settings.email ? (
          <p className="card-surface p-5 text-sm text-indigo">
            Email us directly at{" "}
            <a href={`mailto:${settings.email}`} className="font-semibold text-violet hover:underline">
              {settings.email}
            </a>
            , or use the form below.
          </p>
        ) : null}
        {params.sent ? (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Thanks — your message was sent{params.ticket ? ` (reference ${params.ticket})` : ""}. We&apos;ll reply to the email address you gave.
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {params.error}
          </p>
        ) : null}
        <form action={actionSendSupportMessage} className="card-surface grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-indigo">
              Your name
              <input name="name" required maxLength={120} defaultValue={account?.name ?? ""} autoComplete="name" className={field} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Email for our reply
              <input name="email" type="email" required maxLength={200} defaultValue={account?.email ?? ""} autoComplete="email" className={field} />
            </label>
          </div>
          <label className="text-sm font-semibold text-indigo">
            Topic
            <select name="topic" required defaultValue={topic} className={field}>
              <option value="" disabled>
                Choose a topic
              </option>
              {SUPPORT_TOPICS.map((row) => (
                <option key={row} value={row}>
                  {row}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-indigo">
            Reference <span className="font-normal text-muted">(optional: collaboration, payment or receipt)</span>
            <input name="reference" maxLength={120} defaultValue={params.ref ?? ""} className={field} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Message
            <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={field} />
          </label>
          {/* Left empty by people; filled by bots. */}
          <label className="hidden" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <button type="submit" className="inline-flex h-11 w-fit items-center rounded-full bg-violet px-5 text-sm font-semibold text-white">
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
