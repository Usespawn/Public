"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

const STORAGE_KEY = "spawnpad.sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      window.localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  return (
    <div className="relative min-h-screen">
      <div className="dot-matrix pointer-events-none fixed inset-0" />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <motion.div
        animate={{ paddingLeft: collapsed ? 68 : 232 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative"
      >
        <Topbar />
        <main className="p-6">{children}</main>
      </motion.div>
    </div>
  );
}
