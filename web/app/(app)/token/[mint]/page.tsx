"use client";

import { useParams } from "next/navigation";
import { TokenDetail } from "@/components/TokenDetail";

export default function TokenPage() {
  const params = useParams<{ mint: string }>();
  return <TokenDetail mint={params.mint} />;
}
