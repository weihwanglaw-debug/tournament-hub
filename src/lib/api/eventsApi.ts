/**
 * eventsApi.ts — Event & Program management.
 *
 * Real backend:
 *   GET    /events                        list all events
 *   GET    /events/:id                    single event with programs
 *   POST   /events                        create event
 *   PUT    /events/:id                    update event details
 *   DELETE /events/:id                    delete event (admin only)
 *   POST   /events/:id/programs           add program to event
 *   PUT    /events/:id/programs/:pid      update program
 *   DELETE /events/:id/programs/:pid      remove program
 *
 * Mock: all data lives in config.json (read-only in mock — writes are no-ops
 *       that return the mutated shape so the UI can reflect the change).
 *       In production, write operations persist to the events & programs tables.
 *
 * Key design:
 *   - Programs are ALWAYS embedded inside their parent Event in responses.
 *   - Never fetch a program standalone — always go through apiGetEvent().
 *   - currentParticipants is a real-time COUNT from the registrations table
 *     (mock returns the value embedded in config.json).
 *
 * Consumers: Landing.tsx, EventDetail.tsx, Events.tsx (admin),
 *            EventEdit.tsx (admin), Dashboard.tsx, Fixtures.tsx (admin)
 */

import { ok, err, delay }   from "./_base";
import type { ApiResult }    from "./_base";
import type { TournamentEvent, Program } from "@/types/config";
import rawConfig              from "@/data/config.json";

// ── In-memory store (mock only) ───────────────────────────────────────────────
// Deep-clone so mutations during the session don't corrupt the module cache.
let _events: TournamentEvent[] = JSON.parse(JSON.stringify(rawConfig.events));

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * GET /events
 * Returns all events with embedded programs.
 * Optional filter params mirror what the admin Events page uses.
 */
export async function apiGetEvents(filters?: {
  status?: string;          // "open" | "upcoming" | "closed"
  dateFrom?: string;        // ISO date
  dateTo?: string;          // ISO date
}): Promise<ApiResult<TournamentEvent[]>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  let result = [..._events];
  // Filtering is currently done client-side; backend will handle it via query params.
  void filters;
  return ok(result);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const params = new URLSearchParams();
  // if (filters?.status)   params.set("status",   filters.status);
  // if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  // if (filters?.dateTo)   params.set("dateTo",   filters.dateTo);
  // const res = await fetch(`/api/events?${params}`);
  // if (!res.ok) return err("FETCH_FAILED", "Failed to load events.");
  // return ok(await res.json());
}

/**
 * GET /events/:id
 * Returns a single event with all programs embedded.
 */
export async function apiGetEvent(eventId: string): Promise<ApiResult<TournamentEvent>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const ev = _events.find(e => e.id === eventId);
  if (!ev) return err("NOT_FOUND", `Event '${eventId}' not found.`);
  return ok({ ...ev });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}`);
  // if (!res.ok) return err("NOT_FOUND", "Event not found.");
  // return ok(await res.json());
}

/**
 * POST /events
 * Creates a new event. Programs are added separately via apiAddProgram().
 */
export async function apiCreateEvent(
  payload: Omit<TournamentEvent, "id" | "programs">,
): Promise<ApiResult<TournamentEvent>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const newEvent: TournamentEvent = {
    ...payload,
    id:       `evt-${Date.now().toString(36)}`,
    programs: [],
  };
  _events = [..._events, newEvent];
  return ok(newEvent);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch("/api/events", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) return err("CREATE_FAILED", "Failed to create event.");
  // return ok(await res.json());
}

/**
 * PUT /events/:id
 * Updates event-level fields (not programs — use apiUpdateProgram for those).
 */
export async function apiUpdateEvent(
  eventId: string,
  patch: Partial<Omit<TournamentEvent, "id" | "programs">>,
): Promise<ApiResult<TournamentEvent>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _events.findIndex(e => e.id === eventId);
  if (idx < 0) return err("NOT_FOUND", "Event not found.");
  _events[idx] = { ..._events[idx], ...patch };
  return ok({ ..._events[idx] });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}`, {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update event.");
  // return ok(await res.json());
}

/**
 * DELETE /events/:id
 * Hard-deletes an event. The backend should also cascade-delete programs,
 * registrations, and fixtures (or reject if registrations exist).
 */
export async function apiDeleteEvent(eventId: string): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  _events = _events.filter(e => e.id !== eventId);
  return ok(null);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
  // if (!res.ok) return err("DELETE_FAILED", "Failed to delete event.");
  // return ok(null);
}

// ── Program sub-resource ──────────────────────────────────────────────────────

/**
 * POST /events/:id/programs
 * Adds a new program to an event.
 * Programs are child records: they don't exist without an event.
 */
export async function apiAddProgram(
  eventId: string,
  payload: Omit<Program, "id" | "currentParticipants" | "participantSeeds">,
): Promise<ApiResult<Program>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const idx = _events.findIndex(e => e.id === eventId);
  if (idx < 0) return err("NOT_FOUND", "Event not found.");
  const newProgram: Program = {
    ...payload,
    id:                  `prog-${Date.now().toString(36)}`,
    currentParticipants: 0,
    participantSeeds:    [],
  };
  _events[idx] = { ..._events[idx], programs: [..._events[idx].programs, newProgram] };
  return ok(newProgram);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}/programs`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // });
  // if (!res.ok) return err("CREATE_FAILED", "Failed to add program.");
  // return ok(await res.json());
}

/**
 * PUT /events/:id/programs/:pid
 * Updates a program's settings. Cannot change currentParticipants directly
 * (that is a live count derived from registrations).
 */
export async function apiUpdateProgram(
  eventId: string,
  programId: string,
  patch: Partial<Omit<Program, "id" | "currentParticipants">>,
): Promise<ApiResult<Program>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const evIdx = _events.findIndex(e => e.id === eventId);
  if (evIdx < 0) return err("NOT_FOUND", "Event not found.");
  const pIdx = _events[evIdx].programs.findIndex(p => p.id === programId);
  if (pIdx < 0) return err("NOT_FOUND", "Program not found.");
  _events[evIdx].programs[pIdx] = { ..._events[evIdx].programs[pIdx], ...patch };
  return ok({ ..._events[evIdx].programs[pIdx] });

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}/programs/${programId}`, {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(patch),
  // });
  // if (!res.ok) return err("UPDATE_FAILED", "Failed to update program.");
  // return ok(await res.json());
}

/**
 * DELETE /events/:id/programs/:pid
 * Removes a program. Backend should reject if confirmed registrations exist.
 */
export async function apiDeleteProgram(
  eventId: string,
  programId: string,
): Promise<ApiResult<null>> {
  await delay();

  // ── MOCK ──────────────────────────────────────────────────────────────────
  const evIdx = _events.findIndex(e => e.id === eventId);
  if (evIdx < 0) return err("NOT_FOUND", "Event not found.");
  _events[evIdx].programs = _events[evIdx].programs.filter(p => p.id !== programId);
  return ok(null);

  // ── REAL ──────────────────────────────────────────────────────────────────
  // const res = await fetch(`/api/events/${eventId}/programs/${programId}`, {
  //   method: "DELETE",
  // });
  // if (!res.ok) return err("DELETE_FAILED", "Failed to delete program.");
  // return ok(null);
}