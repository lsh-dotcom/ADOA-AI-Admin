-- ============================================================
-- ADOA AI Admin - Initial Database Schema
-- 영상 프로덕션 회사 ADOA의 AI 기반 경영지원 시스템
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. clients (거래처)
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  department TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms TEXT DEFAULT '검수 후 30일',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE clients IS '거래처 정보';
COMMENT ON COLUMN clients.company_name IS '거래처명';
COMMENT ON COLUMN clients.department IS '부서명';
COMMENT ON COLUMN clients.contact_name IS '담당자명';
COMMENT ON COLUMN clients.payment_terms IS '결제 조건';

-- ============================================================
-- 2. contracts (계약)
-- ============================================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  contract_type TEXT DEFAULT 'project'
    CHECK (contract_type IN ('project', 'annual', 'retainer')),
  unit_price BIGINT,
  quantity INT DEFAULT 1,
  total_amount BIGINT NOT NULL,
  vat_included BOOLEAN DEFAULT false,
  advance_rate DECIMAL(3,2) DEFAULT 0.30,
  advance_amount BIGINT,
  balance_amount BIGINT,
  contract_start DATE,
  contract_end DATE,
  delivery_deadline DATE,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent_to_client', 'negotiating', 'signed', 'in_progress', 'delivered', 'completed')),
  contract_pdf_url TEXT,
  pm_id UUID,
  created_by TEXT,
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE contracts IS '계약 정보';
COMMENT ON COLUMN contracts.project_name IS '프로젝트명 (예: 2026 사내방송 연간계약)';
COMMENT ON COLUMN contracts.unit_price IS '회당 단가 (원)';
COMMENT ON COLUMN contracts.total_amount IS '총 계약금액 (부가세 별도)';
COMMENT ON COLUMN contracts.advance_rate IS '선금 비율';
COMMENT ON COLUMN contracts.advance_amount IS '선금 금액 (자동 계산)';
COMMENT ON COLUMN contracts.balance_amount IS '잔금 금액 (자동 계산)';

-- ============================================================
-- 3. payments (정산/결제)
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL
    CHECK (payment_type IN ('advance', 'balance', 'monthly')),
  amount BIGINT NOT NULL,
  vat_amount BIGINT,
  total_with_vat BIGINT,
  invoice_date DATE,
  due_date DATE,
  tax_invoice_date DATE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'invoiced', 'tax_invoice_issued', 'paid', 'confirmed')),
  paid_date DATE,
  paid_amount BIGINT,
  reminder_sent BOOLEAN DEFAULT false,
  overdue_days INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payments IS '정산/결제 정보';
COMMENT ON COLUMN payments.payment_type IS '결제 유형: advance(선금), balance(잔금), monthly(월정산)';
COMMENT ON COLUMN payments.vat_amount IS '부가세 금액';
COMMENT ON COLUMN payments.total_with_vat IS '부가세 포함 총액';

-- ============================================================
-- 4. freelancers (프리랜서)
-- ============================================================
CREATE TABLE freelancers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  specialty TEXT,
  daily_rate BIGINT,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  phone TEXT,
  email TEXT,
  tax_type TEXT DEFAULT '3.3%',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE freelancers IS '프리랜서 정보';
COMMENT ON COLUMN freelancers.specialty IS '전문분야: 촬영감독, 조명, 편집, 모델 등';
COMMENT ON COLUMN freelancers.daily_rate IS '일당 (원)';
COMMENT ON COLUMN freelancers.account_number IS '계좌번호 (마스킹 표시 필요)';
COMMENT ON COLUMN freelancers.tax_type IS '원천세 유형 (기본: 3.3%)';

-- ============================================================
-- 5. freelancer_assignments (프리랜서 투입)
-- ============================================================
CREATE TABLE freelancer_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  freelancer_id UUID REFERENCES freelancers(id) ON DELETE SET NULL,
  work_days INT,
  daily_rate BIGINT,
  total_fee BIGINT,
  withholding_tax BIGINT,
  net_payment BIGINT,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'client_paid', 'approved', 'paid')),
  paid_date DATE,
  early_payment BOOLEAN DEFAULT false,
  early_payment_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE freelancer_assignments IS '프리랜서 투입/정산';
