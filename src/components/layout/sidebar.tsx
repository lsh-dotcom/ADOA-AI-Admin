"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  BarChart3,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { name: "대시보드", href: "/", icon: LayoutDashboard },
  { name: "AI 에이전트", href: "/agents", icon: Bot },
  { name: "사용자 관리", href: "/users", icon: Users },
  { name: "보고서", href: "/reports", icon: BarChart3 },
  { name: "문서", href: "/documents", icon: FileText },
  { name: "설정", href: "/settings", icon: Settings },
];

export function SidebarContent() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Bot className="h-6 w-6 text-primary" />
          <span className="text-lg">ADOA Admin</span>
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-4">
        <p className="text-xs text-muted-foreground">
          ADOA AI Admin v0.1.0
        </p>
      </div>
    </div>
  );
}
