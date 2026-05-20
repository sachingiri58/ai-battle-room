export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  host_id: string;
  status: "waiting" | "in_progress" | "finished";
  participants: Participant[];
  rounds: Round[];
}

export interface Participant {
  id: string;
  display_name: string;
  email: string;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  challenge: string;
  status: "pending" | "active" | "scoring" | "finished";
  started_at?: string;
  ended_at?: string;
}

export interface Submission {
  id: string;
  round_id: string;
  user_id: string;
  display_name: string;
  prompt: string;
  submitted_at: string;
  job_id?: string;
  job_status?: JobStatus;
  output?: string;
  error?: string;
  points?: number;
  eliminated?: boolean;
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "timed_out";

export interface WSEvent {
  type: string;
  payload: Record<string, unknown>;
}
