import { Calculator } from "lucide-react";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">정산 관리</h1>
        <p className="text-muted-foreground">
          청구서 발행, 세금계산서, 입금 확인을 관리합니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "미청구", value: "₩0", desc: "청구서 미발행" },
          { title: "미수금", value: "₩0", desc: "입금 대기 중" },
          { title: "이번 달 입금", value: "₩0", desc: "확인된 입금" },
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
        <Calculator className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">정산 내역이 없습니다</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          계약이 등록되면 정산 내역이 자동으로 생성됩니다.
        </p>
      </div>
    </div>
  );
}
