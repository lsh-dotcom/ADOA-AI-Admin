export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">설정</h1>
        <p className="text-muted-foreground">
          시스템 설정을 관리합니다.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">일반 설정</h2>
          <p className="text-sm text-muted-foreground">
            회사 정보, 기본 설정 등을 관리합니다.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">알림 설정</h2>
          <p className="text-sm text-muted-foreground">
            정산 마감일 알림, 계약 만료 알림 등을 설정합니다.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">API 연동</h2>
          <p className="text-sm text-muted-foreground">
            OpenRouter API, Supabase 등 외부 서비스 연동을 관리합니다.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">사용자 관리</h2>
          <p className="text-sm text-muted-foreground">
            시스템 사용자 계정과 권한을 관리합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
