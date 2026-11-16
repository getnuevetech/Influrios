"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { actionReplyToThread } from "@/app/creator/messages/actions";
import { ConversationView } from "@/app/creator/messages/conversation-view";
import type { InboxLinkProps } from "@/app/creator/messages/messages-inbox";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import type { OpenThreadResult } from "@/lib/message-inbox";

export function ConversationPopup({
  closeHref,
  state,
}: {
  closeHref: string;
  state: OpenThreadResult;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useAccountDialogBehavior(panelRef, () => router.push(closeHref, { scroll: false }));

  async function reply(formData: FormData) {
    setPending(true);
    try {
      const result = await actionReplyToThread(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError("The reply could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 hidden bg-[#111a5a]/45 md:block" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-0 flex flex-col bg-white outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(40rem,calc(100vh-3rem))] md:w-[min(40rem,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-[28px] md:shadow-[0_24px_80px_rgba(17,26,90,0.28)]"
      >
        <ConversationView
          titleId={titleId}
          closeHref={closeHref}
          state={state}
          pending={pending}
          formError={error}
          replyAction={state.ok ? reply : undefined}
          formRef={formRef}
          linkComponent={DialogLink}
        />
      </div>
    </div>
  );
}

function DialogLink({ href, className, children, ...rest }: InboxLinkProps) {
  return (
    <Link href={href} scroll={false} className={className} aria-label={rest["aria-label"]}>
      {children}
    </Link>
  );
}
