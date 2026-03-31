import { CalendarDays } from "lucide-react";

export default function SchedulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">일정 관리</h1>
        <p className="text-muted-foreground">
          프로젝트별 제작 일정과 단계를 관리합니다.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center">
        <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">등록된 일정이 없습니다</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          계약이 등록되면 제작 일정을 단계별로 관리할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
