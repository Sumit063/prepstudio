import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { DateTimePicker } from "../components/ui/DateTimePicker";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import {
  createReviewItem,
  getCalendarStatus,
  getDesignTopic,
  getDsaProblem,
  getDueReviews,
} from "../lib/api";
import type { CalendarStatus, ReviewItem } from "../lib/api";
import { formatDate } from "../lib/format";

type ReviewDisplay = ReviewItem & {
  title: string;
  dueLabel: string;
};

const typeLabel = (itemType: ReviewItem["item_type"]) =>
  itemType === "DSA_PROBLEM" ? "DSA" : "Design";

export const Reviews = () => {
  const [reviews, setReviews] = useState<ReviewDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [scheduleForm, setScheduleForm] = useState({
    item_type: "DSA_PROBLEM",
    ref_id: "",
    next_review_at: new Date(),
    interval_days: 1,
  });
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const loadReviews = async () => {
    const data = await getDueReviews(0);
    const enriched = await Promise.all(
      data.map(async (item) => {
        let title = `Item #${item.ref_id}`;
        if (item.item_type === "DSA_PROBLEM") {
          try {
            const problem = await getDsaProblem(item.ref_id);
            title = problem.title;
          } catch {
            title = `DSA #${item.ref_id}`;
          }
        } else {
          try {
            const topic = await getDesignTopic(item.ref_id);
            title = topic.title;
          } catch {
            title = `Design #${item.ref_id}`;
          }
        }

        const dueDate = new Date(item.next_review_at);
        const diff = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const dueLabel = diff <= 0 ? "Today" : `${diff}d`;

        return { ...item, title, dueLabel };
      })
    );
    setReviews(enriched);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!active) return;
        await loadReviews();
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load reviews");
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

  const handleSchedule = async () => {
    setScheduling(true);
    setScheduleError(null);
    try {
      const nextReview = scheduleForm.next_review_at ?? new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createReviewItem({
        item_type: scheduleForm.item_type as ReviewItem["item_type"],
        ref_id: Number(scheduleForm.ref_id),
        next_review_at: nextReview.toISOString(),
        interval_days: Number(scheduleForm.interval_days) || 1,
        sync_to_calendar: syncToCalendar && Boolean(calendarStatus?.connected),
        time_zone: timeZone,
      });
      setScheduleForm({ item_type: "DSA_PROBLEM", ref_id: "", next_review_at: new Date(), interval_days: 1 });
      setScheduleOpen(false);
      await loadReviews();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to schedule review");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reviews</p>
          <h1 className="text-2xl font-semibold">Due reviews</h1>
        </div>
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Schedule next</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule review</DialogTitle>
              <DialogDescription>Plan the next review for a problem or topic.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <Select
                  value={scheduleForm.item_type}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, item_type: event.target.value }))
                  }
                >
                  <option value="DSA_PROBLEM">DSA problem</option>
                  <option value="DESIGN_TOPIC">Design topic</option>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Reference ID</label>
                <Input
                  type="number"
                  value={scheduleForm.ref_id}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({ ...prev, ref_id: event.target.value }))
                  }
                  placeholder="e.g. 12"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Review date & time</label>
                <DateTimePicker
                  value={scheduleForm.next_review_at}
                  onChange={(value) =>
                    setScheduleForm((prev) => ({ ...prev, next_review_at: value ?? new Date() }))
                  }
                  placeholder="Select date and time"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Interval (days)</label>
                <Input
                  type="number"
                  value={scheduleForm.interval_days}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      interval_days: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={syncToCalendar}
                  onChange={(event) => setSyncToCalendar(event.target.checked)}
                  disabled={!calendarStatus?.connected}
                />
                Add to calendar
                {!calendarStatus?.connected && <span>(connect in Sessions)</span>}
              </div>
              {calendarError && (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {calendarError}
                </div>
              )}
              {scheduleError && (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {scheduleError}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSchedule} disabled={scheduling}>
                {scheduling ? "Saving..." : "Save review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Next review</TableHead>
                  <TableHead>Calendar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading reviews...
                    </TableCell>
                  </TableRow>
                )}
                {reviews.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{typeLabel(item.item_type)}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.dueLabel}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.next_review_at)}
                    </TableCell>
                    <TableCell>
                      {item.calendar_event_link ? (
                        <a
                          href={item.calendar_event_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-accent hover:text-accent-hover"
                        >
                          Open
                        </a>
                      ) : item.calendar_error ? (
                        <span className="text-xs text-rose-500">Failed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">?</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && reviews.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No reviews due.
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
