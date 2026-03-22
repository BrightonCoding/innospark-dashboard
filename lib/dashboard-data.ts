import type { SheetRow } from "@/lib/dashboard-types";

const DEVPOST_URL = "https://innospark-competition.devpost.com/";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSCdtyNQv1VUQymQDeaKFkdrRgDU5i-yEltSbK9j_wzRJkhzEIva2FLp1mLpnhlNlnyoYmT1av38M4I/pub?gid=934003232&single=true&output=csv";

const REQUEST_TIMEOUT_MS = 15_000;

export interface SheetData {
  headers: string[];
  rows: SheetRow[];
}

function normalizeCell(value: string): string {
  return value.replace(/\uFEFF/g, "").trim();
}

function parseCsvMatrix(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (inQuotes && csv[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(normalizeCell(currentCell));
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(normalizeCell(currentCell));
      currentCell = "";

      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(normalizeCell(currentCell));
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function hasAnyValue(row: SheetRow): boolean {
  return Object.values(row).some((value) => value.trim().length > 0);
}

function getTeamMemberColumns(headers: string[]): string[] {
  return headers.filter((header) =>
    /^Team Member \d+ - Full Name$/i.test(header)
  );
}

function getLeaderColumn(headers: string[]): string | null {
  return (
    headers.find((header) => /Team Leader.*Full Name/i.test(header)) ?? null
  );
}

export function parseSheetCsv(csv: string): SheetData {
  const matrix = parseCsvMatrix(csv);
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...valueRows] = matrix;
  const headers = headerRow.map((header) => normalizeCell(header));
  const rows = valueRows
    .map((valueRow) => {
      const row: SheetRow = {};

      headers.forEach((header, index) => {
        row[header] = normalizeCell(valueRow[index] ?? "");
      });

      return row;
    })
    .filter(hasAnyValue);

  return { headers, rows };
}

export function countSheetTeams(rows: SheetRow[]): number {
  return rows.filter(hasAnyValue).length;
}

export function countSheetParticipants(
  rows: SheetRow[],
  headers: string[]
): number {
  const leaderColumn = getLeaderColumn(headers);
  const teamMemberColumns = getTeamMemberColumns(headers);

  return rows.reduce((total, row) => {
    if (!hasAnyValue(row)) {
      return total;
    }

    const leaderCount = leaderColumn
      ? Number(row[leaderColumn]?.trim().length > 0)
      : 1;
    const extraMemberCount = teamMemberColumns.reduce(
      (memberTotal, column) =>
        memberTotal + Number(row[column]?.trim().length > 0),
      0
    );

    return total + leaderCount + extraMemberCount;
  }, 0);
}

export function extractDevpostParticipantCount(html: string): number | null {
  const patterns = [
    /Participants\s*\((\d[\d,]*)\)/i,
    /(\d[\d,]*)\s*(?:<[^>]*>\s*)*participants/i,
    /id\s*=\s*["']participants-count["'][^>]*>(\d[\d,]*)/i,
    /(\d[\d,]*)\s*(?:<[^>]*>\s*)*registered/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return Number.parseInt(match[1].replace(/,/g, ""), 10);
    }
  }

  return null;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

export async function fetchDevpostParticipantCount(): Promise<number | null> {
  const html = await fetchText(DEVPOST_URL);
  return extractDevpostParticipantCount(html);
}

export async function fetchSheetData(): Promise<SheetData> {
  const csv = await fetchText(SHEET_CSV_URL);
  return parseSheetCsv(csv);
}
