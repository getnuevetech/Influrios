/** Sign-in, sign-up and claim pages: the site header comes from the root layout. */
export function AccountAccessFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#F6F4FF] pb-12">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-2 lg:px-8">{children}</div>
    </div>
  );
}
