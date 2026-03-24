export interface SheetRow {
  [key: string]: string;
}

export interface DashboardHistoryPoint {
  date: string;
  devpostCount: number;
  googleFormCount: number;
  totalParticipants: number;
  sheetTeamCount: number;
  updatedAt: string;
}

export interface DashboardSubmissionTrendPoint {
  date: string;
  dailyParticipantCount: number;
  dailyTeamCount: number;
  cumulativeParticipantCount: number;
  cumulativeTeamCount: number;
}

export interface DashboardSnapshot {
  devpostCount: number | null;
  devpostStartDate: string | null;
  devpostDeadline: string | null;
  googleFormCount: number;
  sheetHeaders: string[];
  sheetRows: SheetRow[];
  sheetTeamCount: number;
  submissionTrend: DashboardSubmissionTrendPoint[];
  totalParticipants: number;
  fetchedAt: string;
  warnings: string[];
  history: DashboardHistoryPoint[];
  stale: boolean;
}
