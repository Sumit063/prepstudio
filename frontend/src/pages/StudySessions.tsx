import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { studySessions } from "../data/mock";

export const StudySessions = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Study Sessions</p>
        <h1 className="text-2xl font-semibold">Session tracker</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Duration (min)</label>
              <Input type="number" placeholder="60" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Focus area</label>
              <Select defaultValue="Mixed">
                <option>DSA</option>
                <option>Design</option>
                <option>Mixed</option>
              </Select>
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea placeholder="Key takeaways" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button>Save session</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Focus</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studySessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{session.date}</TableCell>
                  <TableCell>{session.duration}m</TableCell>
                  <TableCell>{session.focus}</TableCell>
                  <TableCell className="text-muted-foreground">{session.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
