import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { getDesignTopic, getDsaProblem, getDueReviews } from "../lib/api";
import type { ReviewItem } from "../lib/api";
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
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
        if (!active) return;
        setReviews(enriched);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reviews</p>
          <h1 className="text-2xl font-semibold">Due reviews</h1>
        </div>
        <Button variant="outline">Schedule next</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
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
                  </TableRow>
                ))}
                {!loading && reviews.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
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
