"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Loader2,
  FileSignature,
  DollarSign,
  UserCheck,
  CalendarDays,
  Users,
  ExternalLink,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Message = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  agent: string | null;
  contractData: ContractData | null;
  timestamp: number;
};

type ContractData = {
  client_name?: string;
  project_name?: string;
  unit_price?: number;
  quantity?: number;
  total_amount?: number;
  vat_included?: boolean;
  advance_amount?: number;
  balance_amount?: number;
  contract_start?: string;
  contract_end?: string;
  notes?: string;
};

const AGENT_CONFIG: Record<string, { icon: typeof Bot; label: string; color: string; tag: string }> = {
  contract: { icon: FileSignature, label: "계약 관리", color: "#D85A30", tag: "@계약" },
  billing: { icon: DollarSign, label: "정산 관리", color: "#1D9E75", tag: "@정산" },
  freelancer: { icon: UserCheck, label: "외부인건비", color: "#7F77DD", tag: "@외부인건비" },
  schedule: { icon: CalendarDays, label: "일정 관리", color: "#378ADD", tag: "@일정" },
  hr: { icon: Users, label: "인사 관리", color: "#D4537E", tag: "@인사" },
  general: { icon: Bot, label: "AI 어시스턴트", color: "#888780", tag: "" },
  system: { icon: Bot, label: "시스템", color: "#ef4444", tag: "" },
};