COMMENT ON COLUMN freelancer_assignments.withholding_tax IS '원천세 3.3% (자동 계산)';
COMMENT ON COLUMN freelancer_assignments.net_payment IS '실지급액 (자동 계산)';
COMMENT ON COLUMN freelancer_assignments.early_payment IS '선지급 여부';

-- ============================================================
-- 6. employees (직원)
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  hire_date DATE,
  contract_type TEXT
    CHECK (contract_type IN ('full_time', 'contract', 'intern')),
  probation_end_date DATE,
  salary BIGINT,
  bank_account TEXT,
  phone TEXT,
  email TEXT,
  emergency_contact TEXT,
  annual_leave_total INT DEFAULT 15,
  annual_leave_used INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE employees IS '직원 정보';
COMMENT ON COLUMN employees.salary IS '급여 (CEO만 조회 가능)';
COMMENT ON COLUMN employees.bank_account IS '계좌 정보 (암호화 필요)';
COMMENT ON COLUMN employees.annual_leave_total IS '연차 총 일수';
COMMENT ON COLUMN employees.annual_leave_used IS '사용한 연차 일수';

-- ============================================================
-- 7. attendance (근태)
-- ============================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('present', 'annual_leave', 'half_day', 'sick', 'remote', 'field_work')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

COMMENT ON TABLE attendance IS '근태 기록';
COMMENT ON COLUMN attendance.type IS '근태 유형: 출근, 연차, 반차, 병가, 재택, 현장근무';

-- ============================================================
-- 8. project_schedules (프로젝트 일정)
-- ============================================================
CREATE TABLE project_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  phase TEXT NOT NULL
    CHECK (phase IN ('kickoff', 'planning', 'pre_production', 'shooting', 'editing', 'first_draft', 'revision', 'final_delivery')),
  phase_name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE project_schedules IS '프로젝트 일정 (단계별)';
COMMENT ON COLUMN project_schedules.phase IS '제작 단계';
COMMENT ON COLUMN project_schedules.phase_name IS '단계 한글명';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_payments_contract_id ON payments(contract_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_freelancer_assignments_contract_id ON freelancer_assignments(contract_id);
CREATE INDEX idx_freelancer_assignments_freelancer_id ON freelancer_assignments(freelancer_id);
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_project_schedules_contract_id ON project_schedules(contract_id);
CREATE INDEX idx_employees_status ON employees(status);

-- ============================================================
-- TRIGGERS: contracts - 선금/잔금 자동 계산
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_contract_amounts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_amount >= 3000000 THEN
    NEW.advance_rate := 0.30;
    NEW.advance_amount := ROUND(NEW.total_amount * 0.30);
    NEW.balance_amount := NEW.total_amount - NEW.advance_amount;
  ELSE
    NEW.advance_rate := 0;
    NEW.advance_amount := 0;
    NEW.balance_amount := NEW.total_amount;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_contract_amounts
  BEFORE INSERT OR UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_contract_amounts();

-- ============================================================
-- TRIGGERS: freelancer_assignments - 원천세/실지급액 자동 계산
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_freelancer_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_fee IS NOT NULL THEN
    NEW.withholding_tax := ROUND(NEW.total_fee * 0.033);
    NEW.net_payment := NEW.total_fee - NEW.withholding_tax;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_freelancer_payment
  BEFORE INSERT OR UPDATE ON freelancer_assignments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_freelancer_payment();

-- ============================================================
-- TRIGGERS: updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelancer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_schedules ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자에게 모든 테이블 접근 허용 (추후 역할 기반으로 세분화)
CREATE POLICY "Authenticated users can read all" ON clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON clients
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON contracts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON contracts
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON payments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON payments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON freelancers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON freelancers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON freelancers
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON freelancer_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON freelancer_assignments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON freelancer_assignments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON employees
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON employees
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON attendance
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON attendance
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all" ON project_schedules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON project_schedules
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON project_schedules
  FOR UPDATE TO authenticated USING (true);
