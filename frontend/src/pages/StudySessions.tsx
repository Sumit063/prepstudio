import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { createStudySession, listStudySessions } from "../lib/api";
import type { StudySession } from "../lib/api";
import { formatDate } from "../lib/format";

const emptyForm = {
  date: "",
  duration_minutes: 60,
  focus_area: "MIXED",
  notes: "",
};

export const StudySessions = () => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listStudySessions();
        if (!active) return;
        setSessions(data.results);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load sessions");
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

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await createStudySession({
        date: form.date,
        duration_minutes: Number(form.duration_minutes),
        focus_area: form.focus_area as StudySession["focus_area"],
        notes: form.notes,
      });
      setForm(emptyForm);
      const data = await listStudySessions();
      setSessions(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Study Sessions</p>
        <h1 className="text-2xl font-semibold">Session tracker</h1>
      </div>

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Duration (min)</label>
              <Input
                type="number"
                value={form.duration_minutes}
                onChange={(event) =>
                  setForm({ ...form, duration_minutes: Number(event.target.value) })
                }
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Focus area</label>
              <Select
                value={form.focus_area}
                onChange={(event) => setForm({ ...form, focus_area: event.target.value })}
              >
                <option value="DSA">DSA</option>
                <option value="DESIGN">Design</option>
                <option value="MIXED">Mixed</option>
              </Select>
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Key takeaways"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving..." : "Save session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-y-auto">
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
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Loading sessions...
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{formatDate(session.date)}</TableCell>
                    <TableCell>{session.duration_minutes}m</TableCell>
                    <TableCell>{session.focus_area}</TableCell>
                    <TableCell className="text-muted-foreground">{session.notes}</TableCell>
                  </TableRow>
                ))}
                {!loading && sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No sessions yet.
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