const AGENT_TAGS = ["@계약", "@정산", "@외부인건비", "@일정", "@인사"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // @mention detection
  useEffect(() => {
    setShowSuggestions(input.endsWith("@"));
  }, [input]);

  const insertTag = (tag: string) => {
    const lastAt = input.lastIndexOf("@");
    const before = lastAt >= 0 ? input.slice(0, lastAt) : input;
    setInput(before + tag + " ");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userMessage,
      agent: null,
      contractData: null,
      timestamp: Date.now(),
    };

    // Add loading status
    const statusMsg: Message = {
      id: `s-${Date.now()}`,
      role: "status",
      content: "AI가 분석 중...",
      agent: "router",
      contractData: null,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, statusMsg]);

    try {
      // Build history for context
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
      });

      const data = await res.json();

      // Remove status message, add assistant response
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response || data.error || "응답을 받지 못했습니다.",
        agent: data.agent || "general",
        contractData: data.contract_data || null,
        timestamp: Date.now(),
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== statusMsg.id).concat(assistantMsg)
      );
    } catch {
      setMessages((prev) =>
        prev.filter((m) => m.id !== statusMsg.id).concat({
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "전송에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.",
          agent: "system",
          contractData: null,
          timestamp: Date.now(),
        })
      );
    }

    setSending(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatKRW = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col -m-4 md:-m-6">
      {/* Header */}
      <div className="h-12 border-b flex items-center px-4 gap-3 bg-card shrink-0">
        <Bot className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <span className="font-medium text-sm">팀 커뮤니케이션</span>
          <span className="text-xs text-muted-foreground ml-2">작업 지시 및 결과 확인</span>
        </div>
        <div className="flex gap-1">
          {AGENT_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => { setInput((prev) => prev + tag + " "); inputRef.current?.focus(); }}
              className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium border hover:bg-muted transition-colors"
            >
              {tag}
            </button>
          ))}
          {messages.length > 0 && (
            <button onClick={clearChat} className="ml-2 rounded p-1 hover:bg-muted text-muted-foreground" title="대화 초기화">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Bot className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold">업무를 지시하세요</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              예: 삼성전자 계약서 작성해줘, 이번 달 정산 현황 알려줘
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">@계약 @정산 @외부인건비 @일정 @인사</span>로 에이전트 직접 호출
            </p>
            <div className="grid gap-2 mt-6 sm:grid-cols-2 max-w-lg w-full">
              {[
                "삼성전자 웰스토리 사내방송 월 2회 6개월 회당 500만 부가세별도",
                "@정산 이번 달 매출 현황 알려줘",
                "@외부인건비 촬영감독 프리랜서 누구 있어?",
                "@일정 이번 주 마감 프로젝트 알려줘",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setInput(example)}
                  className="rounded-lg border p-3 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          // Status (loading) message
          if (msg.role === "status") {
            const agentConf = msg.agent ? AGENT_CONFIG[msg.agent] : null;
            return (
              <div key={msg.id} className="flex items-center gap-2 text-sm text-muted-foreground justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {agentConf && <span className="font-medium" style={{ color: agentConf.color }}>{agentConf.label}</span>}
                <span>{msg.content}</span>
              </div>
            );
          }

          // User message
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end gap-2">
                <div className="max-w-[75%]">
                  <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
                    {renderWithTags(msg.content)}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            );
          }

          // Assistant message
          const agentConf = AGENT_CONFIG[msg.agent || "general"] || AGENT_CONFIG.general;

          return (
            <div key={msg.id} className="flex gap-3 max-w-[85%]">
              <div
                className="mt-1 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${agentConf.color}20` }}
              >
                <agentConf.icon className="h-4 w-4" style={{ color: agentConf.color }} />
              </div>
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: agentConf.color }}>{agentConf.label}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                </div>

                <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
                  {renderMarkdown(msg.content)}
                </div>

                {/* Contract data card */}
                {msg.contractData && msg.contractData.total_amount && (
                  <div className="rounded-lg border bg-card p-4" style={{ borderColor: `${AGENT_CONFIG.contract.color}30` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileSignature className="h-4 w-4" style={{ color: AGENT_CONFIG.contract.color }} />
                      <span className="text-xs font-bold" style={{ color: AGENT_CONFIG.contract.color }}>계약 정보</span>
                    </div>
                    <div className="grid gap-2 text-sm">
                      {msg.contractData.client_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">거래처</span>
                          <span className="font-medium">{msg.contractData.client_name}</span>
                        </div>
                      )}
                      {msg.contractData.project_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">프로젝트</span>
                          <span className="font-medium">{msg.contractData.project_name}</span>
                        </div>
                      )}
                      {msg.contractData.unit_price && msg.contractData.unit_price > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">단가 × 수량</span>
                          <span>{formatKRW(msg.contractData.unit_price)} × {msg.contractData.quantity || 1}회</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">총 계약금액</span>
                        <span className="text-lg font-bold">{formatKRW(msg.contractData.total_amount)}</span>
                      </div>
                      {msg.contractData.advance_amount && msg.contractData.advance_amount > 0 && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">선금 30%</span>
                            <span>{formatKRW(msg.contractData.advance_amount)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">잔금 70%</span>
                            <span>{formatKRW(msg.contractData.balance_amount || 0)}</span>
                          </div>
                        </>
                      )}
                      {msg.contractData.contract_start && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">기간</span>
                          <span>{msg.contractData.contract_start} ~ {msg.contractData.contract_end || ""}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Link href="/contracts/new">
                        <Button size="sm" className="h-7 text-xs">
                          승인 + 저장
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                      <Link href="/contracts/new">
                        <Button size="sm" variant="outline" className="h-7 text-xs">수정</Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-7 text-xs">상세보기</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 bg-card relative shrink-0">
        {/* @mention suggestions */}
        {showSuggestions && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border bg-card shadow-lg p-1 z-20">
            {Object.entries(AGENT_CONFIG).filter(([, v]) => v.tag).map(([key, conf]) => (
              <button
                key={key}
                onClick={() => insertTag(conf.tag)}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <conf.icon className="h-4 w-4" style={{ color: conf.color }} />
                <span className="font-medium" style={{ color: conf.color }}>{conf.tag}</span>
                <span className="text-xs text-muted-foreground">{conf.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground">
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={inputRef}
            type="text"
            placeholder="업무를 지시하세요... (@으로 에이전트 호출)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Render **bold** text */
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/** Render @tags with agent colors */
function renderWithTags(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const entry = Object.entries(AGENT_CONFIG).find(([, v]) => v.tag === part.trim());
      if (entry) {
        return <span key={i} className="font-bold" style={{ color: entry[1].color }}>{part}</span>;
      }
    }
    return part;
  });
}
