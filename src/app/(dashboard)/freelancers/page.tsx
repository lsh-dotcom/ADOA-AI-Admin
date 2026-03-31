import { UserCheck, Plus } from "lucide-react";

export default function FreelancersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">프리랜서 관리</h1>
          <p className="text-muted-foreground">
            프리랜서 정보와 투입/정산을 관리합니다.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          프리랜서 등록
        </button>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center">
        <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">
          등록된 프리랜서가 없습니다
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          프리랜서를 등록하여 투입 관리를 시작하세요.
        </p>
      </div>
    </div>
  );
}
