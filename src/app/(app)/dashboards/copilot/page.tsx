import { CopilotWorkspace } from "@/components/dashboards/copilot-workspace";
import { PageHeader } from "@/components/page-header";

export default function DashboardCopilotPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Magnus AI"
        description="Claude Opus 5 with zero data retention. Ask questions about live precon data, or build a dashboard view to save."
      />
      <CopilotWorkspace />
    </div>
  );
}
