"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createDashboard } from "@/actions/dashboards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StudioCreateForm() {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<"personal" | "region" | "corporate">("personal");
  const router = useRouter();

  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-[minmax(12rem,1fr)_11rem_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = String(fd.get("name") ?? "").trim();
        if (!name) {
          toast.error("Name is required.");
          return;
        }
        startTransition(async () => {
          try {
            const id = await createDashboard({ name, scope, widgets: [] });
            toast.success("Dashboard created.");
            router.push(`/dashboards/studio/${id}`);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Create failed");
          }
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="dash-name">Name</Label>
        <Input id="dash-name" name="name" placeholder="My dashboard" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dash-scope">Scope</Label>
        <Select
          items={[
            { value: "personal", label: "Personal" },
            { value: "region", label: "Region" },
            { value: "corporate", label: "Corporate" },
          ]}
          value={scope}
          onValueChange={(v) => setScope(v as typeof scope)}
        >
          <SelectTrigger id="dash-scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="region">Region</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="gap-1.5" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create
      </Button>
    </form>
  );
}
