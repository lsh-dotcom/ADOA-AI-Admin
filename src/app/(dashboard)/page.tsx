import {
  FileSignature,
  Calculator,
  UserCheck,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

const stats = [
  {
    title: "진행 중 계약",
    value: "0건",
    desc: "현재 진행 중인 프로젝트",
    icon: FileSignature,
  },
  {
    title: "미수금",
    value: "₩0",
    desc: "미결제 정산 금액",
    icon: Calculator,
  },
  {
    title: "활동 프리랜서",
    value: "0명",
    desc: "현재 투입 중인 프리랜서",
    icon: UserCheck,
  },
  {
    title: "이번 주 일정",
    value: "0건",
    desc: "예정된 촬영/납품",
    icon: CalendarDays,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          ADOA 경영지원 시스템 현황을 한눈에 확인하세요.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                {card.title}
              </h3>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions & Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">최근 활동</h2>
          <p className="text-sm text-muted-foreground">
            아직 등록된 활동이 없습니다. 계약을 추가하여 시작하세요.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">알림</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              현재 알림이 없습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
