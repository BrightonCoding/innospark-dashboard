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

function formatDelta(current: number, previous: number | null): string {
  if (previous === null) {
    return "New baseline";
  }

  const delta = current - previous;
  if (delta === 0) {
    return "No change";
  }

  return `${delta > 0 ? "+" : ""}${formatCount(delta)}`;
}

function getWeeklyGain(history: DashboardHistoryPoint[]): number {
  if (history.length <= 1) {
    return 0;
  }

  const recentWindow = history.slice(-7);
  const firstPoint = recentWindow[0];
  const lastPoint = recentWindow.at(-1) ?? firstPoint;
  return lastPoint.totalParticipants - firstPoint.totalParticipants;
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
  const latestPoint = history.at(-1) ?? null;
  const weeklyGain = getWeeklyGain(history);
  const firstRecordedPoint = history[0] ?? null;
  const sourceShare =
    snapshot && snapshot.totalParticipants > 0
      ? Math.round((snapshot.devpostCount ?? 0) / snapshot.totalParticipants * 100)
      : 0;

  return (
    <main className="relative mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
        <section className="dashboard-panel rounded-[34px] p-6 sm:p-8 lg:p-10">
          <span className="dashboard-mono inline-flex rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] text-[var(--paper)]">
            Live dashboard
          </span>
          <h1 className="dashboard-display mt-8 max-w-4xl text-[clamp(3.3rem,8vw,6.8rem)] leading-[0.9] text-[var(--ink)]">
            Participant growth, tracked daily.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--muted)] sm:text-base">
            A clean operating view of Devpost registrations and Google Form
            submissions for the INNOSpark Pitch Competition. The line updates as
            each day records a new snapshot.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-strong)]">
            <StatusPill label={refreshing ? "Refreshing" : "Live sync active"} />
            <StatusPill label="Refreshes every 30s" />
            {snapshot && (
              <StatusPill label={`Last updated ${formatTimestamp(snapshot.fetchedAt)}`} />
            )}
            {snapshot?.stale && <StatusPill label="Using saved snapshot" muted={false} />}
          </div>
        </section>

        <aside className="dashboard-panel-dark rounded-[34px] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="dashboard-mono text-[11px] text-[#c9bfaf]">
                Pulse Check
              </p>
              <h2 className="dashboard-display mt-3 text-4xl leading-none text-[#f8f1e5]">
                {formatCount(snapshot?.totalParticipants ?? 0)}
              </h2>
              <p className="mt-2 text-sm text-[#bdb19f]">
                Total participants on record
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

          <dl className="mt-8 space-y-4 text-sm text-[#c9bfaf]">
            <MetricRow
              label="Devpost share"
              value={`${sourceShare}%`}
            />
            <MetricRow
              label="7 day gain"
              value={
                weeklyGain === 0 ? "Flat" : `${weeklyGain > 0 ? "+" : ""}${formatCount(weeklyGain)}`
              }
            />
            <MetricRow
              label="First recorded"
              value={firstRecordedPoint ? formatDay(firstRecordedPoint.date) : "Pending"}
            />
            <MetricRow
              label="Latest snapshot"
              value={latestPoint ? formatDay(latestPoint.date) : "Pending"}
            />
          </dl>
        </aside>
      </div>

      {error && (
        <div className="mt-6 rounded-[28px] border border-red-500/20 bg-red-500/8 px-5 py-4 text-sm text-red-900">
          {error}
        </div>
      )}

      {snapshot?.warnings.length ? (
        <div className="mt-6 rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,248,236,0.78)] px-5 py-4 text-sm text-[var(--muted-strong)]">
          {snapshot.warnings.join(" ")}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="mt-8 flex min-h-[420px] items-center justify-center rounded-[34px] border border-[var(--border-soft)] bg-[var(--panel)]">
          <div className="h-14 w-14 animate-spin rounded-full border-2 border-[var(--accent-soft)] border-t-[var(--accent)]" />
        </div>
      ) : !snapshot ? (
        <div className="mt-8 rounded-[34px] border border-[var(--border-soft)] bg-[var(--panel)] px-6 py-16 text-center">
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
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Participants"
              value={snapshot.totalParticipants}
              note={formatDelta(snapshot.totalParticipants, previousPoint?.totalParticipants ?? null)}
              tone="dark"
            />
            <MetricCard
              label="Devpost"
              value={snapshot.devpostCount ?? "—"}
              note={formatDelta(snapshot.devpostCount ?? 0, previousPoint?.devpostCount ?? null)}
              link={DEVPOST_URL}
            />
            <MetricCard
              label="Google Form"
              value={snapshot.googleFormCount}
              note={formatDelta(snapshot.googleFormCount, previousPoint?.googleFormCount ?? null)}
            />
            <MetricCard
              label="Teams Submitted"
              value={snapshot.sheetTeamCount}
              note={formatDelta(snapshot.sheetTeamCount, previousPoint?.sheetTeamCount ?? null)}
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="dashboard-panel rounded-[34px] p-5 sm:p-6 lg:p-8">
              <ProgressChart history={history} />
            </div>

            <aside className="dashboard-panel rounded-[34px] p-6 sm:p-8">
              <p className="dashboard-mono text-[11px] text-[var(--muted)]">
                Snapshot Summary
              </p>
              <h3 className="dashboard-display mt-3 text-4xl leading-none text-[var(--ink)]">
                Where growth is coming from
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                A daily read on the participant mix. The chart tracks overall
                momentum while the split below shows how much of the total is
                being driven by Devpost versus the Google Form.
              </p>

              <div className="mt-8 space-y-6">
                <SourceBar
                  label="Devpost"
                  value={snapshot.devpostCount ?? 0}
                  total={snapshot.totalParticipants}
                  color="var(--accent)"
                />
                <SourceBar
                  label="Google Form"
                  value={snapshot.googleFormCount}
                  total={snapshot.totalParticipants}
                  color="var(--sage)"
                />
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <InsightCard
                  label="Recorded span"
                  value={
                    firstRecordedPoint && latestPoint
                      ? `${formatDay(firstRecordedPoint.date)} - ${formatDay(latestPoint.date)}`
                      : "Starts today"
                  }
                />
                <InsightCard
                  label="Net gain"
                  value={
                    firstRecordedPoint
                      ? `${firstRecordedPoint.totalParticipants === snapshot.totalParticipants ? "" : "+"}${formatCount(
                          snapshot.totalParticipants - firstRecordedPoint.totalParticipants
                        )}`
                      : formatCount(snapshot.totalParticipants)
                  }
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
                <h3 className="dashboard-display mt-3 text-4xl leading-none text-[var(--ink)]">
                  Google Form responses
                </h3>
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <dt>{label}</dt>
      <dd className="text-right text-[#f7f2e7]">{value}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "light",
  link,
}: {
  label: string;
  value: number | string;
  note: string;
  tone?: "dark" | "light";
  link?: string;
}) {
  const card = (
    <div
      className={
        tone === "dark"
          ? "dashboard-panel-dark rounded-[28px] p-6"
          : "dashboard-panel rounded-[28px] p-6"
      }
    >
      <p
        className={`dashboard-mono text-[11px] ${
          tone === "dark" ? "text-[#c9bfaf]" : "text-[var(--muted)]"
        }`}
      >
        {label}
      </p>
      <p
        className={`dashboard-display mt-5 text-5xl leading-none ${
          tone === "dark" ? "text-[#f8f1e5]" : "text-[var(--ink)]"
        }`}
      >
        {formatCount(value)}
      </p>
      <p
        className={`mt-4 text-sm ${
          tone === "dark" ? "text-[#bdb19f]" : "text-[var(--muted)]"
        }`}
      >
        {note} vs previous day
      </p>
    </div>
  );

  if (!link) {
    return card;
  }

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  );
}

function SourceBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.max((value / total) * 100, 0) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--muted-strong)]">{label}</p>
        <p className="text-sm text-[var(--muted)]">
          {formatCount(value)} · {Math.round(percentage)}%
        </p>
      </div>
      <div className="mt-3 h-3 rounded-full bg-[rgba(23,20,17,0.08)]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(255,252,245,0.72)] p-5">
      <p className="dashboard-mono text-[10px] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">{value}</p>
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
