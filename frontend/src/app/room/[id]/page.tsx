"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRoomStore } from "@/store/room";
import { api } from "@/lib/api";
import { useRoomWS } from "@/hooks/useRoomWS";
import type { WSEvent, Submission, Round } from "@/types";
import ReactMarkdown from "react-markdown";

function JobStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; dot?: string }> = {
    queued: { label: "Queued", color: "text-text-dim", dot: "bg-muted blink" },
    running: { label: "Generating...", color: "text-accent-glow", dot: "bg-accent-glow spin" },
    completed: { label: "Done", color: "text-green-400", dot: "bg-green-400" },
    failed: { label: "Failed", color: "text-accent-hot", dot: "bg-accent-hot" },
  };
  const cfg = configs[status] || configs.queued;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-display uppercase tracking-wider ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SubmissionCard({
  sub,
  isHost,
  onScore,
  onRetry,
}: {
  sub: Submission;
  isHost: boolean;
  onScore: (id: string, pts: number, elim: boolean) => void;
  onRetry: (id: string) => void;
}) {
  const [scoring, setScoring] = useState(false);
  const [pts, setPts] = useState(sub.points ?? 0);

  return (
    <div
      className={`card p-4 animate-slide-up transition-all duration-300 ${
        sub.eliminated ? "opacity-40 border-accent-hot border-opacity-30" : ""
      } ${sub.job_status === "running" ? "border-pulse" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-display text-xs text-text-dim uppercase tracking-wider">
            {sub.display_name}
          </div>
          <div className="text-text text-sm mt-0.5 italic">"{sub.prompt}"</div>
        </div>
        <div className="shrink-0">
          <JobStatusBadge status={sub.job_status || "queued"} />
        </div>
      </div>

      {sub.job_status === "completed" && sub.output && (
        <div className="mt-3 p-3 bg-surface rounded-lg border border-border">
          <div className="prose-battle">
            <ReactMarkdown>{sub.output}</ReactMarkdown>
          </div>
        </div>
      )}

      {sub.job_status === "failed" && (
        <div className="mt-2 p-2 bg-accent-hot bg-opacity-10 border border-accent-hot border-opacity-20 rounded-lg">
          <p className="text-accent-hot text-xs">{sub.error || "Generation failed"}</p>
          {!isHost && (
            <button
              onClick={() => onRetry(sub.id)}
              className="mt-1.5 text-xs text-accent font-display uppercase tracking-wider hover:opacity-80"
            >
              Retry →
            </button>
          )}
        </div>
      )}

      {sub.points !== undefined && sub.points !== null && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-text-dim">Score:</span>
          <span className="font-display text-sm text-accent-glow">{sub.points} pts</span>
          {sub.eliminated && (
            <span className="text-xs text-accent-hot font-display uppercase tracking-wider">Eliminated</span>
          )}
        </div>
      )}

      {isHost && sub.job_status === "completed" && (
        <div className="mt-3 pt-3 border-t border-border">
          {!scoring ? (
            <button
              onClick={() => setScoring(true)}
              className="text-xs text-accent font-display uppercase tracking-wider hover:opacity-80"
            >
              Score this submission →
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                max={100}
                value={pts}
                onChange={e => setPts(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-surface border border-border rounded text-text text-sm font-display focus:border-accent focus:outline-none"
              />
              <span className="text-text-dim text-xs">pts</span>
              <button
                onClick={() => { onScore(sub.id, pts, false); setScoring(false); }}
                className="px-3 py-1 bg-accent text-white text-xs font-display uppercase tracking-wider rounded hover:opacity-90"
              >
                Award
              </button>
              <button
                onClick={() => { onScore(sub.id, 0, true); setScoring(false); }}
                className="px-3 py-1 bg-accent-hot text-white text-xs font-display uppercase tracking-wider rounded hover:opacity-90"
              >
                Eliminate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();
  const { user, token, hydrate } = useAuthStore();
  const { room, activeRound, submissions, setRoom, setActiveRound, updateRound, addSubmission, updateSubmission, updateScore, addParticipant } = useRoomStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [creatingRound, setCreatingRound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!token) { router.push("/"); return; }
    loadRoom();
  }, [token, roomId]);

  async function loadRoom() {
    try {
      const r = await api.rooms.get(roomId);
      setRoom(r);
      const activeRnd = r.rounds.find(rnd => ["active","scoring"].includes(rnd.status));
      if (activeRnd) {
        setActiveRound(activeRnd);
        const subs = await api.rounds.getSubmissions(activeRnd.id);
        subs.forEach(s => addSubmission(s));
        if (user && subs.some(s => s.user_id === user.id)) setHasSubmitted(true);
      }
    } catch {
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  }

  const handleWsEvent = useCallback((event: WSEvent) => {
    const p = event.payload as Record<string, unknown>;
    switch (event.type) {
      case "participant_joined":
        addParticipant({ id: p.user_id as string, display_name: p.display_name as string, email: "" });
        break;
      case "round_created":
      case "round_started":
        setActiveRound({ ...(p as unknown as Round) });
        break;
      case "round_ended":
        updateRound(p.round_id as string, { status: "scoring" });
        break;
      case "submission_received":
        addSubmission({
          id: p.submission_id as string,
          round_id: activeRound?.id || "",
          user_id: p.user_id as string,
          display_name: p.display_name as string,
          prompt: p.prompt as string,
          submitted_at: new Date().toISOString(),
          job_id: p.job_id as string,
          job_status: "queued",
        });
        break;
      case "job_update":
        updateSubmission(p.submission_id as string, {
          job_status: p.status as string,
          output: p.output as string | undefined,
          error: p.error as string | undefined,
        });
        break;
      case "score_updated":
        updateScore(p.submission_id as string, p.points as number, p.eliminated as boolean);
        break;
    }
  }, [activeRound, addParticipant, setActiveRound, updateRound, addSubmission, updateSubmission, updateScore]);

  useRoomWS(roomId, token, handleWsEvent);

  if (!user) return null;
  const isHost = room?.host_id === user.id;

  async function handleCreateRound(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge.trim() || !room) return;
    setCreatingRound(true);
    try {
      const rnd = await api.rounds.create(room.id, challenge);
      setActiveRound(rnd);
      setChallenge("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create round");
    } finally {
      setCreatingRound(false);
    }
  }

  async function handleStartRound() {
    if (!activeRound) return;
    try {
      await api.rounds.start(activeRound.id);
      updateRound(activeRound.id, { status: "active" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start round");
    }
  }

  async function handleEndRound() {
    if (!activeRound) return;
    try {
      await api.rounds.end(activeRound.id);
      updateRound(activeRound.id, { status: "scoring" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to end round");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !activeRound) return;
    setSubmitting(true);
    try {
      await api.submissions.submit(activeRound.id, prompt);
      setPrompt("");
      setHasSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScore(submissionId: string, points: number, eliminated: boolean) {
    try {
      await api.submissions.score(submissionId, points, eliminated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    }
  }

  async function handleRetry(submissionId: string) {
    try {
      await api.submissions.retry(submissionId);
      updateSubmission(submissionId, { job_status: "queued", error: undefined });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  function copyCode() {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-accent blink text-sm uppercase tracking-widest">Loading battle room...</div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-accent-hot text-sm">{error}</div>
          <button onClick={() => router.push("/")} className="mt-4 text-accent text-xs font-display uppercase tracking-wider">← Back to Lobby</button>
        </div>
      </div>
    );
  }

  const roundSubmissions = submissions.filter(s => s.round_id === activeRound?.id);

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0d0a1a 0%, #050508 70%)" }}>
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="font-display text-accent-glow text-sm hover:opacity-80 transition-opacity">
            POIRO
          </button>
          <span className="text-border">|</span>
          <span className="text-text text-sm">{room?.title}</span>
          {isHost && <span className="text-xs text-accent-hot font-display uppercase tracking-wider px-2 py-0.5 border border-accent-hot border-opacity-40 rounded">Host</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg hover:border-accent transition-colors"
          >
            <span className="font-display text-xs text-text-dim tracking-widest">{room?.code}</span>
            <span className="text-xs text-muted">{copied ? "✓" : "⧉"}</span>
          </button>
          <div className="text-text-dim text-xs">
            {room?.participants.length || 0} players
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {error && (
          <div className="mb-4 p-3 bg-accent-hot bg-opacity-10 border border-accent-hot border-opacity-30 rounded-lg text-accent-hot text-sm flex justify-between">
            {error}
            <button onClick={() => setError("")} className="text-xs opacity-60">✕</button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Participants + Controls */}
          <div className="space-y-4">
            {/* Participants */}
            <div className="card p-4">
              <h3 className="font-display text-xs uppercase tracking-widest text-text-dim mb-3">Players</h3>
              <div className="space-y-2">
                {room?.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent bg-opacity-20 flex items-center justify-center">
                      <span className="font-display text-xs text-accent">{p.display_name[0].toUpperCase()}</span>
                    </div>
                    <span className="text-text text-sm">{p.display_name}</span>
                    {p.id === room.host_id && (
                      <span className="text-xs text-accent-hot font-display">HOST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Round status */}
            {activeRound && (
              <div className="card p-4">
                <h3 className="font-display text-xs uppercase tracking-widest text-text-dim mb-1">Round {activeRound.round_number}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activeRound.status === "active" ? "bg-green-400 blink" :
                    activeRound.status === "scoring" ? "bg-accent" : "bg-muted"
                  }`} />
                  <span className="font-display text-xs uppercase tracking-wider text-text-dim">{activeRound.status}</span>
                </div>
                <p className="text-text text-sm italic">"{activeRound.challenge}"</p>

                {isHost && (
                  <div className="mt-3 space-y-2">
                    {activeRound.status === "pending" && (
                      <button
                        onClick={handleStartRound}
                        className="w-full py-2 bg-green-500 bg-opacity-20 border border-green-500 border-opacity-40 text-green-400 font-display text-xs uppercase tracking-wider rounded-lg hover:bg-opacity-30 transition-all"
                      >
                        Start Round →
                      </button>
                    )}
                    {activeRound.status === "active" && (
                      <button
                        onClick={handleEndRound}
                        className="w-full py-2 bg-accent-hot bg-opacity-10 border border-accent-hot border-opacity-30 text-accent-hot font-display text-xs uppercase tracking-wider rounded-lg hover:bg-opacity-20 transition-all"
                      >
                        End Round
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Host: Create round */}
            {isHost && !activeRound && (
              <div className="card p-4">
                <h3 className="font-display text-xs uppercase tracking-widest text-text-dim mb-3">Create Round</h3>
                <form onSubmit={handleCreateRound} className="space-y-2">
                  <textarea
                    placeholder="Challenge prompt... e.g. Create the most insane luxury cyberpunk perfume campaign for Gen-Z"
                    value={challenge}
                    onChange={e => setChallenge(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent focus:outline-none resize-none transition-colors placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={creatingRound}
                    className="w-full py-2 bg-accent text-white font-display text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {creatingRound ? "Creating..." : "Create Round"}
                  </button>
                </form>
              </div>
            )}

            {/* Waiting state */}
            {!activeRound && !isHost && (
              <div className="card p-6 text-center">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-text-dim text-sm">Waiting for host to start a round...</p>
              </div>
            )}
          </div>

          {/* Main: Submissions area */}
          <div className="md:col-span-2 space-y-4">
            {/* Participant: Submit prompt */}
            {!isHost && activeRound?.status === "active" && !hasSubmitted && (
              <div className="card p-5 border-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 blink" />
                  <h3 className="font-display text-xs uppercase tracking-widest text-text-dim">Round Active — Submit Your Entry</h3>
                </div>
                <div className="text-text text-sm italic mb-4">"{activeRound.challenge}"</div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <textarea
                    placeholder="Describe your creative campaign concept..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent focus:outline-none resize-none transition-colors placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 text-white font-display text-sm uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #6c63ff, #ff3cac)", boxShadow: "0 0 20px #6c63ff44" }}
                  >
                    {submitting ? "Submitting..." : "Submit Entry →"}
                  </button>
                </form>
              </div>
            )}

            {/* Already submitted */}
            {!isHost && activeRound?.status === "active" && hasSubmitted && (
              <div className="card p-4 border-border">
                <div className="flex items-center gap-2">
                  <span className="text-accent">✓</span>
                  <span className="text-text-dim text-sm">Submitted! Watch your generation below...</span>
                </div>
              </div>
            )}

            {/* Submissions list */}
            {roundSubmissions.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-display text-xs uppercase tracking-widest text-text-dim">
                  Entries ({roundSubmissions.length})
                </h3>
                {roundSubmissions.map(sub => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    isHost={isHost}
                    onScore={handleScore}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            ) : activeRound ? (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-3">📭</div>
                <p className="text-text-dim text-sm">
                  {activeRound.status === "pending"
                    ? "Host needs to start the round first."
                    : "No entries yet. Be the first to submit!"}
                </p>
              </div>
            ) : (
              <div className="card p-8 text-center">
                <div className="text-3xl mb-3">🎮</div>
                <p className="text-text-dim text-sm">No active round yet.</p>
                {isHost && <p className="text-text-dim text-xs mt-1">Create a round using the panel on the left.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
