"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import ProgressChart from "@/app/components/ProgressChart";
import type {
  DashboardHistoryPoint,
  DashboardSnapshot,
  SheetRow,
} from "@/lib/dashboard-types";

const DEVPOST_URL = "https://innospark-competition.devpost.com/";
const REFRESH_INTERVAL = 30_000;

interface DashboardErrorResponse {
  error?: string;
}

function formatCount(value: number | string): string {
  if (typeof value === "string") {
    return value;
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getPreviousHistoryPoint(
  history: DashboardHistoryPoint[]
): DashboardHistoryPoint | null {
  if (history.length <= 1) {
    return null;
  }

  return history.at(-2) ?? null;
}

function getDelta(current: number, previous: number | null): number | null {
  if (previous === null) {
    return null;
  }

  return current - previous;
}

function formatDelta(current: number, previous: number | null): string {
  const delta = getDelta(current, previous);

  if (delta === null) {
    return "Baseline";
  }

  if (delta === 0) {
    return "Flat";
  }

  return `${delta > 0 ? "+" : ""}${formatCount(delta)}`;
}

function getDeltaTone(
  current: number,
  previous: number | null
): "positive" | "negative" | "neutral" {
  const delta = getDelta(current, previous);

  if (delta === null || delta === 0) {
    return "neutral";
  }

  return delta > 0 ? "positive" : "negative";
}

function getTrendNote(previousPoint: DashboardHistoryPoint | null): string {
  if (!previousPoint) {
    return "First recorded day";
  }

  return `vs ${formatDay(previousPoint.date)}`;
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedDataRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const fetchDashboard = useEffectEvent(async (initialLoad = false) => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setError(null);

    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
      });
      const data = (await response.json()) as
        | DashboardSnapshot
        | DashboardErrorResponse;

      if (!response.ok) {
        const message =
          "error" in data && data.error
            ? data.error
            : "Failed to refresh dashboard data.";
        throw new Error(message);
      }

      setSnapshot(data as DashboardSnapshot);
      hasLoadedDataRef.current = true;
    } catch (fetchError) {
      console.error("Failed to refresh dashboard data:", fetchError);
      setError(
        hasLoadedDataRef.current
          ? "Live refresh failed. Showing the last successful view."
          : "Failed to load dashboard data."
      );
    } finally {
      isRefreshingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  });

  useEffect(() => {
    void fetchDashboard(true);
    const interval = window.setInterval(() => {
      void fetchDashboard();
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const history = snapshot?.history ?? [];
  const previousPoint = getPreviousHistoryPoint(history);
  const trendNote = getTrendNote(previousPoint);
  const firstRecordedPoint = history[0] ?? null;

  return (
    <main className="relative mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      {error && (
        <div className="mb-6 rounded-[28px] border border-red-500/20 bg-red-500/8 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      )}

      {snapshot?.warnings.length ? (
        <div className="mb-6 rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,248,236,0.78)] px-5 py-4 text-sm text-[var(--muted-strong)]">
          {snapshot.warnings.join(" ")}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-[34px] border border-[var(--border-soft)] bg-[var(--panel)]">
          <div className="h-14 w-14 animate-spin rounded-full border-2 border-[var(--accent-soft)] border-t-[var(--accent)]" />
        </div>
      ) : !snapshot ? (
        <div className="rounded-[34px] border border-[var(--border-soft)] bg-[var(--panel)] px-6 py-16 text-center">
          <p className="dashboard-display text-4xl text-[var(--ink)]">
            Dashboard data is unavailable.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
            The live sources could not be reached on the latest attempt. Refresh
            again to retry the snapshot.
          </p>
          <button
            type="button"
            onClick={() => void fetchDashboard(true)}
            className="mt-8 rounded-full border border-[var(--border-strong)] bg-[var(--ink)] px-5 py-2 text-xs tracking-[0.18em] text-[var(--paper)] uppercase"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.34fr_0.76fr]">
            <div className="dashboard-panel rounded-[34px] p-5 sm:p-6 lg:p-8">
              <ProgressChart history={history} />
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-[var(--muted-strong)]">
                <StatusPill label={refreshing ? "Refreshing" : "Live sync active"} />
                <StatusPill label="Updates every 30s" />
                <StatusPill label={`Last updated ${formatTimestamp(snapshot.fetchedAt)}`} />
                {snapshot.stale && (
                  <StatusPill label="Using saved snapshot" muted={false} />
                )}
              </div>
            </div>

            <aside className="dashboard-panel-dark rounded-[34px] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="dashboard-mono text-[11px] text-[#c9bfaf]">
                    Participant Count
                  </p>
                  <h1 className="dashboard-display mt-5 text-[clamp(4.2rem,8vw,6.4rem)] leading-none text-[#f8f1e5]">
                    {formatCount(snapshot.totalParticipants)}
                  </h1>
                  <p
                    className={`mt-4 text-sm ${
                      getDeltaTone(
                        snapshot.totalParticipants,
                        previousPoint?.totalParticipants ?? null
                      ) === "positive"
                        ? "text-[#f0d5bc]"
                        : "text-[#bdb19f]"
                    }`}
                  >
                    {formatDelta(
                      snapshot.totalParticipants,
                      previousPoint?.totalParticipants ?? null
                    )}{" "}
                    {trendNote}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void fetchDashboard()}
                  disabled={refreshing}
                  className="rounded-full border border-[#f0e6d7]/20 bg-[#f5ecde]/8 px-4 py-2 text-xs font-medium tracking-[0.18em] text-[#f5ede1] uppercase transition hover:bg-[#f5ecde]/14 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-8 grid gap-3">
                <ParticipantStat
                  label="Total participants"
                  value={snapshot.totalParticipants}
                  delta={formatDelta(
                    snapshot.totalParticipants,
                    previousPoint?.totalParticipants ?? null
                  )}
                  tone={getDeltaTone(
                    snapshot.totalParticipants,
                    previousPoint?.totalParticipants ?? null
                  )}
                  note={trendNote}
                />
                <ParticipantStat
                  label="Devpost"
                  value={snapshot.devpostCount ?? 0}
                  delta={formatDelta(
                    snapshot.devpostCount ?? 0,
                    previousPoint?.devpostCount ?? null
                  )}
                  tone={getDeltaTone(
                    snapshot.devpostCount ?? 0,
                    previousPoint?.devpostCount ?? null
                  )}
                  note={trendNote}
                  link={DEVPOST_URL}
                />
                <ParticipantStat
                  label="Google Form"
                  value={snapshot.googleFormCount}
                  delta={formatDelta(
                    snapshot.googleFormCount,
                    previousPoint?.googleFormCount ?? null
                  )}
                  tone={getDeltaTone(
                    snapshot.googleFormCount,
                    previousPoint?.googleFormCount ?? null
                  )}
                  note={trendNote}
                />
                <ParticipantStat
                  label="Teams submitted"
                  value={snapshot.sheetTeamCount}
                  delta={formatDelta(
                    snapshot.sheetTeamCount,
                    previousPoint?.sheetTeamCount ?? null
                  )}
                  tone={getDeltaTone(
                    snapshot.sheetTeamCount,
                    previousPoint?.sheetTeamCount ?? null
                  )}
                  note={trendNote}
                />
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <MiniMeta
                  label="Tracking since"
                  value={
                    firstRecordedPoint ? formatDay(firstRecordedPoint.date) : "Today"
                  }
                />
                <MiniMeta
                  label="Snapshot time"
                  value={formatTimestamp(snapshot.fetchedAt)}
                />
              </div>
            </aside>
          </section>

          <section className="dashboard-panel mt-6 rounded-[34px] p-5 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="dashboard-mono text-[11px] text-[var(--muted)]">
                  Submission Log
                </p>
                <h2 className="dashboard-display mt-3 text-4xl leading-none text-[var(--ink)]">
                  Google Form responses
                </h2>
              </div>
              <div className="text-sm text-[var(--muted)]">
                {snapshot.sheetTeamCount} teams · {snapshot.googleFormCount} participants
              </div>
            </div>

            {snapshot.sheetRows.length > 0 ? (
              <div className="mt-8 overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel-strong)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[var(--border-soft)] bg-[rgba(28,23,19,0.04)] text-[var(--muted)]">
                      <tr>
                        <th className="dashboard-mono px-5 py-4 text-[10px]">#</th>
                        {snapshot.sheetHeaders.map((header) => (
                          <th
                            key={header}
                            className="dashboard-mono px-5 py-4 text-[10px]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.sheetRows.map((row, index) => (
                        <SubmissionRow
                          key={`${index}-${row[snapshot.sheetHeaders[0]] ?? "row"}`}
                          index={index}
                          row={row}
                          headers={snapshot.sheetHeaders}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[rgba(255,251,244,0.42)] px-6 py-12 text-center text-sm leading-7 text-[var(--muted)]">
                No Google Form rows are available in the current snapshot.
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StatusPill({
  label,
  muted = true,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        muted
          ? "border-[var(--border-soft)] bg-[rgba(255,252,245,0.8)]"
          : "border-[rgba(169,90,46,0.22)] bg-[rgba(169,90,46,0.08)]"
      }`}
    >
      {label}
    </span>
  );
}

function ParticipantStat({
  label,
  value,
  delta,
  tone,
  note,
  link,
}: {
  label: string;
  value: number;
  delta: string;
  tone: "positive" | "negative" | "neutral";
  note: string;
  link?: string;
}) {
  const content = (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="dashboard-mono text-[10px] text-[#c9bfaf]">{label}</p>
          <p className="dashboard-display mt-3 text-4xl leading-none text-[#f8f1e5]">
            {formatCount(value)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            tone === "positive"
              ? "bg-[rgba(216,168,134,0.14)] text-[#f0d5bc]"
              : tone === "negative"
                ? "bg-[rgba(170,72,54,0.18)] text-[#f4c3b8]"
                : "bg-white/[0.06] text-[#d0c4b3]"
          }`}
        >
          {delta}
        </span>
      </div>
      <p className="mt-3 text-xs text-[#bdb19f]">{note}</p>
    </div>
  );

  if (!link) {
    return content;
  }

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="dashboard-mono text-[10px] text-[#c9bfaf]">{label}</p>
      <p className="mt-3 text-sm text-[#f4ecdf]">{value}</p>
    </div>
  );
}

function SubmissionRow({
  headers,
  index,
  row,
}: {
  headers: string[];
  index: number;
  row: SheetRow;
}) {
  return (
    <tr className="border-t border-[var(--border-soft)] align-top">
      <td className="px-5 py-4 text-[var(--muted)]">{index + 1}</td>
      {headers.map((header) => (
        <td key={header} className="px-5 py-4 text-[var(--muted-strong)]">
          {row[header] || "—"}
        </td>
      ))}
    </tr>
  );
}
