"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Expand,
  ImagePlus,
  LoaderCircle,
  SendHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/forms/action-form";
import { confirmMatchCompletedAction } from "@/app/actions/match";

type Message = {
  _id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
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
  const [result, setResult] = useState<"win" | "loss" | "hold">();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [screenshot, setScreenshot] = useState<File>();
  const [screenshotName, setScreenshotName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const load = useCallback(async () => {
    const response = await fetch(`/api/clash/${matchId}/chat`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      messages?: Message[];
      expiresAt?: string;
      closed?: boolean;
      matchStatus?: string;
      result?: "win" | "loss" | "hold";
      evidence?: Evidence[];
      error?: string;
    };
    if (!response.ok) return setStatus(data.error ?? "Unable to load chat.");
    setMessages(data.messages ?? []);
    setExpiresAt(data.expiresAt);
    setClosed(Boolean(data.closed));
    setMatchStatus(data.matchStatus ?? "");
    setResult((current) =>
      typeof data.result === "undefined" ? current : data.result,
    );
    setEvidence(data.evidence ?? []);
    setStatus("");
  }, [matchId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
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
    if (!body.trim() || closed) return;
    const response = await fetch(`/api/clash/${matchId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await response.json()) as {
      error?: string;
      message?: Message;
    };
    if (!response.ok) return setStatus(data.error ?? "Unable to send message.");
    setBody("");
    if (data.message) setMessages((current) => [...current, data.message!]);
    void load();
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
    setAnalyzingScreenshot(false);
    setStatus("Uploading screenshot…");
    // Uploads usually finish before OCR starts. If the request remains active,
    // make the potentially longer AI analysis phase explicit to the player.
    const analysisIndicatorTimer = window.setTimeout(
      () => setAnalyzingScreenshot(true),
      800,
    );
    const form = new FormData();
    form.set("file", screenshot);
    form.set("purpose", "evidence");
    form.set("matchId", matchId);
    form.set("kind", kind);
    let response: Response;
    let data: { error?: string; result?: "win" | "loss" };
    try {
      response = await fetch("/api/upload", { method: "POST", body: form });
      data = (await response.json()) as {
        error?: string;
        result?: "win" | "loss";
      };
    } finally {
      window.clearTimeout(analysisIndicatorTimer);
      setUploading(false);
      setAnalyzingScreenshot(false);
    }
    if (!response.ok) {
      selectScreenshot(undefined);
      setPreviewOpen(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";
      return setUploadError(
        data.error ??
          "We couldn't read the screenshot. Please upload a clear final-result image again.",
      );
    }
    selectScreenshot(undefined);
    setPreviewOpen(false);
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    if (data.result) {
      setResult(data.result);
      setStatus("");
    } else {
      setStatus("");
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
  const canUpload =
    closed && matchStatus === "awaiting_evidence" && myEvidence.length === 0;
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
        <span className="text-[var(--muted)]">Private to both captains</span>
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
      <div
        ref={transcriptRef}
        className="h-[22rem] min-w-0 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1018] p-3 sm:h-[26rem]"
      >
        {!messages.length && !status ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-[var(--muted)]">
            No messages yet. Share the custom room ID, password and agreed rules
            here.
          </div>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div
              key={message._id}
              className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] ${mine ? "rounded-br-md bg-[var(--accent)] text-black" : "rounded-bl-md bg-white/10 text-white"}`}
              >
                <p
                  className={`mb-1 text-xs font-semibold ${mine ? "text-black/70" : "text-[var(--accent-2)]"}`}
                >
                  {message.senderName ?? (mine ? "You" : "Opponent")}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">
                  {message.body}
                </p>
                <p
                  className={`mt-1 text-right text-[10px] ${mine ? "text-black/60" : "text-[var(--muted)]"}`}
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
            {result && result !== "hold" ? (
              <div className="relative mb-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
                <p className="text-center text-base font-semibold text-[var(--accent-2)]">
                  {result === "win"
                    ? "🎉 Congratulations! You won."
                    : "💙 Better luck next time."}
                </p>
                {matchStatus !== "settled" ? (
                  <p className="relative mt-2 text-center text-xs text-[var(--muted)]">
                    Waiting for the other player to upload their result
                    screenshot.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-center text-sm font-medium text-[var(--accent-2)]">
                {result === "hold"
                  ? "⚠ Match on Hold. Conflicting screenshots detected. Admin will review."
                  : matchStatus === "analyzing"
                    ? "Both result screenshots are in. Verifying the extracted results now."
                    : "Match completed. Text chat is closed; each player must upload one result screenshot."}
              </p>
            )}
            {evidence.length ? (
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
                  {analyzingScreenshot
                    ? "Analyzing screenshot…"
                    : uploading
                      ? "Uploading screenshot…"
                      : "Confirm upload"}
                </Button>
                {uploading ? (
                  <p
                    className="flex items-center gap-2 px-1 text-xs text-[var(--accent-2)]"
                    role="status"
                    aria-live="polite"
                  >
                    <LoaderCircle className="shrink-0 animate-spin" size={15} />
                    {analyzingScreenshot
                      ? "Analyzing screenshot… Please keep this page open."
                      : "Uploading screenshot…"}
                  </p>
                ) : null}
              </div>
              <p className="px-1 text-xs text-[var(--muted)]">
                Upload your final match-result screenshot.
              </p>
            </>
          ) : null}
          {matchStatus === "awaiting_evidence" && !canUpload ? (
            <p className="px-1 text-sm text-[var(--accent-2)]">
              Your result screenshot is submitted. Waiting for the other player.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <form
            className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-2"
            onSubmit={send}
          >
            <input
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              disabled={expired}
              placeholder={
                expired ? "This private chat has expired" : "Type a message…"
              }
              aria-label="Message your opponent"
            />
            <Button
              type="submit"
              className="h-10 w-10 shrink-0 rounded-xl p-0"
              disabled={expired}
              aria-label="Send message"
            >
              <SendHorizontal size={18} />
            </Button>
          </form>

          {messages.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
              <p className="mb-3 px-1 text-sm text-[var(--danger)]">
                This cannot be undone. Once either player marks the match
                completed, chat closes and both players must upload a final
                result screenshot.
              </p>
              <ActionForm
                action={confirmMatchCompletedAction}
                submitLabel="Mark match completed"
                confirmMessage="Mark this match as completed? Chat will close and both players must submit a final result screenshot."
              >
                <input type="hidden" name="matchId" value={matchId} />
              </ActionForm>
            </div>
          )}
        </>
      )}
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
