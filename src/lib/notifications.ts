import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "urgent" | "success";
  target_role: "pm" | "ceo" | "all";
  target_user_id?: string;
  related_payment_id?: string;
  related_contract_id?: string;
};

type NotificationChannel = {
  send(payload: NotificationPayload): Promise<void>;
};

/**
 * 인앱 알림 채널 - notifications 테이블에 저장
 */
class InAppChannel implements NotificationChannel {
  constructor(private supabase: SupabaseClient) {}

  async send(payload: NotificationPayload) {
    await this.supabase.from("notifications").insert({
      ...payload,
      channel: "in_app",
      sent_at: new Date().toISOString(),
    });
  }
}

/**
 * Slack 알림 채널 (미구현 - 추후 연동)
 */
class SlackChannel implements NotificationChannel {
  async send(payload: NotificationPayload) {
    // TODO: Slack Webhook 연동
    console.log("[Slack] Would send:", payload.title);
  }
}

/**
 * 카카오톡 알림 채널 (미구현 - 추후 연동)
 */
class KakaoChannel implements NotificationChannel {
  async send(payload: NotificationPayload) {
    // TODO: 카카오 알림톡 연동
    console.log("[Kakao] Would send:", payload.title);
  }
}

/**
 * 알림 발송 서비스
 * 채널을 추상화하여 in_app → slack → kakao 등으로 쉽게 확장 가능
 */
export class NotificationService {
  private channels: NotificationChannel[];

  constructor(supabase: SupabaseClient) {
    // 현재는 인앱만 활성화. 추후 채널 추가 시 여기에 push
    this.channels = [new InAppChannel(supabase)];

    // 환경변수로 추가 채널 활성화
    if (process.env.SLACK_WEBHOOK_URL) {
      this.channels.push(new SlackChannel());
    }
    if (process.env.KAKAO_API_KEY) {
      this.channels.push(new KakaoChannel());
    }
  }

  async notify(payload: NotificationPayload) {
    await Promise.allSettled(
      this.channels.map((ch) => ch.send(payload))
    );
  }

  async notifyBatch(payloads: NotificationPayload[]) {
    await Promise.allSettled(
      payloads.map((p) => this.notify(p))
    );
  }
}
