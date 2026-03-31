export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          ADOA AI 관리자 대시보드에 오신 것을 환영합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "총 에이전트", value: "12", desc: "활성 AI 에이전트" },
          { title: "총 사용자", value: "1,234", desc: "등록된 사용자 수" },
          { title: "오늘 요청", value: "5,678", desc: "API 요청 수" },
          { title: "시스템 상태", value: "정상", desc: "모든 서비스 운영 중" },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
          >
            <h3 className="text-sm font-medium text-muted-foreground">
              {card.title}
            </h3>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
