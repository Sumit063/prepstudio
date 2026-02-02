import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { dsaAttemptsByProblem, dsaProblems } from "../data/mock";

export const DsaDetail = () => {
  const { id } = useParams();
  const problem = dsaProblems.find((item) => item.id === Number(id));
  const attempts = dsaAttemptsByProblem[Number(id)] ?? [];

  if (!problem) {
    return (
      <div className="space-y-4">
        <Link to="/dsa" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to DSA
        </Link>
        <Card>
          <CardContent>
            <p className="text-sm">Problem not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/dsa" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to DSA
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{problem.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Platform</p>
            <p className="text-sm font-medium">{problem.platform}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Difficulty</p>
            <p className="text-sm font-medium">{problem.difficulty}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tags</p>
            <p className="text-sm font-medium">{problem.tags.join(", ")}</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium">{problem.status}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{attempt.status}</TableCell>
                    <TableCell>{attempt.timeMinutes}m</TableCell>
                    <TableCell className="text-muted-foreground">{attempt.notes}</TableCell>
                    <TableCell className="text-muted-foreground">{attempt.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add attempt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select defaultValue="Solved">
                <option>Solved</option>
                <option>Partial</option>
                <option>Unsolved</option>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Time (minutes)</label>
              <Input type="number" placeholder="30" />
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea placeholder="Key mistakes or insights" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button>Add attempt</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
