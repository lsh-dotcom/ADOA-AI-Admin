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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

type Conversation = {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
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

const AGENT_ICONS: Record<string, typeof Bot> = {
  contract: FileSignature,
  billing: DollarSign,
  freelancer: UserCheck,
  schedule: CalendarDays,
  hr: Users,
  general: Bot,
  router: Bot,
};

const AGENT_LABELS: Record<string, string> = {
  contract: "계약",
  billing: "정산",
  freelancer: "프리랜서",
  schedule: "일정",
  hr: "인사",
  general: "일반",
  router: "라우터",
};

const STATUS_MAP: Record<string, string> = {
  draft: "초안",
  signed: "체결",
  in_progress: "진행중",
  completed: "완료",
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (Array.isArray(data)) setConversations(data);
    } catch { /* ignore */ }
    setLoadingConvs(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Fetch messages for active conversation
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

  // Realtime: refresh messages when anything changes
  useRealtimeSubscription("messages", () => {
    if (activeConvId) fetchMessages();
  }, activeConvId ? { column: "conversation_id", value: activeConvId } : undefined);

  useRealtimeSubscription("conversations", fetchConversations);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    // Create conversation if none active
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
      } catch {
        return;
      }
    }

    const userMessage = input;
    setInput("");
    setSending(true);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: convId!,
      role: "user",
      content: userMessage,
      agent: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      await fetch(`/api/chat/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
      });
      // Realtime will handle the update, but also fetch to be sure
      await fetchMessages();
      await fetchConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          conversation_id: convId!,
          role: "assistant",
          content: "전송에 실패했습니다. 다시 시도해주세요.",
          agent: null,
          metadata: null,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -m-4 md:-m-6">
      {/* Sidebar: Conversation List */}
      <div
        className={`border-r bg-card flex flex-col transition-all ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold">대화 목록</h2>
          <Button size="sm" variant="ghost" onClick={handleNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              대화가 없습니다
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveConvId(c.id); setMessages([]); }}
                className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors hover:bg-muted/50 ${
                  activeConvId === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{c.title}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-5.5 mt-0.5">
                  {formatTime(c.last_message_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 border-b flex items-center px-4 gap-2 bg-card">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="text-muted-foreground hover:text-foreground md:hidden"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-medium text-sm">ADOA AI 어시스턴트</span>
          {activeConvId && (
            <span className="text-xs text-muted-foreground ml-2">
              {conversations.find((c) => c.id === activeConvId)?.title}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConvId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">ADOA AI 어시스턴트</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                계약서 작성, 정산 현황, 프리랜서 배정 등 무엇이든 물어보세요.
              </p>
              <div className="grid gap-2 mt-6 sm:grid-cols-2 max-w-lg">
                {[
                  "LG 브랜드영상 건, 500만원 2건, 다음달 시작",
                  "이번 달 정산 현황 알려줘",
                  "촬영감독 프리랜서 누구 있어?",
                  "이번 주 일정 뭐 있어?",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInput(example)}
                    className="rounded-lg border p-3 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingMsgs && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "status") {
              return (
                <div key={msg.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{msg.content}</span>
                </div>
              );
            }

            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // assistant message
            const AgentIcon = msg.agent ? AGENT_ICONS[msg.agent] || Bot : Bot;
            const agentLabel = msg.agent ? AGENT_LABELS[msg.agent] : null;

            return (
              <div key={msg.id} className="flex gap-3 max-w-[85%]">
                <div className="mt-1 shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 min-w-0">
                  {agentLabel && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {agentLabel} 에이전트
                    </span>
                  )}

                  {/* Message content with markdown-lite rendering */}
                  <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {renderContent(msg.content)}
                  </div>

                  {/* Metadata cards */}
                  {msg.metadata?.type === "contract_list" && msg.metadata.contracts && (
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      {msg.metadata.contracts.map((c) => (
                        <Link
                          key={c.id}
                          href={`/contracts/${c.id}`}
                          className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted transition-colors"
                        >
                          <div>
                            <span className="font-medium">{c.project_name}</span>
                            <span className="text-muted-foreground ml-2">{c.company_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs rounded-full bg-muted px-2 py-0.5">
                              {STATUS_MAP[c.status] || c.status}
                            </span>
                            <span className="tabular-nums font-medium">
                              {c.total_amount?.toLocaleString()}원
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  {msg.metadata?.actions && msg.metadata.actions.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.metadata.actions.map((action, i) => (
                        <Link key={i} href={action.href}>
                          <Button size="sm" variant={i === 0 ? "default" : "outline"} className="h-7 text-xs">
                            {action.label}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4 bg-card">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="메시지를 입력하세요..."
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
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            계약 생성, 정산 조회, 프리랜서 검색, 일정 확인 등 자연어로 요청하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Simple markdown-lite renderer for bold text */
function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
