"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

export default function HomePage() {
  const { user, token, setAuth, hydrate } = useAuthStore();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = mode === "login"
        ? await api.auth.login(email, password)
        : await api.auth.register(email, password, displayName);
      setAuth(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomTitle.trim()) return;
    setCreating(true);
    try {
      const room = await api.rooms.create(roomTitle);
      router.push(`/room/${room.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setCreating(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setJoining(true);
    try {
      const res = await api.rooms.join(roomCode.toUpperCase());
      router.push(`/room/${res.room_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setJoining(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "radial-gradient(ellipse at top, #0d0a1a 0%, #050508 60%)" }}>
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="font-display text-4xl font-bold mb-2 text-gradient-accent">POIRO</div>
            <div className="text-text-dim text-sm tracking-widest uppercase">AI Battle Room</div>
            <div className="mt-3 flex justify-center gap-2">
              {["⚡","🎯","🔥"].map(e => (
                <span key={e} className="text-lg opacity-60">{e}</span>
              ))}
            </div>
          </div>

          {/* Auth Card */}
          <div className="card p-6 glow-accent">
            <div className="flex mb-6 gap-1 p-1 bg-surface rounded-lg">
              {(["login","register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); }}
                  className={`flex-1 py-1.5 rounded-md font-display text-xs uppercase tracking-wider transition-all duration-200 ${
                    mode === m ? "bg-accent text-white" : "text-text-dim hover:text-text"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-3">
              {mode === "register" && (
                <input
                  type="text"
                  placeholder="Display Name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent focus:outline-none transition-colors placeholder:text-muted"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent focus:outline-none transition-colors placeholder:text-muted"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent focus:outline-none transition-colors placeholder:text-muted"
              />
              {error && <p className="text-accent-hot text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-accent hover:bg-opacity-90 text-white font-display text-sm uppercase tracking-wider rounded-lg transition-all duration-200 disabled:opacity-50 glow-accent"
              >
                {loading ? "..." : mode === "login" ? "Enter the Arena" : "Create Identity"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Lobby screen
  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "radial-gradient(ellipse at top, #0d0a1a 0%, #050508 60%)" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="font-display text-2xl text-gradient-accent">POIRO</div>
            <div className="text-text-dim text-xs tracking-widest uppercase">AI Battle Room</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-text text-sm">{user.display_name}</div>
              <div className="text-text-dim text-xs">{user.email}</div>
            </div>
            <button
              onClick={() => useAuthStore.getState().clearAuth()}
              className="text-muted hover:text-text-dim text-xs font-display uppercase tracking-wider transition-colors"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Room */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-accent-hot text-xl">⚔️</span>
              <h2 className="font-display text-sm uppercase tracking-widest text-text-dim">Host a Battle</h2>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <input
                type="text"
                placeholder="Battle room title..."
                value={roomTitle}
                onChange={e => setRoomTitle(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm focus:border-accent-hot focus:outline-none transition-colors placeholder:text-muted"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-accent-hot hover:opacity-90 text-white font-display text-sm uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
                style={{ boxShadow: "0 0 20px #ff3cac44" }}
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </form>
          </div>

          {/* Join Room */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-accent-glow text-xl">🎯</span>
              <h2 className="font-display text-sm uppercase tracking-widest text-text-dim">Join a Battle</h2>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <input
                type="text"
                placeholder="Room code (e.g. AB1C2D)"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                required
                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-text text-sm font-display tracking-widest focus:border-accent-glow focus:outline-none transition-colors placeholder:text-muted uppercase"
              />
              <button
                type="submit"
                disabled={joining}
                className="w-full py-2.5 text-white font-display text-sm uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #6c63ff, #00f5ff)", boxShadow: "0 0 20px #00f5ff33" }}
              >
                {joining ? "Joining..." : "Enter Room"}
              </button>
            </form>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-accent-hot bg-opacity-10 border border-accent-hot border-opacity-30 rounded-lg text-accent-hot text-sm">
            {error}
          </div>
        )}

        <p className="text-center text-muted text-xs mt-8">
          Create a room and share the code with friends to battle in real-time AI creative challenges.
        </p>
      </div>
    </div>
  );
}
