"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Plus,
  Loader2,
  MessageSquare,
  FileSignature,
  DollarSign,
  UserCheck,
  CalendarDays,
  Users,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type Conversation = {
  id: string;
  title: string;
  last_message_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "status";
  content: string;
  agent: string | null;
  metadata: MessageMetadata | null;
  created_at: string;
};

type MessageMetadata = {
  type?: string;
  contract_id?: string;
  contracts?: Array<{
    id: string;
    project_name: string;
    company_name: string;
    total_amount: number;
    status: string;
  }>;
  actions?: Array<{ label: string; href: string }>;
};

const AGENT_CONFIG: Record<string, { icon: typeof Bot; label: string; color: string; tag: string }> = {
  contract: { icon: FileSignature, label: "계약 관리", color: "#D85A30", tag: "@계약" },
  billing: { icon: DollarSign, label: "정산 관리", color: "#1D9E75", tag: "@정산" },
  freelancer: { icon: UserCheck, label: "외부인건비", color: "#7F77DD", tag: "@외부인건비" },
  schedule: { icon: CalendarDays, label: "일정 관리", color: "#378ADD", tag: "@일정" },
  hr: { icon: Users, label: "인사 관리", color: "#D4537E", tag: "@인사" },
  general: { icon: Bot, label: "AI 어시스턴트", color: "#888780", tag: "" },
  router: { icon: Bot, label: "라우터", color: "#888780", tag: "" },
};

const STATUS_MAP: Record<string, string> = {
  draft: "초안", signed: "체결", in_progress: "진행중", completed: "완료",
};

const AGENT_TAGS = ["@계약", "@정산", "@외부인건비", "@일정", "@인사"];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (Array.isArray(data)) setConversations(data);
    } catch { /* ignore */ }
    setLoadingConvs(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const fetchMessages = useCallback(async () => {
    if (!activeConvId) return;
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/chat/${activeConvId}/messages`);
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch { /* ignore */ }
    setLoadingMsgs(false);
  }, [activeConvId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useRealtimeSubscription("messages", () => {
    if (activeConvId) fetchMessages();
  }, activeConvId ? { column: "conversation_id", value: activeConvId } : undefined);
  useRealtimeSubscription("conversations", fetchConversations);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // @mention detection
  useEffect(() => {
    const lastAt = input.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === input.length - 1) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const insertTag = (tag: string) => {
    const lastAt = input.lastIndexOf("@");
    const before = lastAt >= 0 ? input.slice(0, lastAt) : input;
    setInput(before + tag + " ");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleNewConversation = async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "새 대화" }),
      });
      const data = await res.json();
      if (data.id) {
        setActiveConvId(data.id);
        setMessages([]);
        await fetchConversations();
      }
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    let convId = activeConvId;
    if (!convId) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: input.slice(0, 30) }),
        });
        const data = await res.json();
        convId = data.id;
        setActiveConvId(convId);
        await fetchConversations();
      } catch { return; }
    }

    const userMessage = input;
    setInput("");
    setSending(true);

    setMessages((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      conversation_id: convId!,
      role: "user",
      content: userMessage,
      agent: null,
      metadata: null,
      created_at: new Date().toISOString(),
    }]);

    try {
      await fetch(`/api/chat/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
      });
      await fetchMessages();
      await fetchConversations();
    } catch {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        conversation_id: convId!,
        role: "assistant",
        content: "전송에 실패했습니다. 다시 시도해주세요.",
        agent: null,
        metadata: null,
        created_at: new Date().toISOString(),
      }]);
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -m-4 md:-m-6">
      {/* Sidebar: Conversation List */}
      <div className="hidden md:flex w-64 border-r bg-card flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">대화 목록</h2>
          <Button size="sm" variant="ghost" onClick={handleNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">대화가 없습니다</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveConvId(c.id); setMessages([]); }}
                className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors hover:bg-muted/50 ${activeConvId === c.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{c.title}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b flex items-center px-4 gap-3 bg-card">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <span className="font-medium text-sm">팀 커뮤니케이션</span>
            <span className="text-xs text-muted-foreground ml-2">작업 지시 및 결과 확인</span>
          </div>
          <div className="ml-auto flex gap-1">
            {AGENT_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => { setInput((prev) => prev + tag + " "); inputRef.current?.focus(); }}
                className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium border hover:bg-muted transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConvId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Bot className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold">업무를 지시하세요</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                예: 삼성전자 계약서 작성해줘, 이번 달 정산 현황 알려줘
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">@계약 @정산 @외부인건비 @일정 @인사</span>로 에이전트를 직접 호출할 수 있어요
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

          {loadingMsgs && (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}

          {messages.map((msg) => {
            if (msg.role === "status") {
              const agentConf = msg.agent ? AGENT_CONFIG[msg.agent] : null;
              return (
                <div key={msg.id} className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {agentConf && (
                    <span className="font-medium" style={{ color: agentConf.color }}>{agentConf.label}</span>
                  )}
                  <span>{msg.content}</span>
                </div>
              );
            }

            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end gap-2">
                  <div className="max-w-[75%]">
                    <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
                      {renderContentWithTags(msg.content)}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right mt-0.5">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              );
            }

            // Assistant message
            const agentConf = msg.agent ? AGENT_CONFIG[msg.agent] : AGENT_CONFIG.general;

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
                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>

                  <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {renderContent(msg.content)}
                  </div>

                  {/* Contract list card */}
                  {msg.metadata?.type === "contract_list" && msg.metadata.contracts && (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      {msg.metadata.contracts.map((c) => (
                        <Link
                          key={c.id}
                          href={`/contracts/${c.id}`}
                          className="flex items-center justify-between text-sm p-3 border-b last:border-0 hover:bg-muted transition-colors"
                        >
                          <div>
                            <span className="font-medium">{c.project_name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{c.company_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs rounded-full bg-muted px-2 py-0.5">{STATUS_MAP[c.status] || c.status}</span>
                            <span className="tabular-nums font-medium text-xs">{c.total_amount?.toLocaleString()}원</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Contract created card */}
                  {msg.metadata?.type === "contract_created" && msg.metadata.contract_id && (
                    <div className="rounded-lg border bg-card p-4" style={{ borderColor: `${AGENT_CONFIG.contract.color}30` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileSignature className="h-4 w-4" style={{ color: AGENT_CONFIG.contract.color }} />
                        <span className="text-xs font-bold" style={{ color: AGENT_CONFIG.contract.color }}>계약서 초안 생성</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        Supabase에 저장됨 · ID: {msg.metadata.contract_id.slice(0, 8)}...
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {msg.metadata?.actions && msg.metadata.actions.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.metadata.actions.map((action, i) => (
                        <Link key={i} href={action.href}>
                          <Button size="sm" variant={i === 0 ? "default" : "outline"} className="h-7 text-xs">
                            {i === 0 && action.label.includes("확인") ? "승인" : action.label}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      ))}
                      {msg.metadata.contract_id && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          상세보기
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-3 bg-card relative">
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
                if (e.key === "Enter" && !e.shiftKey) {
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
    </div>
  );
}

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderContentWithTags(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const agentEntry = Object.entries(AGENT_CONFIG).find(([, v]) => v.tag === part.trim());
      if (agentEntry) {
        return (
          <span key={i} className="font-bold" style={{ color: agentEntry[1].color }}>
            {part}
          </span>
        );
      }
    }
    return part;
  });
}
