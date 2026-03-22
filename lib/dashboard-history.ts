import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DashboardHistoryPoint } from "@/lib/dashboard-types";

const HISTORY_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "dashboard-history.json"
);
const HISTORY_TIME_ZONE = "America/Toronto";
const MAX_HISTORY_POINTS = 120;

function isHistoryPoint(value: unknown): value is DashboardHistoryPoint {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.date === "string" &&
    typeof entry.devpostCount === "number" &&
    typeof entry.googleFormCount === "number" &&
    typeof entry.totalParticipants === "number" &&
    typeof entry.sheetTeamCount === "number" &&
    typeof entry.updatedAt === "string"
  );
}

function sortHistory(history: DashboardHistoryPoint[]): DashboardHistoryPoint[] {
  return [...history].sort((left, right) => left.date.localeCompare(right.date));
}

async function readHistoryFile(): Promise<DashboardHistoryPoint[]> {
  try {
    const rawHistory = await readFile(HISTORY_FILE_PATH, "utf8");
    const parsedHistory = JSON.parse(rawHistory);

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return sortHistory(parsedHistory.filter(isHistoryPoint));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    console.error("Failed to read dashboard history:", error);
    return [];
  }
}

export function getHistoryDateKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: HISTORY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export async function readDashboardHistory(): Promise<DashboardHistoryPoint[]> {
  return readHistoryFile();
}

export async function upsertDashboardHistory(
  point: DashboardHistoryPoint
): Promise<DashboardHistoryPoint[]> {
  const currentHistory = await readHistoryFile();
  const nextHistory = sortHistory([
    ...currentHistory.filter((entry) => entry.date !== point.date),
    point,
  ]).slice(-MAX_HISTORY_POINTS);

  try {
    await mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
    await writeFile(HISTORY_FILE_PATH, JSON.stringify(nextHistory, null, 2));
  } catch (error) {
    console.error("Failed to write dashboard history:", error);
  }

  return nextHistory;
}
