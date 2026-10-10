"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Expand,
  ImagePlus,
  LoaderCircle,
  SendHorizontal,
  BellOff,
  Bell,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/forms/action-form";
import { confirmMatchCompletedAction } from "@/app/actions/match";
import {
  MATCH_EVIDENCE_DEADLINE_MS,
  MEDIA_DEFAULTS,
} from "@/config/defaults";
import {
  isAbusiveChatMessage,
  isMutedChatMessage,
  MUTED_CHAT_BODY,
  RESPECT_WARNING,
} from "@/lib/chat-moderation";

type Message = {
  _id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  senderOnly?: boolean;
};
type Evidence = {
  _id: string;
  userId: string;
  imageUrl: string;
  kind: "post_match_result";
};

export function MatchChat({
  matchId,
  currentUserId,
}: {
  matchId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Loading private chat…");
  const [expiresAt, setExpiresAt] = useState<string>();
  const [closed, setClosed] = useState(false);
  const [matchStatus, setMatchStatus] = useState("");
  const [result, setResult] = useState<
    "win" | "loss" | "hold" | "unreadable"
  >();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [bothScreenshotsUploaded, setBothScreenshotsUploaded] = useState(false);
  const [screenshot, setScreenshot] = useState<File>();
  const [screenshotName, setScreenshotName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [respectWarning, setRespectWarning] = useState(false);
  const [chatNotificationsMuted, setChatNotificationsMuted] = useState(false);
  const [updatingNotificationMute, setUpdatingNotificationMute] =
    useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [evidenceDeadlineAt, setEvidenceDeadlineAt] = useState<string>();
  const [deadlineOutcome, setDeadlineOutcome] = useState<string>();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const sendingRef = useRef(false);
  const loadingRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const afterCursorRef = useRef<{ createdAt: string; id: string } | undefined>(
    undefined,
  );
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const afterCursor = afterCursorRef.current;
      const cursor = afterCursor
        ? `?after=${encodeURIComponent(afterCursor.createdAt)}&afterId=${afterCursor.id}`
        : "";
      const response = await fetch(`/api/clash/${matchId}/chat${cursor}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json()) as {
        messages?: Message[];
        expiresAt?: string;
        closed?: boolean;
        matchStatus?: string;
        result?: "win" | "loss" | "hold" | "unreadable";
        evidence?: Evidence[];
        bothScreenshotsUploaded?: boolean;
        evidenceDeadlineAt?: string;
        deadlineOutcome?: string;
        chatNotificationsMuted?: boolean;
        error?: string;
      };
      if (!response.ok) return setStatus(data.error ?? "Unable to load chat.");
      const fetchedMessages = data.messages ?? [];
      const latestFetchedMessage = fetchedMessages[fetchedMessages.length - 1];
      if (latestFetchedMessage) {
        afterCursorRef.current = {
          createdAt: latestFetchedMessage.createdAt,
          id: latestFetchedMessage._id,
        };
      }
      const incomingMessages = fetchedMessages.filter((message) => {
        if (message.senderId === currentUserId) return true;
        return !isMutedChatMessage(message.body);
      });
      const messagesById = new Map(
        messagesRef.current.map((message) => [message._id, message]),
      );
      incomingMessages.forEach((message) =>
        messagesById.set(message._id, message),
      );
      messagesRef.current = [...messagesById.values()].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(messagesRef.current);
      setExpiresAt(data.expiresAt);
      setClosed(Boolean(data.closed));
      setMatchStatus(data.matchStatus ?? "");
      setResult((current) =>
        typeof data.result === "undefined" ? current : data.result,
      );
      setEvidence(data.evidence ?? []);
      setBothScreenshotsUploaded(Boolean(data.bothScreenshotsUploaded));
      setEvidenceDeadlineAt(data.evidenceDeadlineAt);
      setDeadlineOutcome(data.deadlineOutcome);
      setChatNotificationsMuted(Boolean(data.chatNotificationsMuted));
      setStatus("");
    } catch {
      setStatus("Unable to load chat.");
    } finally {
      loadingRef.current = false;
    }
  }, [matchId, currentUserId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    // Fast enough to feel live without a WebSocket, and paused in background
    // tabs so it does not generate needless Atlas reads.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 1500);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);
  useEffect(() => {
    // The evidence deadline is a real countdown for both players, so keep the
    // display accurate to the second once either player completes the match.
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || closed || sendingRef.current) return;

    const abusive = isAbusiveChatMessage(body);
    if (abusive) setRespectWarning(true);

    // The ref locks immediately, before React has a chance to render the
    // disabled state after a rapid second click.
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await fetch(`/api/clash/${matchId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: Message;
      };
      if (!response.ok) {
        setStatus(data.error ?? "Unable to send message.");
        return;
      }
      setBody("");
      if (data.message) {
        messagesRef.current = [...messagesRef.current, data.message];
        setMessages(messagesRef.current);
        if (
          !afterCursorRef.current ||
          new Date(data.message.createdAt).getTime() >=
            new Date(afterCursorRef.current.createdAt).getTime()
        ) {
          afterCursorRef.current = {
            createdAt: data.message.createdAt,
            id: data.message._id,
          };
        }
      }
      void load();
    } catch {
      setStatus("Unable to send message. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  async function toggleChatNotifications() {
    if (updatingNotificationMute) return;
    const muted = !chatNotificationsMuted;
    setUpdatingNotificationMute(true);
    try {
      const response = await fetch(`/api/clash/${matchId}/chat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted }),
      });
      if (!response.ok) throw new Error("Unable to update chat notifications.");
      setChatNotificationsMuted(muted);
    } catch {
      setStatus("Unable to update chat notification settings.");
    } finally {
      setUpdatingNotificationMute(false);
    }
  }
  function selectScreenshot(file: File | undefined) {
    if (file && !file.type.startsWith("image/")) {
      setStatus("Please choose an image screenshot.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = file ? URL.createObjectURL(file) : undefined;
    previewUrlRef.current = url;
    setScreenshot(file);
    setScreenshotName(file?.name ?? "");
    setPreviewUrl(url);
    setPreviewOpen(false);
  }
  async function uploadScreenshot() {
    if (!screenshot || closed === false) return;
    setUploadError("");
    const mine = evidence.filter((item) => item.userId === currentUserId);
    const kind = "post_match_result";
    if (mine.length > 0) {
      setStatus("You have already uploaded your result screenshot.");
      return;
    }
    setUploading(true);
    setStatus("Uploading screenshot…");
    const form = new FormData();
    form.set("file", screenshot);
    form.set("purpose", "evidence");
    form.set("matchId", matchId);
    form.set("kind", kind);
    let response: Response;
    let data: {
      error?: string;
      result?: "win" | "loss" | "unreadable";
    };
    try {
      response = await fetch("/api/upload", { method: "POST", body: form });
      data = (await response.json()) as {
        error?: string;
        result?: "win" | "loss" | "unreadable";
      };
    } catch {
      setUploadError(
        "The upload response was lost. Refresh the page to check whether your screenshot was saved.",
      );
      void load();
      return;
    } finally {
      setUploading(false);
    }
    if (!response.ok) {
      selectScreenshot(undefined);
      setPreviewOpen(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
      void load();
      return setUploadError(
        data.error ??
          "The screenshot could not be saved. Please contact an administrator if this continues.",
      );
    }
    selectScreenshot(undefined);
    setPreviewOpen(false);
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    if (data.result) {
      setResult(data.result);
      setStatus("");
    } else {
      setStatus(
        "Screenshot saved. Result verification is continuing; an administrator will review it if needed.",
      );
    }
    void load();
  }
  const millisecondsLeft = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const timeLeft =
    millisecondsLeft > 0
      ? `${Math.floor(millisecondsLeft / 3_600_000)}h ${Math.floor((millisecondsLeft % 3_600_000) / 60_000)}m left`
      : "Chat expired";
  const expired = Boolean(expiresAt && millisecondsLeft <= 0);
  const myEvidence = evidence.filter((item) => item.userId === currentUserId);
  const evidenceDeadlineMillis = evidenceDeadlineAt
    ? new Date(evidenceDeadlineAt).getTime()
    : undefined;

  const evidenceTimeLeft =
    typeof evidenceDeadlineMillis === "number"
      ? Math.max(0, evidenceDeadlineMillis - now)
      : undefined;

  const evidenceCountdown =
    evidenceTimeLeft === undefined
      ? undefined
      : `${Math.ceil(evidenceTimeLeft / 60_000)} min`;
  const evidenceDeadlineMinutes = Math.ceil(
    MATCH_EVIDENCE_DEADLINE_MS / 60_000,
  );
  const evidenceDeadlineActive =
    closed &&
    typeof evidenceTimeLeft === "number" &&
    evidenceTimeLeft >= 0 &&
    !["settled", "disputed", "result_review", "cancelled"].includes(
      matchStatus,
    );
  const provisionalResultVisible =
    bothScreenshotsUploaded ||
    matchStatus === "settled" ||
    (typeof evidenceDeadlineMillis === "number" &&
      evidenceDeadlineMillis <= now);
  const canUpload =
    closed &&
    matchStatus === "awaiting_evidence" &&
    myEvidence.length === 0 &&
    (evidenceTimeLeft === undefined || evidenceTimeLeft > 0);

  const predefinedMessages = [
    "Playing in 10 min",
    "Give me room ID & pass",
    "Playing at 6 PM",
  ];

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
        <span className="text-[var(--muted)]">Share Room ID, Password</span>
        <span
          className={
            expired
              ? "font-semibold text-[var(--danger)]"
              : "font-semibold text-[var(--accent-2)]"
          }
        >
          {expiresAt ? timeLeft : "Loading session…"}
        </span>
      </div>
      {evidenceDeadlineActive ? (
        <div
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-sm font-semibold text-amber-300">
            {evidenceTimeLeft === 0
              ? "Screenshot upload deadline reached. Processing the result…"
              : `Final screenshot deadline: ${evidenceCountdown}`}
          </p>
          {evidenceTimeLeft !== 0 ? (
            <p className="mt-1 text-center text-xs text-amber-100/80">
              Both players have {evidenceDeadlineMinutes}{" "}
              {evidenceDeadlineMinutes === 1 ? "minute" : "minutes"} from match
              completion to upload a final result screenshot.
            </p>
          ) : null}
        </div>
      ) : null}
      {deadlineOutcome && matchStatus !== "cancelled" ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          {deadlineOutcome}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <p className="text-xs text-[var(--muted)]">
          {chatNotificationsMuted
            ? "Opponent chat notifications are muted."
            : "Opponent chat notifications are on."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={updatingNotificationMute}
          onClick={() => void toggleChatNotifications()}
          aria-pressed={chatNotificationsMuted}
        >
          {chatNotificationsMuted ? <Bell size={15} /> : <BellOff size={15} />}
          {chatNotificationsMuted ? "Unmute opponent" : "Mute opponent"}
        </Button>
      </div>
      <div
        ref={transcriptRef}
        className="h-[22rem] min-w-0 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1018] p-3 sm:h-[26rem]"
      >
        {!messages.length && !status ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--muted)]">
            Share the custom room ID, password and agreed rules here.
          </div>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          const muted = isMutedChatMessage(message.body);
          return (
            <div
              key={message._id}
              className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] ${
                  muted
                    ? "rounded-md border border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]"
                    : mine
                      ? "rounded-br-md bg-[var(--accent)] text-black"
                      : "rounded-bl-md bg-white/10 text-white"
                }`}
              >
                <p
                  className={`mb-1 text-xs font-semibold ${
                    muted
                      ? "text-[var(--danger)]/80"
                      : mine
                        ? "text-black/70"
                        : "text-[var(--accent-2)]"
                  }`}
                >
                  {message.senderName ?? (mine ? "You" : "Opponent")}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">
                  {muted ? MUTED_CHAT_BODY : message.body}
                </p>
                <p
                  className={`mt-1 text-right text-[10px] ${
                    muted
                      ? "text-[var(--danger)]/70"
                      : mine
                        ? "text-black/60"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        {closed ? (
          <div className="space-y-3 border-t border-white/10 pt-3">
            {result === "unreadable" ? (
              <p className="text-center text-sm font-medium text-[var(--accent-2)]">
                Analysing and waiting for other players screenshot
              </p>
            ) : result && result !== "hold" ? (
              <div className="relative mb-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
                {provisionalResultVisible ? (
                  <p className="text-center text-base font-semibold text-[var(--accent-2)]">
                    {result === "win"
                      ? "🎉 Congratulations! You won."
                      : "💙 Better luck next time."}
                  </p>
                ) : null}
                {!provisionalResultVisible || matchStatus !== "settled" ? (
                  <p className="relative mt-2 text-center text-xs text-[var(--muted)]">
                    Analysing and waiting for other players screenshot
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="text-center text-sm font-medium text-[var(--accent-2)]">
                  {result === "hold"
                    ? "Match on hold for admin review. Submitted screenshots are preserved."
                    : matchStatus === "cancelled"
                      ? (deadlineOutcome ??
                        "This match was disqualified after the 12-hour chat limit. Both players' NV Tokens have been returned.")
                      : matchStatus === "analyzing"
                        ? "Both result screenshots are in. Verifying the extracted results now."
                        : "Match completed. Text chat is closed; each player must upload one result screenshot."}
                </p>
              </>
            )}
            {evidence.length ? (
              <div className="grid gap-2">
                <p className="text-xs text-[var(--muted)]">
                  Screenshots are removed {MEDIA_DEFAULTS.tempRetentionDays}{" "}
                  days after match completion. Evidence held for admin review
                  is kept until the review is resolved.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {evidence.map((item) => (
                    <a
                      key={item._id}
                      href={item.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-white/10"
                    >
                      <img
                        src={item.imageUrl}
                        alt="Match screenshot"
                        className="aspect-video w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {status ? (
          <p className="text-center text-sm text-[var(--muted)]">{status}</p>
        ) : null}
        {uploadError ? (
          <p
            className="text-center text-sm font-medium text-[var(--danger)]"
            role="alert"
          >
            {uploadError}
          </p>
        ) : null}
      </div>
      {closed ? (
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-2">
          {canUpload ? (
            <>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => selectScreenshot(event.target.files?.[0])}
                aria-label="Choose match-result screenshot"
              />
              <div className="grid min-w-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={() => screenshotInputRef.current?.click()}
                >
                  <ImagePlus className="pointer-events-none" size={17} />
                  Choose screenshot
                </Button>
                {screenshotName ? (
                  <p className="truncate px-1 text-xs text-[var(--muted)]">
                    Selected: {screenshotName}
                  </p>
                ) : null}
                {previewUrl ? (
                  <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                    <button
                      type="button"
                      className="relative overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      onClick={() => setPreviewOpen(true)}
                      aria-label="Open full-size screenshot preview"
                    >
                      <img
                        src={previewUrl}
                        alt="Selected match-result screenshot preview"
                        className="max-h-64 w-full object-contain"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs text-white">
                        <Expand size={14} /> Tap to zoom
                      </span>
                    </button>
                    <p className="px-1 text-xs text-[var(--muted)]">
                      Check that this is the final result screen before
                      confirming. It will be uploaded and then analyzed.
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="w-full cursor-pointer"
                  disabled={!screenshot || uploading}
                  onClick={() => void uploadScreenshot()}
                >
                  {uploading ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <ImagePlus className="pointer-events-none" size={17} />
                  )}
                  {uploading ? "Uploading screenshot…" : "Confirm upload"}
                </Button>
                {uploading ? (
                  <p
                    className="flex items-center gap-2 px-1 text-xs text-[var(--accent-2)]"
                    role="status"
                    aria-live="polite"
                  >
                    <LoaderCircle className="shrink-0 animate-spin" size={15} />
                    Uploading screenshot…
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {matchStatus === "awaiting_evidence" &&
          myEvidence.length > 0 &&
          !result &&
          !canUpload ? (
            <p className="px-1 text-sm text-[var(--accent-2)]">
              Analysing and waiting for other players screenshot
            </p>
          ) : null}
          {matchStatus === "disputed" ? (
            <p className="px-1 text-sm font-medium text-[var(--danger)]">
              Verification is on hold for admin review. Both submitted images
              have been preserved.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
            {predefinedMessages.map((message) => (
              <button
                key={message}
                type="button"
                disabled={expired || sending}
                onClick={() => setBody(message)}
                className="shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50"
              >
                {message}
              </button>
            ))}
          </div>

          <form
            className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2"
            onSubmit={send}
          >
            <input
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              disabled={expired || sending}
              placeholder={
                expired
                  ? "This private chat has expired"
                  : sending
                    ? "Sending message…"
                    : "Type a message…"
              }
              aria-label="Message your opponent"
            />
            <Button
              type="submit"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              disabled={expired || sending || !body.trim()}
              aria-label="Send message"
            >
              {sending ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <SendHorizontal size={18} />
              )}
            </Button>
          </form>
          {messages.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
              <p className="mb-3 px-1 text-sm text-[var(--danger)]">
                This cannot be undone. Once either player marks the match
                completed, chat closes and both players must upload a final
                result screenshot.
              </p>
              <ActionForm
                action={confirmMatchCompletedAction}
                submitLabel="Complete match"
                confirmMessage="Mark this match as completed? Chat will close and both players must submit a final result screenshot."
              >
                <input type="hidden" name="matchId" value={matchId} />
              </ActionForm>
            </div>
          ) : (
            ""
          )}
        </>
      )}
      {respectWarning ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-respect-warning-title"
          onClick={() => setRespectWarning(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--danger)]/40 bg-[#121821] p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="chat-respect-warning-title"
              className="text-base font-semibold text-[var(--danger)]"
            >
              Message muted
            </p>
            <p className="mt-2 text-sm leading-6 text-white/80">
              {RESPECT_WARNING}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Your opponent will not see this message.
            </p>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => setRespectWarning(false)}
            >
              OK
            </Button>
          </div>
        </div>
      ) : null}
      {previewOpen && previewUrl ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Full-size screenshot preview"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative flex h-full w-full max-w-6xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Full-size selected match-result screenshot"
              className="max-h-full max-w-full object-contain"
            />
            <Button
              type="button"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={() => setPreviewOpen(false)}
            >
              <X size={17} /> Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
