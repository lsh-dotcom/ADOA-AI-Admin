"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSignature,
  Calculator,
  UserCheck,
  CalendarDays,
  Users,
  Bot,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { name: "대시보드", href: "/", icon: LayoutDashboard },
  { name: "계약 관리", href: "/contracts", icon: FileSignature },
  { name: "정산 관리", href: "/payments", icon: Calculator },
  { name: "프리랜서 관리", href: "/freelancers", icon: UserCheck },
  { name: "일정 관리", href: "/schedules", icon: CalendarDays },
  { name: "인사 관리", href: "/hr", icon: Users },
  { name: "AI 채팅", href: "/ai-chat", icon: Bot },
  { name: "설정", href: "/settings", icon: Settings },
];

export function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

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
      <div className="p-4 space-y-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
        <p className="text-xs text-muted-foreground">
          ADOA AI Admin v0.1.0
        </p>
      </div>
    </div>
  );
}
