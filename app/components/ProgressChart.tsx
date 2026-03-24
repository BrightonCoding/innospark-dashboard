"use client";

import { useEffect, useState } from "react";
import { getDateDifferenceInDays } from "@/lib/dashboard-trends";
import type {
  DashboardHistoryPoint,
  DashboardSubmissionTrendPoint,
} from "@/lib/dashboard-types";

const CHART_WIDTH = 1120;
const CHART_HEIGHT = 430;
const PADDING = { top: 52, right: 34, bottom: 58, left: 46 };

const HISTORY_CHART_WIDTH = 960;
const HISTORY_CHART_HEIGHT = 340;
const HISTORY_PADDING = { top: 24, right: 24, bottom: 48, left: 18 };
const HISTORY_VISIBLE_POINTS = 14;

interface ProgressChartProps {
  history: DashboardHistoryPoint[];
  submissionTrend: DashboardSubmissionTrendPoint[];
  googleFormCount: number;
  sheetTeamCount: number;
  devpostCount: number | null;
  devpostStartDate: string | null;
  devpostDeadline: string | null;
}

interface ChartSeries {
  color: string;
  key: string;
  label: string;
  strokeWidth: number;
  values: number[];
}

interface ChartPoint {
  x: number;
  y: number;
}

function formatCompactValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function buildPolyline(points: ChartPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function buildAreaPath(points: ChartPoint[], chartBottom: number): string {
  if (points.length === 0) {
    return "";
  }

  const firstPoint = points[0];
  const lastPoint = points.at(-1) ?? firstPoint;

  return [
    `M ${firstPoint.x} ${chartBottom}`,
    `L ${firstPoint.x} ${firstPoint.y}`,
    ...points.slice(1).map((point) => `L ${point.x} ${point.y}`),
    `L ${lastPoint.x} ${chartBottom}`,
    "Z",
  ].join(" ");
}

function roundUpForAxis(value: number): number {
  if (value <= 10) {
    return 10;
  }

  if (value <= 50) {
    return Math.ceil(value / 5) * 5;
  }

  if (value <= 100) {
    return Math.ceil(value / 10) * 10;
  }

  return Math.ceil(value / 25) * 25;
}

function getDateKeyFromIso(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate.toISOString().slice(0, 10);
}

function getDateTicks(
  startDateKey: string,
  endDateKey: string,
  count: number
): string[] {
  const totalDays = Math.max(getDateDifferenceInDays(startDateKey, endDateKey), 1);
  const ticks = new Set<string>([startDateKey, endDateKey]);

  Array.from({ length: count }).forEach((_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    ticks.add(addDays(startDateKey, Math.round(totalDays * ratio)));
  });

  return [...ticks].sort((left, right) => left.localeCompare(right));
}

function getLegendDotStyle(color: string) {
  return {
    background:
      color === "window"
        ? "linear-gradient(180deg, rgba(169, 90, 46, 0.22) 0%, rgba(169, 90, 46, 0.02) 100%)"
        : color,
  };
}

export default function ProgressChart({
  history,
  submissionTrend,
  googleFormCount,
  sheetTeamCount,
  devpostCount,
  devpostStartDate,
  devpostDeadline,
}: ProgressChartProps) {
  const [isAnimated, setIsAnimated] = useState(false);
  const animationKey = [
    submissionTrend
      .map(
        (point) =>
          `${point.date}:${point.dailyParticipantCount}:${point.dailyTeamCount}:${point.cumulativeParticipantCount}`
      )
      .join("|"),
    history
      .map(
        (point) =>
          `${point.date}:${point.totalParticipants}:${point.devpostCount}:${point.googleFormCount}`
      )
      .join("|"),
    googleFormCount,
    sheetTeamCount,
    devpostCount ?? "na",
    devpostStartDate ?? "na",
    devpostDeadline ?? "na",
  ].join("|");

  useEffect(() => {
    setIsAnimated(false);

    const frame = window.requestAnimationFrame(() => {
      setIsAnimated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [animationKey]);

  if (submissionTrend.length > 1) {
    return (
      <SubmissionTrendChart
        history={history}
        submissionTrend={submissionTrend}
        googleFormCount={googleFormCount}
        sheetTeamCount={sheetTeamCount}
        devpostCount={devpostCount}
        devpostStartDate={devpostStartDate}
        devpostDeadline={devpostDeadline}
        isAnimated={isAnimated}
      />
    );
  }

  return <LegacyHistoryChart history={history} isAnimated={isAnimated} />;
}

function SubmissionTrendChart({
  history,
  submissionTrend,
  googleFormCount,
  sheetTeamCount,
  devpostCount,
  devpostStartDate,
  devpostDeadline,
  isAnimated,
}: {
  history: DashboardHistoryPoint[];
  submissionTrend: DashboardSubmissionTrendPoint[];
  googleFormCount: number;
  sheetTeamCount: number;
  devpostCount: number | null;
  devpostStartDate: string | null;
  devpostDeadline: string | null;
  isAnimated: boolean;
}) {
  const devpostStartDateKey = getDateKeyFromIso(devpostStartDate);
  const devpostDeadlineKey = getDateKeyFromIso(devpostDeadline);
  const firstPoint = submissionTrend[0];
  const lastPoint = submissionTrend.at(-1) ?? firstPoint;
  const latestRecordedTotalPoint = history.at(-1) ?? null;
  const latestRecordedDateKey = latestRecordedTotalPoint?.date ?? null;
  const domainStartKey =
    devpostStartDateKey && devpostStartDateKey < firstPoint.date
      ? devpostStartDateKey
      : firstPoint.date;
  const domainEndKey =
    devpostDeadlineKey && devpostDeadlineKey > lastPoint.date
      ? devpostDeadlineKey
      : lastPoint.date;
  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const totalDomainDays = Math.max(
    getDateDifferenceInDays(domainStartKey, domainEndKey),
    1
  );

  const getXForDate = (dateKey: string) =>
    PADDING.left +
    (Math.max(getDateDifferenceInDays(domainStartKey, dateKey), 0) / totalDomainDays) *
      chartWidth;

  const getCumulativeParticipantCountForDate = (dateKey: string) => {
    let cumulativeParticipantCount = 0;

    for (const point of submissionTrend) {
      if (point.date > dateKey) {
        break;
      }

      cumulativeParticipantCount = point.cumulativeParticipantCount;
    }

    return cumulativeParticipantCount;
  };

  const latestDisplayedFormDateKey =
    latestRecordedDateKey && latestRecordedDateKey > lastPoint.date
      ? latestRecordedDateKey
      : lastPoint.date;
  const latestDisplayedFormCount = getCumulativeParticipantCountForDate(
    latestDisplayedFormDateKey
  );
  const maxCumulativeValue = roundUpForAxis(
    Math.max(
      latestDisplayedFormCount,
      lastPoint.cumulativeParticipantCount,
      latestRecordedTotalPoint?.totalParticipants ?? 0,
      googleFormCount + (devpostCount ?? 0),
      4
    )
  );
  const maxDailyTeamCount = Math.max(
    ...submissionTrend.map((point) => point.dailyTeamCount),
    1
  );
  const chartBottom = CHART_HEIGHT - PADDING.bottom;
  const getYForValue = (value: number) =>
    PADDING.top +
    ((maxCumulativeValue - value) / maxCumulativeValue) * chartHeight;

  const annotatedPoints = submissionTrend.map((point) => {
    const x = getXForDate(point.date);
    const y = getYForValue(point.cumulativeParticipantCount);
    const barHeight = (point.dailyTeamCount / maxDailyTeamCount) * (chartHeight * 0.34);

    return {
      ...point,
      x,
      y,
      barHeight,
    };
  });
  const lineCoordinates = annotatedPoints.map((point) => ({
    x: point.x,
    y: point.y,
  }));
  if (latestDisplayedFormDateKey > lastPoint.date) {
    lineCoordinates.push({
      x: getXForDate(latestDisplayedFormDateKey),
      y: getYForValue(latestDisplayedFormCount),
    });
  }

  const recordedTotalCoordinates = history.map((point) => ({
    x: getXForDate(point.date),
    y: getYForValue(point.totalParticipants),
    formBaselineY: getYForValue(getCumulativeParticipantCountForDate(point.date)),
    totalParticipants: point.totalParticipants,
    devpostCount: point.devpostCount,
    date: point.date,
  }));
  const lastCoordinate = lineCoordinates.at(-1) ?? lineCoordinates[0];
  const latestRecordedCoordinate =
    recordedTotalCoordinates.at(-1) ?? null;
  const gridValues = Array.from({ length: 5 }, (_, index) =>
    Math.round(maxCumulativeValue - (index / 4) * maxCumulativeValue)
  );
  const tickDates = getDateTicks(
    domainStartKey,
    domainEndKey,
    devpostDeadlineKey && devpostDeadlineKey > lastPoint.date ? 6 : 5
  );
  const peakDay = submissionTrend.reduce((peak, point) => {
    if (point.dailyTeamCount > peak.dailyTeamCount) {
      return point;
    }

    return peak;
  }, submissionTrend[0]);
  const futureRegionStartX =
    devpostDeadlineKey && devpostDeadlineKey > latestDisplayedFormDateKey
      ? lastCoordinate.x
      : null;
  const futureRegionWidth =
    futureRegionStartX !== null
      ? PADDING.left + chartWidth - futureRegionStartX
      : 0;
  const milestoneLines = [
    {
      color: "rgba(77, 98, 88, 0.42)",
      dateKey: devpostStartDateKey,
      label: "Devpost opens",
    },
    {
      color: "rgba(169, 90, 46, 0.34)",
      dateKey: devpostDeadlineKey,
      label: "Deadline",
    },
  ].filter(
    (milestone): milestone is {
      color: string;
      dateKey: string;
      label: string;
    } =>
      Boolean(
        milestone.dateKey &&
          milestone.dateKey >= domainStartKey &&
          milestone.dateKey <= domainEndKey
      )
  );
  const barWidth = Math.max(
    Math.min(chartWidth / Math.max(totalDomainDays + 1, submissionTrend.length) * 0.72, 18),
    8
  );
  const currentWindowLabel =
    devpostStartDateKey && devpostDeadlineKey
      ? `${formatDayLabel(devpostStartDateKey)} - ${formatDayLabel(devpostDeadlineKey)}`
      : devpostDeadlineKey
        ? `Through ${formatDayLabel(devpostDeadlineKey)}`
        : formatDayLabel(lastPoint.date);
  const liveTotalParticipants =
    latestRecordedTotalPoint?.totalParticipants ??
    latestDisplayedFormCount + (devpostCount ?? 0);
  const devpostContribution =
    latestRecordedTotalPoint?.devpostCount ?? devpostCount ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="dashboard-mono text-[11px] text-[var(--muted)]">
            Submission Momentum
          </p>
          <h3 className="dashboard-display mt-2 text-3xl leading-none text-[var(--ink)] md:text-4xl">
            Form growth with live Devpost overlay
          </h3>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            The main curve follows real Google Form submission dates. The dashed
            overlay shows recorded total participants including Devpost on saved
            snapshots, and the endpoint stack shows the live Devpost contribution.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <LegendItem color="var(--ink)" label="Form cumulative" />
          <LegendItem color="var(--sage)" label="Recorded total incl. Devpost" />
          <LegendItem color="rgba(169, 90, 46, 0.18)" label="Daily team submissions" />
          <LegendItem color="window" label="Devpost timeline" />
        </div>
      </div>

      <div className="overflow-hidden rounded-[30px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,253,249,0.95)_0%,rgba(249,242,230,0.9)_100%)] p-4 shadow-[0_28px_90px_rgba(38,28,16,0.08)] md:p-6">
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <TrendCallout
            label="Form participants"
            value={formatCompactValue(latestDisplayedFormCount)}
            note={`${formatCompactValue(sheetTeamCount)} teams submitted so far`}
          />
          <TrendCallout
            label="Live total now"
            value={formatCompactValue(liveTotalParticipants)}
            note={
              devpostContribution > 0
                ? `${formatCompactValue(devpostContribution)} from Devpost as of ${formatDayLabel(latestRecordedDateKey ?? latestDisplayedFormDateKey)}`
                : `Devpost window ${currentWindowLabel}`
            }
          />
          <TrendCallout
            label="Peak submission day"
            value={`${formatCompactValue(peakDay.dailyTeamCount)} teams`}
            note={`${formatCompactValue(peakDay.dailyParticipantCount)} participants on ${formatDayLabel(peakDay.date)}`}
          />
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-[360px] w-full overflow-visible"
          role="img"
          aria-label="Submission growth chart based on Google Form timestamps"
        >
          <defs>
            <linearGradient id="submission-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(23, 20, 17, 0.18)" />
              <stop offset="100%" stopColor="rgba(23, 20, 17, 0)" />
            </linearGradient>
            <linearGradient id="submission-bars" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(169, 90, 46, 0.24)" />
              <stop offset="100%" stopColor="rgba(169, 90, 46, 0.04)" />
            </linearGradient>
            <linearGradient id="future-window" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(169, 90, 46, 0.08)" />
              <stop offset="100%" stopColor="rgba(169, 90, 46, 0.01)" />
            </linearGradient>
            <linearGradient id="devpost-stack" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(77, 98, 88, 0.44)" />
              <stop offset="100%" stopColor="rgba(77, 98, 88, 0.12)" />
            </linearGradient>
            <radialGradient id="endpoint-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(169, 90, 46, 0.34)" />
              <stop offset="100%" stopColor="rgba(169, 90, 46, 0)" />
            </radialGradient>
          </defs>

          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={chartWidth}
            height={chartHeight}
            rx="28"
            fill="rgba(255, 252, 245, 0.72)"
          />

          {futureRegionStartX !== null && futureRegionWidth > 0 && (
            <rect
              x={futureRegionStartX}
              y={PADDING.top}
              width={futureRegionWidth}
              height={chartHeight}
              fill="url(#future-window)"
            />
          )}

          {gridValues.map((value) => {
            const y =
              PADDING.top +
              ((maxCumulativeValue - value) / maxCumulativeValue) * chartHeight;

            return (
              <g key={value}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(27, 24, 20, 0.1)"
                  strokeDasharray="4 8"
                />
                <text
                  x={PADDING.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(61, 53, 43, 0.7)"
                  fontSize="12"
                >
                  {formatCompactValue(value)}
                </text>
              </g>
            );
          })}

          {milestoneLines.map((milestone) => {
            const x =
              PADDING.left +
              (Math.max(getDateDifferenceInDays(domainStartKey, milestone.dateKey), 0) /
                totalDomainDays) *
                chartWidth;

            return (
              <g key={milestone.label}>
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={chartBottom}
                  stroke={milestone.color}
                  strokeDasharray="6 10"
                />
                <text
                  x={x}
                  y={PADDING.top - 14}
                  textAnchor={
                    x < PADDING.left + 96
                      ? "start"
                      : x > CHART_WIDTH - PADDING.right - 96
                        ? "end"
                        : "middle"
                  }
                  fill="rgba(61, 53, 43, 0.82)"
                  fontSize="12"
                >
                  {milestone.label}
                </text>
              </g>
            );
          })}

          {annotatedPoints.map((point) => (
            <rect
              key={`${point.date}-bar`}
              x={point.x - barWidth / 2}
              y={chartBottom - point.barHeight}
              width={barWidth}
              height={point.barHeight}
              rx={Math.min(barWidth / 2, 10)}
              fill="url(#submission-bars)"
              style={{
                opacity: isAnimated ? 1 : 0,
                transformOrigin: `${point.x}px ${chartBottom}px`,
                transform: isAnimated ? "scaleY(1)" : "scaleY(0.25)",
                transition:
                  "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 700ms ease",
              }}
            />
          ))}

          <path
            d={buildAreaPath(lineCoordinates, chartBottom)}
            fill="url(#submission-area)"
            style={{
              opacity: isAnimated ? 1 : 0,
              transition: "opacity 700ms ease",
            }}
          />

          <polyline
            points={buildPolyline(lineCoordinates)}
            fill="none"
            stroke="var(--ink)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            style={{
              opacity: isAnimated ? 1 : 0,
              strokeDasharray: isAnimated ? undefined : "0 999",
              transition: "opacity 700ms ease",
            }}
          />

          {recordedTotalCoordinates.length > 1 && (
            <polyline
              points={buildPolyline(recordedTotalCoordinates)}
              fill="none"
              stroke="var(--sage)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              strokeDasharray="8 10"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          )}

          {recordedTotalCoordinates.map((point, index) => (
            <circle
              key={`${point.date}-recorded-total`}
              cx={point.x}
              cy={point.y}
              r={index === recordedTotalCoordinates.length - 1 ? 6.5 : 4}
              fill="var(--sage)"
              stroke="rgba(255, 252, 245, 0.96)"
              strokeWidth="3"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          ))}

          {latestRecordedCoordinate &&
            latestRecordedCoordinate.formBaselineY > latestRecordedCoordinate.y && (
              <>
                <rect
                  x={latestRecordedCoordinate.x - 6}
                  y={latestRecordedCoordinate.y}
                  width={12}
                  height={
                    latestRecordedCoordinate.formBaselineY - latestRecordedCoordinate.y
                  }
                  rx={6}
                  fill="url(#devpost-stack)"
                  style={{
                    opacity: isAnimated ? 1 : 0,
                    transition: "opacity 700ms ease",
                  }}
                />
                <text
                  x={
                    latestRecordedCoordinate.x > CHART_WIDTH - PADDING.right - 140
                      ? latestRecordedCoordinate.x - 16
                      : latestRecordedCoordinate.x + 16
                  }
                  y={latestRecordedCoordinate.y + 18}
                  textAnchor={
                    latestRecordedCoordinate.x > CHART_WIDTH - PADDING.right - 140
                      ? "end"
                      : "start"
                  }
                  fill="rgba(77, 98, 88, 0.9)"
                  fontSize="12"
                >
                  +{formatCompactValue(latestRecordedCoordinate.devpostCount)} Devpost
                </text>
              </>
            )}

          {lastCoordinate && (
            <>
              <line
                x1={lastCoordinate.x}
                x2={lastCoordinate.x}
                y1={PADDING.top}
                y2={chartBottom}
                stroke="rgba(23, 20, 17, 0.18)"
                strokeDasharray="4 10"
              />
              <circle
                cx={lastCoordinate.x}
                cy={lastCoordinate.y}
                r="26"
                fill="url(#endpoint-glow)"
              />
              <circle
                cx={lastCoordinate.x}
                cy={lastCoordinate.y}
                r="7.5"
                fill="var(--accent)"
                stroke="rgba(255, 252, 245, 0.96)"
                strokeWidth="3"
              />
              <text
                x={
                  lastCoordinate.x > CHART_WIDTH - PADDING.right - 120
                    ? lastCoordinate.x - 14
                    : lastCoordinate.x + 14
                }
                y={lastCoordinate.y - 16}
                textAnchor={
                  lastCoordinate.x > CHART_WIDTH - PADDING.right - 120
                    ? "end"
                    : "start"
                }
                fill="rgba(23, 20, 17, 0.86)"
                fontSize="12"
              >
                {formatCompactValue(latestDisplayedFormCount)} form participants
              </text>
            </>
          )}

          {tickDates.map((tickDate) => {
            const x =
              PADDING.left +
              (Math.max(getDateDifferenceInDays(domainStartKey, tickDate), 0) /
                totalDomainDays) *
                chartWidth;

            return (
              <g key={tickDate}>
                <line
                  x1={x}
                  x2={x}
                  y1={chartBottom}
                  y2={chartBottom + 7}
                  stroke="rgba(27, 24, 20, 0.18)"
                />
                <text
                  x={x}
                  y={chartBottom + 26}
                  textAnchor="middle"
                  fill="rgba(61, 53, 43, 0.76)"
                  fontSize="12"
                >
                  {formatDayLabel(tickDate)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full border border-black/5"
        style={getLegendDotStyle(color)}
      />
      {label}
    </span>
  );
}

function TrendCallout({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(23,20,17,0.08)] bg-white/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      <p className="dashboard-mono text-[10px] text-[var(--muted)]">{label}</p>
      <p className="dashboard-display mt-3 text-3xl leading-none text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function LegacyHistoryChart({
  history,
  isAnimated,
}: {
  history: DashboardHistoryPoint[];
  isAnimated: boolean;
}) {
  const points = history.slice(-HISTORY_VISIBLE_POINTS);

  if (points.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel-strong)] text-sm text-[var(--muted)]">
        The chart will appear after the first successful daily snapshot.
      </div>
    );
  }

  const series: ChartSeries[] = [
    {
      key: "total",
      label: "Total",
      color: "var(--ink)",
      strokeWidth: 3.5,
      values: points.map((point) => point.totalParticipants),
    },
    {
      key: "devpost",
      label: "Devpost",
      color: "var(--accent)",
      strokeWidth: 2.25,
      values: points.map((point) => point.devpostCount),
    },
    {
      key: "google-form",
      label: "Google Form",
      color: "var(--sage)",
      strokeWidth: 2.25,
      values: points.map((point) => point.googleFormCount),
    },
  ];

  const chartWidth = HISTORY_CHART_WIDTH - HISTORY_PADDING.left - HISTORY_PADDING.right;
  const chartHeight = HISTORY_CHART_HEIGHT - HISTORY_PADDING.top - HISTORY_PADDING.bottom;
  const allValues = series.flatMap((entry) => entry.values);
  const maxValue = Math.max(...allValues, 4);
  const yRange = Math.max(maxValue, 1);
  const horizontalSteps = 4;
  const gridValues = Array.from({ length: horizontalSteps + 1 }, (_, index) => {
    const ratio = index / horizontalSteps;
    return Math.round(maxValue - ratio * yRange);
  });

  const toCoordinates = (values: number[]): ChartPoint[] =>
    values.map((value, index) => {
      const x =
        points.length === 1
          ? HISTORY_PADDING.left + chartWidth / 2
          : HISTORY_PADDING.left + (index / (points.length - 1)) * chartWidth;
      const y =
        HISTORY_PADDING.top +
        ((maxValue - value) / yRange) * Math.max(chartHeight, 1);

      return { x, y };
    });

  const seriesCoordinates = series.map((entry) => ({
    ...entry,
    coordinates: toCoordinates(entry.values),
  }));
  const totalCoordinates = seriesCoordinates[0]?.coordinates ?? [];
  const labelInterval =
    points.length <= 6 ? 1 : points.length <= 10 ? 2 : 3;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="dashboard-mono text-[11px] text-[var(--muted)]">
            Daily Progress
          </p>
          <h3 className="dashboard-display mt-2 text-3xl leading-none text-[var(--ink)] md:text-4xl">
            Numbers versus previous days
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          {series.map((entry) => (
            <span key={entry.key} className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      <div className="dashboard-grid rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel-strong)] p-4 md:p-6">
        <svg
          viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`}
          className="h-[320px] w-full overflow-visible"
          role="img"
          aria-label="Daily registrations trend"
        >
          {gridValues.map((value) => {
            const y =
              HISTORY_PADDING.top +
              ((maxValue - value) / yRange) * Math.max(chartHeight, 1);

            return (
              <g key={value}>
                <line
                  x1={HISTORY_PADDING.left}
                  x2={HISTORY_CHART_WIDTH - HISTORY_PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(27, 24, 20, 0.14)"
                  strokeDasharray="3 7"
                />
                <text
                  x={HISTORY_CHART_WIDTH - HISTORY_PADDING.right}
                  y={y - 8}
                  textAnchor="end"
                  fill="rgba(61, 53, 43, 0.72)"
                  fontSize="12"
                >
                  {formatCompactValue(value)}
                </text>
              </g>
            );
          })}

          {totalCoordinates.length > 1 && (
            <path
              d={buildAreaPath(
                totalCoordinates,
                HISTORY_CHART_HEIGHT - HISTORY_PADDING.bottom
              )}
              fill="rgba(24, 22, 19, 0.05)"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          )}

          {seriesCoordinates.map((entry) => (
            <polyline
              key={entry.key}
              points={buildPolyline(entry.coordinates)}
              fill="none"
              stroke={entry.color}
              strokeWidth={entry.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          ))}

          {totalCoordinates.map((point) => (
            <circle
              key={`${point.x}-${point.y}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--ink)"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          ))}

          {points.map((point, index) => {
            if (index % labelInterval !== 0 && index !== points.length - 1) {
              return null;
            }

            const x =
              points.length === 1
                ? HISTORY_PADDING.left + chartWidth / 2
                : HISTORY_PADDING.left + (index / (points.length - 1)) * chartWidth;

            return (
              <text
                key={point.date}
                x={x}
                y={HISTORY_CHART_HEIGHT - HISTORY_PADDING.bottom + 28}
                textAnchor="middle"
                fill="rgba(61, 53, 43, 0.72)"
                fontSize="12"
              >
                {formatDayLabel(point.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
