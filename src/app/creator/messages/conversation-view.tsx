/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ComponentType, RefObject } from "react";
import type { OpenThreadResult } from "@/lib/message-inbox";
import type { InboxLinkProps } from "@/app/creator/messages/messages-inbox";

function TextLink({ href, className, children, ...rest }: InboxLinkProps) {
  return (
    <a href={href} data-scroll="false" className={className} aria-label={rest["aria-label"]}>
      {children}
    </a>
  );
}

export function ConversationView({
  titleId,
  closeHref,
  state,
  pending = false,
  formError = null,
  replyAction,
  formRef,
  linkComponent: LinkComponent = TextLink,
}: {
  titleId: string;
  closeHref: string;
  state: OpenThreadResult;
  pending?: boolean;
  formError?: string | null;
  replyAction?: (formData: FormData) => void | Promise<void>;
  formRef?: RefObject<HTMLFormElement | null>;
  linkComponent?: ComponentType<InboxLinkProps>;
}) {
  const title = state.ok ? state.view.thread.otherParty : "Messages";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[#EEF2F7] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <LinkComponent href={closeHref} scroll={false} className="mb-3 inline-flex text-sm font-semibold text-[#6D4AFF] md:hidden">
              Back to messages
            </LinkComponent>
            <div className="flex items-center gap-3">
              {state.ok ? (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-[#6D4AFF]">
                  {state.view.thread.otherInitials}
                </span>
              ) : null}
              <div className="min-w-0">
                <h2 id={titleId} className="truncate font-display text-xl font-bold text-[#1B1464]">
                  {title}
                </h2>
                {state.ok ? <p className="truncate text-sm font-semibold text-[#6D4AFF]">{state.view.thread.campaign}</p> : null}
              </div>
            </div>
          </div>
          <LinkComponent
            href={closeHref}
            scroll={false}
            aria-label="Close dialog"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl text-[#1B1464] hover:bg-[#F4F0FF] md:inline-flex"
          >
            ×
          </LinkComponent>
        </div>
        {state.ok ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#EEF2F7] pt-3">
            <p className="text-sm text-[#667085]">{state.view.visibleTo}</p>
            <a href={state.view.contractHref} className="shrink-0 text-sm font-semibold text-[#6D4AFF] hover:underline">
              View contract
            </a>
          </div>
        ) : null}
      </header>
      {state.ok ? (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {state.view.messages.length === 0 ? <p className="text-sm text-[#667085]">No messages yet.</p> : null}
            <ul className="space-y-4">
              {state.view.messages.map((message) => (
                <li key={message.id} className={`flex items-end gap-2 ${message.fromViewer ? "justify-end" : "justify-start"}`}>
                  {message.fromViewer ? null : <Avatar initials={message.initials} />}
                  <div className={`max-w-[80%] ${message.fromViewer ? "text-right" : ""}`}>
                    <p className="text-xs text-[#667085]">
                      {message.senderName}, {message.timeLabel}
                    </p>
                    <p
                      className={`mt-1 whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${
                        message.fromViewer ? "bg-[#6D4AFF] text-white" : "bg-[#F4F7FF] text-[#1B1464]"
                      }`}
                    >
                      {message.body}
                    </p>
                  </div>
                  {message.fromViewer ? <Avatar initials={message.initials} /> : null}
                </li>
              ))}
            </ul>
          </div>
          <form ref={formRef} action={replyAction ?? "#reply"} className="border-t border-[#EEF2F7] px-5 py-4">
            <input type="hidden" name="threadId" value={state.view.thread.id} />
            <p className="text-sm font-semibold text-[#1B1464]">{state.view.replyRecipients}</p>
            {formError ? <p className="mt-2 text-sm text-amber-800">{formError}</p> : null}
            <label className="mt-2 block text-sm font-semibold text-[#1B1464]">
              Reply
              <span className="mt-2 flex items-center gap-2">
                <input
                  name="body"
                  required
                  minLength={1}
                  maxLength={2000}
                  autoComplete="off"
                  placeholder="Write a message..."
                  className="h-11 min-w-0 flex-1 rounded-full border border-[#E4E9F5] px-4 text-sm font-normal outline-none focus:border-[#6D4AFF]"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 items-center rounded-xl bg-[#6D4AFF] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Sending" : "Send"}
                </button>
              </span>
            </label>
          </form>
        </>
      ) : (
        <div className="px-5 py-6">
          <p className="text-sm text-[#1B1464]">{state.error}</p>
          <LinkComponent href={closeHref} scroll={false} className="mt-4 inline-flex text-sm font-semibold text-[#6D4AFF]">
            Back to messages
          </LinkComponent>
        </div>
      )}
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-xs font-bold text-[#6D4AFF]">
      {initials}
    </span>
  );
}
