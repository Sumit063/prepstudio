import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { DateTimePicker } from "../components/ui/DateTimePicker";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import {
  createStudySession,
  disconnectCalendar,
  getCalendarConnectUrl,
  getCalendarStatus,
  listStudySessions,
} from "../lib/api";
import type { CalendarStatus, StudySession } from "../lib/api";
import { formatDate } from "../lib/format";

const pad = (value: number) => String(value).padStart(2, "0");

const toDateString = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const toTimeString = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;

const createEmptyForm = () => ({
  scheduledAt: new Date(),
  duration_minutes: 60,
  focus_area: "MIXED",
  notes: "",
});

const formatTime = (value?: string | null) => {
  if (!value) return "?";
  return value.slice(0, 5);
};

export const StudySessions = () => {
  const location = useLocation();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [form, setForm] = useState(createEmptyForm());
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const calendarParam = params.get("calendar");
    if (calendarParam === "connected") {
      setCalendarNotice("Google Calendar connected.");
    } else if (calendarParam === "error") {
      setCalendarNotice("Google Calendar connection failed.");
    }
  }, [location.search]);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      setCalendarError(null);
      try {
        const status = await getCalendarStatus();
        if (!active) return;
        setCalendarStatus(status);
        if (!status.connected) {
          setSyncToCalendar(false);
        }
      } catch (err) {
        if (active) {
          setCalendarError(err instanceof Error ? err.message : "Failed to load calendar status");
        }
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!form.scheduledAt) {
      setError("Select a date and time.");
      return;
    }
    setSaving(true);
    setError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await createStudySession({
        date: toDateString(form.scheduledAt),
        start_time: toTimeString(form.scheduledAt),
        duration_minutes: Number(form.duration_minutes),
        focus_area: form.focus_area as StudySession["focus_area"],
        notes: form.notes,
        sync_to_calendar: syncToCalendar && Boolean(calendarStatus?.connected),
        time_zone: timeZone,
      });
      setForm(createEmptyForm());
      const data = await listStudySessions();
      setSessions(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarBusy(true);
    setCalendarError(null);
    try {
      const { auth_url } = await getCalendarConnectUrl();
      window.location.href = auth_url;
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to start calendar connection");
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarBusy(true);
    setCalendarError(null);
    try {
      await disconnectCalendar();
      setCalendarStatus({ connected: false });
      setSyncToCalendar(false);
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to disconnect calendar");
    } finally {
      setCalendarBusy(false);
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
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {calendarNotice && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {calendarNotice}
            </div>
          )}
          {calendarError && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {calendarError}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Status: {calendarStatus?.connected ? "Connected" : "Not connected"}
            </span>
            {calendarStatus?.connected && calendarStatus.email && (
              <span className="text-muted-foreground">({calendarStatus.email})</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!calendarStatus?.connected ? (
              <Button variant="outline" onClick={handleConnectCalendar} disabled={calendarBusy}>
                {calendarBusy ? "Connecting..." : "Connect Google Calendar"}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleDisconnectCalendar} disabled={calendarBusy}>
                {calendarBusy ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(event) => setSyncToCalendar(event.target.checked)}
                disabled={!calendarStatus?.connected}
              />
              Add new sessions to calendar
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create session</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Date & time</label>
              <DateTimePicker
                value={form.scheduledAt}
                onChange={(value) => setForm({ ...form, scheduledAt: value })}
                placeholder="Select date and time"
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
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Focus</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Calendar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading sessions...
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{formatDate(session.date)}</TableCell>
                    <TableCell>{formatTime(session.start_time)}</TableCell>
                    <TableCell>{session.duration_minutes}m</TableCell>
                    <TableCell>{session.focus_area}</TableCell>
                    <TableCell className="text-muted-foreground">{session.notes}</TableCell>
                    <TableCell>
                      {session.calendar_event_link ? (
                        <a
                          href={session.calendar_event_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-accent hover:text-accent-hover"
                        >
                          Open
                        </a>
                      ) : session.calendar_error ? (
                        <span className="text-xs text-rose-500">Failed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">?</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
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
