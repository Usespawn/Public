"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass,
  Rocket,
  Flame,
  Sparkles,
  Wallet2,
  Activity,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Egg,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";

const NAV_MAIN = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/launch", label: "Launch", icon: Rocket },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/portfolio", label: "Portfolio", icon: Wallet2 },
  { href: "/activity", label: "Activity", icon: Activity },
];

const NAV_SECONDARY = [
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  const renderLink = ({ href, label, icon: Icon }: (typeof NAV_MAIN)[number]) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-acid/10 text-acid"
            : "text-muted hover:bg-raised/50 hover:text-ink"
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", active && "text-acid")} strokeWidth={2} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 232 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-panel/80 backdrop-blur-md"
    >
      <Link
        href="/"
        className="flex h-16 items-center gap-2.5 border-b border-line px-4 overflow-hidden"
      >
        <span className="grid size-8 shrink-0 place-items-center">
          <BrandMark size={30} />
        </span>
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-tight">
            Spawn<span className="text-acid">Pad</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {NAV_MAIN.map(renderLink)}
        {!collapsed && (
          <div className="pt-4 pb-1 px-3 text-[11px] uppercase tracking-wider text-faint">
            More
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-line mx-3" />}
        {NAV_SECONDARY.map(renderLink)}
      </nav>

      <button
        onClick={onToggle}
        className="flex items-center gap-3 border-t border-line px-4 py-4 text-[13px] text-faint transition-colors hover:text-ink"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-[18px]" />
        ) : (
          <>
            <PanelLeftClose className="size-[18px]" />
            <span>Collapse sidebar</span>
          </>
        )}
      </button>
    </motion.aside>
  );
}
