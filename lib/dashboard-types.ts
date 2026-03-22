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

export interface DashboardSnapshot {
  devpostCount: number | null;
  googleFormCount: number;
  sheetHeaders: string[];
  sheetRows: SheetRow[];
  sheetTeamCount: number;
  totalParticipants: number;
  fetchedAt: string;
  warnings: string[];
  history: DashboardHistoryPoint[];
  stale: boolean;
}
