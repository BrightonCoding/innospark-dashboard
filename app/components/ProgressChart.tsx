"use client";

import { useEffect, useState } from "react";
import type { DashboardHistoryPoint } from "@/lib/dashboard-types";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 340;
const PADDING = { top: 24, right: 24, bottom: 48, left: 18 };
const VISIBLE_POINTS = 14;

interface ProgressChartProps {
  history: DashboardHistoryPoint[];
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

function buildAreaPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  const chartBottom = CHART_HEIGHT - PADDING.bottom;
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

export default function ProgressChart({ history }: ProgressChartProps) {
  const points = history.slice(-VISIBLE_POINTS);
  const [isAnimated, setIsAnimated] = useState(false);
  const animationKey = points
    .map(
      (point) =>
        `${point.date}:${point.totalParticipants}:${point.devpostCount}:${point.googleFormCount}`
    )
    .join("|");

  useEffect(() => {
    setIsAnimated(false);

    const frame = window.requestAnimationFrame(() => {
      setIsAnimated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [animationKey]);

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

  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const allValues = series.flatMap((entry) => entry.values);
  const maxValue = Math.max(...allValues, 4);
  const minValue = 0;
  const yRange = Math.max(maxValue - minValue, 1);
  const horizontalSteps = 4;
  const gridValues = Array.from({ length: horizontalSteps + 1 }, (_, index) => {
    const ratio = index / horizontalSteps;
    return Math.round(maxValue - ratio * yRange);
  });

  const toCoordinates = (values: number[]): ChartPoint[] =>
    values.map((value, index) => {
      const x =
        points.length === 1
          ? PADDING.left + chartWidth / 2
          : PADDING.left + (index / (points.length - 1)) * chartWidth;
      const y =
        PADDING.top +
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
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-[320px] w-full overflow-visible"
          role="img"
          aria-label="Daily registrations trend"
        >
          {gridValues.map((value) => {
            const y =
              PADDING.top +
              ((maxValue - value) / yRange) * Math.max(chartHeight, 1);

            return (
              <g key={value}>
                <line
                  x1={PADDING.left}
                  x2={CHART_WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(27, 24, 20, 0.14)"
                  strokeDasharray="3 7"
                />
                <text
                  x={CHART_WIDTH - PADDING.right}
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
              d={buildAreaPath(totalCoordinates)}
              fill="rgba(24, 22, 19, 0.05)"
              style={{
                opacity: isAnimated ? 1 : 0,
                transition: "opacity 700ms ease",
              }}
            />
          )}

          {seriesCoordinates.map((entry, index) => (
            <polyline
              key={entry.key}
              fill="none"
              pathLength={100}
              stroke={entry.color}
              strokeWidth={entry.strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={buildPolyline(entry.coordinates)}
              style={{
                opacity: isAnimated ? 1 : 0.35,
                strokeDasharray: 100,
                strokeDashoffset: isAnimated ? 0 : 100,
                transition: `stroke-dashoffset ${900 + index * 160}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms ease`,
              }}
            />
          ))}

          {seriesCoordinates.map((entry, seriesIndex) =>
            entry.coordinates.map((point, index) => (
              <circle
                key={`${entry.key}-${index}`}
                cx={point.x}
                cy={point.y}
                r={index === entry.coordinates.length - 1 ? 5 : 3.5}
                fill={entry.color}
                stroke="rgba(247, 243, 235, 0.9)"
                strokeWidth={2}
                style={{
                  opacity: isAnimated ? 1 : 0,
                  transformOrigin: `${point.x}px ${point.y}px`,
                  transform: isAnimated ? "scale(1)" : "scale(0.4)",
                  transition: `transform 420ms cubic-bezier(0.2, 0.9, 0.25, 1) ${220 + index * 55 + seriesIndex * 80}ms, opacity 320ms ease ${220 + index * 55 + seriesIndex * 80}ms`,
                }}
              />
            ))
          )}

          {points.map((point, index) => {
            const x =
              points.length === 1
                ? PADDING.left + chartWidth / 2
                : PADDING.left + (index / (points.length - 1)) * chartWidth;
            const shouldRenderLabel =
              index === 0 ||
              index === points.length - 1 ||
              index % labelInterval === 0;

            if (!shouldRenderLabel) {
              return null;
            }

            return (
              <text
                key={point.date}
                x={x}
                y={CHART_HEIGHT - 12}
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
