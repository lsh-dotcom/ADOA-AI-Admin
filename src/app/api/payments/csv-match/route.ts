import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

type CsvRow = {
  company_name: string;
  amount: number;
  paid_date: string;
};

type MatchResult = {
  csv_row: CsvRow;
  matched: boolean;
  payment_id?: string;
  project_name?: string;
  expected_amount?: number;
  match_type?: "exact" | "partial";
  reason?: string;
};

// POST /api/payments/csv-match - CSV 입금 데이터 매칭
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const { rows } = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "CSV 데이터가 비어있습니다." },
      { status: 400 }
    );
  }

  // 미입금 건 전체 조회
  const { data: pendingPayments } = await supabase
    .from("payments")
    .select("*, contracts(project_name, clients(company_name))")
    .in("status", ["pending", "invoiced", "tax_invoice_issued"]);

  const results: MatchResult[] = [];

  for (const row of rows as CsvRow[]) {
    const csvCompany = (row.company_name || "").trim();
    const csvAmount = Number(row.amount) || 0;

    if (!csvCompany || !csvAmount) {
      results.push({
        csv_row: row,
        matched: false,
        reason: "거래처명 또는 금액이 누락되었습니다.",
      });
      continue;
    }

    // 매칭: 거래처명 포함 + 금액 일치
    const exactMatch = (pendingPayments || []).find(
      (p: Record<string, unknown>) => {
        const contracts = p.contracts as {
          company_name?: string;
          clients?: { company_name?: string };
        } | null;
        const clientName = contracts?.clients?.company_name || "";
        const totalWithVat = Number(p.total_with_vat) || 0;
        return (
          clientName.includes(csvCompany) &&
          Math.abs(totalWithVat - csvAmount) < 10 // 10원 이내 오차 허용
        );
      }
    );

    if (exactMatch) {
      const contracts = exactMatch.contracts as {
        project_name?: string;
      } | null;
      results.push({
        csv_row: row,
        matched: true,
        payment_id: exactMatch.id as string,
        project_name: contracts?.project_name || "",
        expected_amount: Number(exactMatch.total_with_vat),
        match_type: "exact",
      });
      continue;
    }

    // 부분 매칭: 거래처명만 일치
    const partialMatch = (pendingPayments || []).find(
      (p: Record<string, unknown>) => {
        const contracts = p.contracts as {
          clients?: { company_name?: string };
        } | null;
        const clientName = contracts?.clients?.company_name || "";
        return clientName.includes(csvCompany);
      }
    );

    if (partialMatch) {
      const contracts = partialMatch.contracts as {
        project_name?: string;
      } | null;
      results.push({
        csv_row: row,
        matched: true,
        payment_id: partialMatch.id as string,
        project_name: contracts?.project_name || "",
        expected_amount: Number(partialMatch.total_with_vat),
        match_type: "partial",
        reason: `금액 불일치: 예상 ${Number(partialMatch.total_with_vat).toLocaleString()}원`,
      });
    } else {
      results.push({
        csv_row: row,
        matched: false,
        reason: "매칭되는 미입금 건을 찾을 수 없습니다.",
      });
    }
  }

  return NextResponse.json({ results });
}

// POST /api/payments/csv-match (action=apply) - 매칭 결과 일괄 적용
export async function PUT(request: NextRequest) {
  const supabase = createAdminClient();
  const { confirmations } = await request.json();

  // confirmations: Array<{ payment_id, paid_date, paid_amount }>
  if (!Array.isArray(confirmations) || confirmations.length === 0) {
    return NextResponse.json(
      { error: "적용할 항목이 없습니다." },
      { status: 400 }
    );
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of confirmations) {
    const { error } = await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_date: item.paid_date,
        paid_amount: item.paid_amount,
      })
      .eq("id", item.payment_id);

    if (error) {
      failCount++;
    } else {
      successCount++;
    }
  }

  return NextResponse.json({
    success: successCount,
    failed: failCount,
    total: confirmations.length,
  });
}
