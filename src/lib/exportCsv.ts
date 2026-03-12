/**
 * exportCsv.ts — Client-side CSV export utilities
 */

import type { SeedEntry } from "@/types/config";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csv(rows: string[][]): string {
  return rows.map(r =>
    r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");
}

export function exportParticipantsCsv(
  eventName:   string,
  programName: string,
  participants: SeedEntry[],
  isBadminton:  boolean,
) {
  const headers = [
    "No.", "Club / School / Org", "Player(s)",
    ...(isBadminton ? ["SBA ID"] : []),
    "Seed",
  ];

  const rows = participants.map((p, i) => [
    String(i + 1),
    p.club,
    p.participants.join(" / "),
    ...(isBadminton ? [p.sbaId ?? ""] : []),
    p.seed != null ? String(p.seed) : "",
  ]);

  const filename = `${eventName} - ${programName} - Participants.csv`
    .replace(/[/\\?%*:|"<>]/g, "-");

  download(filename, csv([headers, ...rows]));
}