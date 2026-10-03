import Link from "next/link";

export function GuestGateBanner({ copy, next }: { copy: string; next: string }) {
  if (!copy) return null;
  return (
    <div className="border-b border-[#E4E9F5] bg-[#EAE4FF]">
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <p className="text-sm font-medium text-indigo">{copy}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="btn-secondary !px-4 !py-2 text-sm"
          >
            Sign in
          </Link>
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="btn-primary !px-4 !py-2 text-sm"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
