-- ============================================================
-- 알림 테이블
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
    -- 'billing_due_today', 'overdue_7', 'overdue_14', 'overdue_30',
    -- 'tax_invoice_due', 'payment_confirmed', 'general'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'urgent', 'success')),
  target_role TEXT DEFAULT 'pm'
    CHECK (target_role IN ('pm', 'ceo', 'all')),
  target_user_id UUID,
  related_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  related_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  channel TEXT DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'slack', 'kakao', 'email')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_target_role ON notifications(target_role);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notifications" ON notifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update notifications" ON notifications
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);
