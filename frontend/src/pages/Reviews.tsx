import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { reviewItems } from "../data/mock";

export const Reviews = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reviews</p>
          <h1 className="text-2xl font-semibold">Due reviews</h1>
        </div>
        <Button variant="outline">Schedule next</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Last reviewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{item.type}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.dueInDays === 0 ? "Today" : `${item.dueInDays}d`}</TableCell>
                  <TableCell className="text-muted-foreground">{item.lastReviewed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
