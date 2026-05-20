const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("poiro_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    register: (email: string, password: string, display_name: string) =>
      request<{ token: string; user: { id: string; email: string; display_name: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; display_name: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ id: string; email: string; display_name: string }>("/api/auth/me"),
  },
  rooms: {
    create: (title: string) =>
      request<{ id: string; code: string; title: string; host_id: string; status: string }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    get: (roomIdOrCode: string) => request<import("@/types").Room>(`/api/rooms/${roomIdOrCode}`),
    join: (roomId: string) =>
      request<{ room_id: string; joined: boolean }>(`/api/rooms/${roomId}/join`, { method: "POST" }),
  },
  rounds: {
    create: (room_id: string, challenge: string) =>
      request<import("@/types").Round>("/api/rounds", {
        method: "POST",
        body: JSON.stringify({ room_id, challenge }),
      }),
    start: (round_id: string) =>
      request<{ round_id: string; status: string }>(`/api/rounds/${round_id}/start`, { method: "POST" }),
    end: (round_id: string) =>
      request<{ round_id: string; status: string }>(`/api/rounds/${round_id}/end`, { method: "POST" }),
    getSubmissions: (round_id: string) =>
      request<import("@/types").Submission[]>(`/api/rounds/${round_id}/submissions`),
  },
  submissions: {
    submit: (round_id: string, prompt: string) =>
      request<{ submission_id: string; job_id: string; status: string }>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({ round_id, prompt }),
      }),
    retry: (submission_id: string) =>
      request<{ job_id: string; status: string }>(`/api/submissions/${submission_id}/retry`, { method: "POST" }),
    score: (submission_id: string, points: number, eliminated: boolean) =>
      request<{ scored: boolean }>("/api/submissions/score", {
        method: "POST",
        body: JSON.stringify({ submission_id, points, eliminated }),
      }),
  },
};
