import { ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { getAnalyticsSummary } from "../lib/api";
import type { AnalyticsSummary } from "../lib/api";
import { formatDateTime } from "../lib/format";

const emptySummary: AnalyticsSummary = {
  attempts_solved_count: 0,
  attempts_total_count: 0,
  avg_time_by_difficulty: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  top_tags_by_attempts: [],
  design_topics_by_category: [],
  recent_activity: [],
};

const SimpleBarChart = ({ summary }: { summary: AnalyticsSummary }) => {
  const data = useMemo(
    () =>
      Object.entries(summary.avg_time_by_difficulty).map(([difficulty, minutes]) => ({
        difficulty: Number(difficulty),
        minutes,
      })),
    [summary]
  );
  const max = Math.max(1, ...data.map((d) => d.minutes));

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Avg time by difficulty</p>
          <p className="text-xs text-muted-foreground">Minutes per attempt</p>
        </div>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      <svg viewBox="0 0 240 90" className="h-24 w-full">
        {data.map((item, index) => {
          const height = (item.minutes / max) * 70;
          const x = 10 + index * 44;
          const y = 80 - height;
          return (
            <g key={item.difficulty}>
              <rect
                x={x}
                y={y}
                width={26}
                height={height}
                rx={3}
                fill="var(--color-accent)"
              />
              <text x={x + 13} y={86} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)">
                {item.difficulty}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const Dashboard = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getAnalyticsSummary(30);
        if (active) {
          setSummary(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const resolvedSummary = summary ?? emptySummary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
          <h1 className="text-2xl font-semibold">Learning overview</h1>
        </div>
        <Button variant="outline">
          Open analytics
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attempts solved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{resolvedSummary.attempts_solved_count}</p>
            <p className="text-xs text-muted-foreground">
              out of {resolvedSummary.attempts_total_count} attempts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top tag</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {resolvedSummary.top_tags_by_attempts[0]?.tag ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {resolvedSummary.top_tags_by_attempts[0]?.count ?? 0} attempts tracked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Design topics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {resolvedSummary.design_topics_by_category.reduce((sum, item) => sum + item.count, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Across {resolvedSummary.design_topics_by_category.length} categories
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SimpleBarChart summary={resolvedSummary} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Design coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolvedSummary.design_topics_by_category.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.category}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
            {resolvedSummary.design_topics_by_category.length === 0 && (
              <p className="text-xs text-muted-foreground">No recent updates.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <span className="text-xs text-muted-foreground">
              {loading ? "Loading" : "Latest updates"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedSummary.recent_activity.map((item, index) => (
                  <TableRow key={`${item.title}-${index}`}>
                    <TableCell className="text-muted-foreground">{item.type}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">{item.detail}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(item.occurred_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && resolvedSummary.recent_activity.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No recent activity.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
