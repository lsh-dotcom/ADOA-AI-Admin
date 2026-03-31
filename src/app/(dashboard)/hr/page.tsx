import { Users, Plus } from "lucide-react";

export default function HRPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">인사 관리</h1>
          <p className="text-muted-foreground">
            직원 정보, 근태, 연차를 관리합니다.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          직원 등록
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "전체 직원", value: "0명", desc: "재직 중" },
          { title: "오늘 출근", value: "0명", desc: "현재 근무 중" },
          { title: "연차 사용률", value: "0%", desc: "전체 평균" },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <h3 className="text-sm font-medium text-muted-foreground">
              {card.title}
            </h3>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">등록된 직원이 없습니다</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          직원을 등록하여 인사 관리를 시작하세요.
        </p>
      </div>
    </div>
  );
}
