import type {
  DashboardSubmissionTrendPoint,
  SheetRow,
} from "@/lib/dashboard-types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TIMESTAMP_HEADER_PATTERN = /timestamp|submission date/i;
const TEAM_MEMBER_COLUMN_PATTERN = /^Team Member \d+ - Full Name$/i;
const LEADER_COLUMN_PATTERN = /Team Leader.*Full Name/i;

function hasAnyValue(row: SheetRow): boolean {
  return Object.values(row).some((value) => value.trim().length > 0);
}

function getLeaderColumn(headers: string[]): string | null {
  return (
    headers.find((header) => LEADER_COLUMN_PATTERN.test(header)) ?? null
  );
}

function getTeamMemberColumns(headers: string[]): string[] {
  return headers.filter((header) => TEAM_MEMBER_COLUMN_PATTERN.test(header));
}

function getTimestampColumn(headers: string[]): string | null {
  return headers.find((header) => TIMESTAMP_HEADER_PATTERN.test(header)) ?? null;
}

function getParticipantCountForRow(
  row: SheetRow,
  leaderColumn: string | null,
  teamMemberColumns: string[]
): number {
  if (!hasAnyValue(row)) {
    return 0;
  }

  const leaderCount = leaderColumn
    ? Number(row[leaderColumn]?.trim().length > 0)
    : 1;
  const extraMemberCount = teamMemberColumns.reduce(
    (memberTotal, column) =>
      memberTotal + Number(row[column]?.trim().length > 0),
    0
  );

  return leaderCount + extraMemberCount;
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey: string, days: number): string {
  const nextDate = toUtcDate(dateKey);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return toDateKey(nextDate);
}

function parseTimestampToDateKey(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const spreadsheetMatch = trimmedValue.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/
  );
  if (spreadsheetMatch) {
    const [, month, day, year] = spreadsheetMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return toDateKey(parsedDate);
}

export function buildSubmissionTrend(
  rows: SheetRow[],
  headers: string[]
): DashboardSubmissionTrendPoint[] {
  const timestampColumn = getTimestampColumn(headers);
  if (!timestampColumn) {
    return [];
  }

  const leaderColumn = getLeaderColumn(headers);
  const teamMemberColumns = getTeamMemberColumns(headers);
  const totalsByDate = new Map<
    string,
    {
      dailyParticipantCount: number;
      dailyTeamCount: number;
    }
  >();

  rows.forEach((row) => {
    const dateKey = parseTimestampToDateKey(row[timestampColumn] ?? "");
    const participantCount = getParticipantCountForRow(
      row,
      leaderColumn,
      teamMemberColumns
    );

    if (!dateKey || participantCount === 0) {
      return;
    }

    const currentTotal = totalsByDate.get(dateKey) ?? {
      dailyParticipantCount: 0,
      dailyTeamCount: 0,
    };

    currentTotal.dailyParticipantCount += participantCount;
    currentTotal.dailyTeamCount += 1;
    totalsByDate.set(dateKey, currentTotal);
  });

  const sortedDates = [...totalsByDate.keys()].sort((left, right) =>
    left.localeCompare(right)
  );
  if (sortedDates.length === 0) {
    return [];
  }

  const firstDate = sortedDates[0];
  const lastDate = sortedDates.at(-1) ?? firstDate;
  const trend: DashboardSubmissionTrendPoint[] = [];
  let currentDate = firstDate;
  let cumulativeParticipantCount = 0;
  let cumulativeTeamCount = 0;

  while (currentDate <= lastDate) {
    const currentTotal = totalsByDate.get(currentDate) ?? {
      dailyParticipantCount: 0,
      dailyTeamCount: 0,
    };

    cumulativeParticipantCount += currentTotal.dailyParticipantCount;
    cumulativeTeamCount += currentTotal.dailyTeamCount;

    trend.push({
      date: currentDate,
      dailyParticipantCount: currentTotal.dailyParticipantCount,
      dailyTeamCount: currentTotal.dailyTeamCount,
      cumulativeParticipantCount,
      cumulativeTeamCount,
    });

    currentDate = addDays(currentDate, 1);
  }

  return trend;
}

export function getDateDifferenceInDays(
  startDateKey: string,
  endDateKey: string
): number {
  return Math.round(
    (toUtcDate(endDateKey).getTime() - toUtcDate(startDateKey).getTime()) /
      DAY_IN_MS
  );
}
