import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/Dialog";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { designTopics } from "../data/mock";

const categories = ["HLD", "LLD", "DB", "Cache", "Queue", "Scaling", "Consistency"] as const;

export const Design = () => {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("HLD");
  const topicsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category] = designTopics.filter((topic) => topic.category === category);
      return acc;
    }, {} as Record<(typeof categories)[number], typeof designTopics>);
  }, []);

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(
    topicsByCategory[activeCategory]?.[0]?.id ?? null
  );

  const activeTopics = topicsByCategory[activeCategory] ?? [];
  const selectedTopic = activeTopics.find((topic) => topic.id === selectedTopicId) ?? activeTopics[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">System Design</p>
          <h1 className="text-2xl font-semibold">Knowledge base</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add topic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add design topic</DialogTitle>
              <DialogDescription>Capture architecture notes and tradeoffs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input placeholder="Rate limiter" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select defaultValue="HLD">
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <Input placeholder="redis, tokens" />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea placeholder="Add architecture notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button>Save topic</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeCategory} onValueChange={(value) => {
        setActiveCategory(value as (typeof categories)[number]);
        const next = topicsByCategory[value as (typeof categories)[number]]?.[0]?.id ?? null;
        setSelectedTopicId(next);
      }}>
        <TabsList>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category}>
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Topics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(topicsByCategory[category] ?? []).map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        topic.id === selectedTopicId
                          ? "border-accent bg-muted"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{topic.title}</div>
                      <div className="text-xs text-muted-foreground">Updated {topic.updatedAt}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{selectedTopic?.title ?? "Select a topic"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                    {selectedTopic?.notes ?? "Pick a topic to view notes."}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTopic?.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
