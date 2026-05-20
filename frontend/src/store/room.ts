import { create } from "zustand";
import type { Room, Round, Submission, Participant } from "@/types";

interface RoomState {
  room: Room | null;
  activeRound: Round | null;
  submissions: Submission[];
  setRoom: (room: Room) => void;
  updateRoomStatus: (status: Room["status"]) => void;
  addParticipant: (p: Participant) => void;
  setActiveRound: (round: Round) => void;
  updateRound: (roundId: string, updates: Partial<Round>) => void;
  addSubmission: (sub: Submission) => void;
  updateSubmission: (submissionId: string, updates: Partial<Submission>) => void;
  updateScore: (submissionId: string, points: number, eliminated: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  activeRound: null,
  submissions: [],

  setRoom: (room) => set({ room }),
  updateRoomStatus: (status) =>
    set((s) => ({ room: s.room ? { ...s.room, status } : null })),
  addParticipant: (p) =>
    set((s) => ({
      room: s.room
        ? { ...s.room, participants: [...s.room.participants.filter((x) => x.id !== p.id), p] }
        : null,
    })),
  setActiveRound: (round) =>
    set((s) => ({
      activeRound: round,
      room: s.room
        ? {
            ...s.room,
            rounds: [...s.room.rounds.filter((r) => r.id !== round.id), round].sort(
              (a, b) => a.round_number - b.round_number
            ),
          }
        : null,
    })),
  updateRound: (roundId, updates) =>
    set((s) => ({
      activeRound:
        s.activeRound?.id === roundId ? { ...s.activeRound, ...updates } : s.activeRound,
      room: s.room
        ? {
            ...s.room,
            rounds: s.room.rounds.map((r) => (r.id === roundId ? { ...r, ...updates } : r)),
          }
        : null,
    })),
  addSubmission: (sub) =>
    set((s) => ({
      submissions: [...s.submissions.filter((x) => x.id !== sub.id), sub],
    })),
  updateSubmission: (submissionId, updates) =>
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.id === submissionId ? { ...sub, ...updates } : sub
      ),
    })),
  updateScore: (submissionId, points, eliminated) =>
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.id === submissionId ? { ...sub, points, eliminated } : sub
      ),
    })),
  reset: () => set({ room: null, activeRound: null, submissions: [] }),
}));
