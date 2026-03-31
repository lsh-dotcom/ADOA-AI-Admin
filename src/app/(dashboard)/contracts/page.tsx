import { FileSignature, Plus } from "lucide-react";

export default function ContractsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">계약 관리</h1>
          <p className="text-muted-foreground">
            프로젝트 계약을 생성하고 관리합니다.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          새 계약
        </button>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center">
        <FileSignature className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">등록된 계약이 없습니다</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          새 계약을 추가하여 프로젝트 관리를 시작하세요.
        </p>
      </div>
    </div>
  );
}
