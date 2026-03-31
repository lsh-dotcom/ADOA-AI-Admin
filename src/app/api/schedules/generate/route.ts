import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const PHASES = [
  { phase: "kickoff", phase_name: "사전미팅", days: 1, offset_days: 3 },
  { phase: "planning", phase_name: "기획", days: 5, offset_days: 0 },
  { phase: "pre_production", phase_name: "촬영준비", days: 3, offset_days: 0 },
  { phase: "shooting", phase_name: "촬영", days: 2, offset_days: 0 },
  { phase: "editing", phase_name: "편집", days: 7, offset_days: 0 },
  { phase: "first_draft", phase_name: "1차 시안", days: 1, offset_days: 0 },
  { phase: "revision", phase_name: "피드백/수정", days: 8, offset_days: 0 },
  { phase: "final_delivery", phase_name: "최종 납품", days: 1, offset_days: 0 },
];

// POST /api/schedules/generate - 계약 기반 자동 일정 생성
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const { contract_id } = await request.json();

  if (!contract_id) {
    return NextResponse.json({ error: "contract_id 필수" }, { status: 400 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_start, contract_end, delivery_deadline")
    .eq("id", contract_id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "계약을 찾을 수 없습니다." }, { status: 404 });
  }

  // 기존 일정 삭제 후 재생성
  await supabase.from("project_schedules").delete().eq("contract_id", contract_id);

  const deadline = contract.delivery_deadline || contract.contract_end;
  const startBase = contract.contract_start
    ? new Date(contract.contract_start as string)
    : new Date();

  let schedules;

  if (deadline) {
    // 납품 마감일에서 역산
    schedules = generateFromDeadline(contract_id, new Date(deadline as string), startBase);
  } else {
    // 시작일에서 순차 배분
    schedules = generateFromStart(contract_id, startBase);
  }

  const { data, error } = await supabase
    .from("project_schedules")
    .insert(schedules)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateFromDeadline(contractId: string, deadline: Date, startBase: Date) {
  // 총 일수 계산 (역산)
  const totalDays = PHASES.reduce((s, p) => s + p.days + p.offset_days, 0);
  const totalAvailable = Math.floor(
    (deadline.getTime() - startBase.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 비율 조정 (가용 기간이 템플릿보다 짧거나 길면 비율 조정)
  const ratio = totalAvailable > 0 ? totalAvailable / totalDays : 1;

  const schedules = [];
  let cursor = new Date(startBase);

  for (const phase of PHASES) {
    const offsetDays = Math.max(1, Math.round(phase.offset_days * ratio));
    const phaseDays = Math.max(1, Math.round(phase.days * ratio));

    if (phase.offset_days > 0) {
      cursor = addDays(cursor, offsetDays);
    }

    const start = new Date(cursor);
    const end = addDays(cursor, phaseDays - 1);

    schedules.push({
      contract_id: contractId,
      phase: phase.phase,
      phase_name: phase.phase_name,
      start_date: fmt(start),
      end_date: fmt(end),
      status: "pending",
    });

    cursor = addDays(end, 1);
  }

  return schedules;
}

function generateFromStart(contractId: string, start: Date) {
  const schedules = [];
  let cursor = new Date(start);

  for (const phase of PHASES) {
    cursor = addDays(cursor, phase.offset_days);
    const phaseStart = new Date(cursor);
    const phaseEnd = addDays(cursor, phase.days - 1);

    schedules.push({
      contract_id: contractId,
      phase: phase.phase,
      phase_name: phase.phase_name,
      start_date: fmt(phaseStart),
      end_date: fmt(phaseEnd),
      status: "pending",
    });

    cursor = addDays(phaseEnd, 1);
  }

  return schedules;
}
