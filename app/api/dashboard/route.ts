import { NextResponse } from "next/server";
import {
  countSheetParticipants,
  countSheetTeams,
  fetchDevpostParticipantCount,
  fetchSheetData,
} from "@/lib/dashboard-data";
import {
  getHistoryDateKey,
  readDashboardHistory,
  upsertDashboardHistory,
} from "@/lib/dashboard-history";
import type { DashboardSnapshot, SheetRow } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const history = await readDashboardHistory();
  const latestHistoryPoint = history.at(-1) ?? null;
  const [devpostResult, sheetResult] = await Promise.allSettled([
    fetchDevpostParticipantCount(),
    fetchSheetData(),
  ]);

  const warnings: string[] = [];
  let devpostCount: number | null = latestHistoryPoint?.devpostCount ?? null;
  let googleFormCount = latestHistoryPoint?.googleFormCount ?? 0;
  let sheetHeaders: string[] = [];
  let sheetRows: SheetRow[] = [];
  let sheetTeamCount = latestHistoryPoint?.sheetTeamCount ?? 0;
  let stale = false;

  if (devpostResult.status === "fulfilled" && devpostResult.value !== null) {
    devpostCount = devpostResult.value;
  } else if (latestHistoryPoint) {
    stale = true;
    warnings.push("Devpost is using the most recent saved snapshot.");
  } else {
    warnings.push("Devpost did not refresh on the latest check.");
  }

  if (devpostResult.status === "rejected") {
    console.error("Failed to refresh Devpost data:", devpostResult.reason);
  } else if (devpostResult.status === "fulfilled" && devpostResult.value === null) {
    console.error("Devpost participant count could not be parsed.");
    warnings.push("Devpost loaded, but the participant count could not be parsed.");
  }

  if (sheetResult.status === "fulfilled") {
    sheetHeaders = sheetResult.value.headers;
    sheetRows = sheetResult.value.rows;
    sheetTeamCount = countSheetTeams(sheetRows);
    googleFormCount = countSheetParticipants(sheetRows, sheetHeaders);
  } else if (latestHistoryPoint) {
    stale = true;
    warnings.push("Google Form is using the most recent saved snapshot.");
  } else {
    console.error("Failed to refresh Google Sheet data:", sheetResult.reason);
    warnings.push("Google Sheet did not refresh on the latest check.");
  }

  const totalParticipants = (devpostCount ?? 0) + googleFormCount;
  const hasFreshSnapshot =
    devpostResult.status === "fulfilled" &&
    devpostResult.value !== null &&
    sheetResult.status === "fulfilled";

  const nextHistory = hasFreshSnapshot
    ? await upsertDashboardHistory({
        date: getHistoryDateKey(),
        devpostCount: devpostCount ?? 0,
        googleFormCount,
        totalParticipants,
        sheetTeamCount,
        updatedAt: fetchedAt,
      })
    : history;

  if (!hasFreshSnapshot && !latestHistoryPoint && devpostCount === null && googleFormCount === 0) {
    return NextResponse.json(
      {
        error: "Failed to refresh dashboard data.",
        warnings,
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  const responseBody: DashboardSnapshot = {
    devpostCount,
    googleFormCount,
    sheetHeaders,
    sheetRows,
    sheetTeamCount,
    totalParticipants,
    fetchedAt: hasFreshSnapshot ? fetchedAt : latestHistoryPoint?.updatedAt ?? fetchedAt,
    warnings,
    history: nextHistory,
    stale,
  };

  return NextResponse.json(
    responseBody,
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
