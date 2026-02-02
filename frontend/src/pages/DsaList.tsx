import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/Dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { dsaProblems } from "../data/mock";

const StatusBadge = ({ status }: { status: string }) => {
  const base = "rounded-md px-2 py-0.5 text-xs font-medium";
  if (status === "Solved") {
    return <span className={`${base} bg-muted text-foreground`}>{status}</span>;
  }
  if (status === "Partial") {
    return <span className={`${base} bg-muted text-muted-foreground`}>{status}</span>;
  }
  return <span className={`${base} bg-background text-muted-foreground border border-border`}>{status}</span>;
};

export const DsaList = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">DSA</p>
          <h1 className="text-2xl font-semibold">Problems library</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add problem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add DSA problem</DialogTitle>
              <DialogDescription>Capture a new problem with context and notes.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input placeholder="Two Sum" />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Platform</label>
                <Select defaultValue="LeetCode">
                  <option>LeetCode</option>
                  <option>GFG</option>
                  <option>Custom</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Difficulty</label>
                  <Select defaultValue="3">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <Input placeholder="arrays, hashmap" />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Statement</label>
                <Textarea placeholder="Paste the problem statement." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button>Save problem</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Search problems" />
            <Select defaultValue="All">
              <option>All difficulties</option>
              <option>1-2</option>
              <option>3</option>
              <option>4-5</option>
            </Select>
            <Select defaultValue="All">
              <option>All status</option>
              <option>Solved</option>
              <option>Partial</option>
              <option>Unsolved</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Problem list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dsaProblems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell>
                      <Link
                        to={`/dsa/${problem.id}`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {problem.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {problem.tags.join(" • ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{problem.platform}</TableCell>
                    <TableCell>{problem.difficulty}</TableCell>
                    <TableCell>
                      <StatusBadge status={problem.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{problem.attempts}</TableCell>
                    <TableCell className="text-muted-foreground">{problem.lastAttempt}</TableCell>
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
