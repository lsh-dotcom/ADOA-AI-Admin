"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AIChatPage() {
  const [message, setMessage] = useState("");

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">AI 채팅</h1>
        <p className="text-muted-foreground">
          AI 어시스턴트에게 업무 관련 질문을 하세요.
        </p>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            ADOA AI 어시스턴트
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            계약서 초안 작성, 정산 현황 분석, 일정 관리 등 업무에 관한 질문을
            해보세요.
          </p>
        </div>
      </div>

      {/* Input Area */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="icon" disabled={!message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
