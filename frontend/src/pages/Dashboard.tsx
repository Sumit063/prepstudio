import { ArrowUpRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { dashboardSummary, recentActivity } from "../data/mock";

const SimpleBarChart = () => {
  const max = Math.max(...dashboardSummary.avgTimeByDifficulty.map((d) => d.minutes));
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
        {dashboardSummary.avgTimeByDifficulty.map((item, index) => {
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attempts solved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{dashboardSummary.attemptsSolved}</p>
            <p className="text-xs text-muted-foreground">out of {dashboardSummary.attemptsTotal} attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top tag</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{dashboardSummary.topTags[0].tag}</p>
            <p className="text-xs text-muted-foreground">{dashboardSummary.topTags[0].count} attempts tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Design topics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {dashboardSummary.designByCategory.reduce((sum, item) => sum + item.count, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Across {dashboardSummary.designByCategory.length} categories</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SimpleBarChart />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Design coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboardSummary.designByCategory.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.category}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <span className="text-xs text-muted-foreground">Latest updates</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
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
                {recentActivity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{item.type}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">{item.detail}</TableCell>
                    <TableCell className="text-muted-foreground">{item.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
