"use client";

/**
 * Real OHLCV price chart (lightweight-charts v5, already a project dep).
 *
 * Data comes exclusively from GET /api/market/[mint]/candles?range=… —
 * genuine GeckoTerminal candles for the registry's associated pool. The
 * component NEVER fabricates candles: every provider/no-data state renders
 * an honest message instead. Ranges map to provider-supported granularities
 * (see lib/market/types.ts CANDLE_RANGES).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { RefreshCw } from "lucide-react";
import {
  CANDLE_RANGE_LABELS,
  type Candle,
  type CandleRangePlan,
} from "@/lib/market/types";

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; candles: Candle[] }
  | { kind: "no-history"; note?: string }
  | { kind: "pending-discovery"; note?: string }
  | { kind: "rate-limited"; retryAfterMs?: number; note?: string; hadCached: boolean }
  | { kind: "unavailable"; note?: string; hadCached: boolean };

const UP = "#42e8ff";
const DOWN = "#ff537a";

function fmtTime(ts: number, range: CandleRangePlan["label"]): string {
  const d = new Date(ts * 1000);
  if (range === "7d" || range === "30d") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PriceChart({ mint }: { mint: string }) {
  const [range, setRange] = useState<CandleRangePlan["label"]>("24h");
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lastCandlesRef = useRef<Candle[]>([]);
const load = useCallback(
    async (label: CandleRangePlan["label"]) => {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/market/${mint}/candles?range=${label}`);
        const body = (await res.json()) as {
          ok?: boolean;
          candles?: Candle[];
          status?: string;
          note?: string;
          retryAfterMs?: number;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          setState({ kind: "unavailable", note: body.error || `HTTP ${res.status}`, hadCached: false });
          return;
        }
        const candles = body.candles ?? [];
        lastCandlesRef.current = candles;
        switch (body.status) {
          case "ok":
            setState({ kind: "ok", candles });
            break;
          case "no-history":
            setState({ kind: "no-history", note: body.note });
            break;
          case "pending-discovery":
            setState({ kind: "pending-discovery", note: body.note });
            break;
          case "provider-rate-limited":
            setState({
              kind: "rate-limited",
              retryAfterMs: body.retryAfterMs,
              note: body.note,
              hadCached: candles.length > 0,
            });
            break;
          default:
            setState({
              kind: "unavailable",
              note: body.note,
              hadCached: candles.length > 0,
            });
            if (candles.length > 0) setState({ kind: "ok", candles });
            break;
        }
      } catch (e) {
        setState({
          kind: "unavailable",
          note: String((e as Error)?.message || e),
          hadCached: lastCandlesRef.current.length > 0,
        });
      } finally {
        setRefreshing(false);
      }
    },
    [mint]
  );

  useEffect(() => {
    lastCandlesRef.current = [];
    setState({ kind: "loading" });
    void load(range);
  }, [range, load]);

  // Draw whenever we have candles.
  const candles = state.kind === "ok" ? state.candles : [];
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#a6b5d4",
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(41, 59, 96, 0.45)" },
        horzLines: { color: "rgba(41, 59, 96, 0.45)" },
      },
      rightPriceScale: { borderColor: "#293b60" },
      timeScale: { borderColor: "#293b60", secondsVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision: 10, minMove: 0.00000001 },
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    if (candles.some((c) => c.volume != null)) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volSeries.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume ?? 0,
          color: c.close >= c.open ? "rgba(66,232,255,0.35)" : "rgba(255,83,122,0.35)",
        }))
      );
    }

    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles]);

  const lastClose = useMemo(() => {
    const c = candles[candles.length - 1];
    return c ? c.close : null;
  }, [candles]);
  const windowChangePct = useMemo(() => {
    const first = candles[0];
    if (lastClose == null || !first || first.open === 0) return null;
    return ((lastClose - first.open) / first.open) * 100;
  }, [lastClose, candles]);

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-lg font-bold">Price chart</h3>
        <span className="font-mono text-[11px] text-faint">genuine OHLCV · GeckoTerminal</span>
        {state.kind === "ok" && windowChangePct != null && (
          <span
            className={
              "rounded-full border px-2 py-0.5 font-mono text-[11px] " +
              (windowChangePct >= 0
                ? "border-acid/40 bg-acid/10 text-acid"
                : "border-crimson/40 bg-crimson/10 text-crimson")
            }
          >
            {windowChangePct >= 0 ? "+" : ""}
            {windowChangePct.toFixed(2)}% this window
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void load(range)}
          disabled={refreshing}
          aria-label="Refresh chart"
          className="flex items-center gap-1.5 rounded-full border border-line bg-raised/60 px-3 py-1.5 font-mono text-[12px] text-muted transition-colors hover:border-acid/50 hover:text-acid disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <div className="flex rounded-full border border-line bg-raised/60 p-1">
          {CANDLE_RANGE_LABELS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={
                "rounded-full px-2.5 py-1.5 font-mono text-[12px] transition-colors " +
                (range === r ? "bg-acid/15 text-acid" : "text-muted hover:text-ink")
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {state.kind === "loading" && (
        <div
          role="status"
          aria-label="Loading chart"
          className="flex h-72 items-center justify-center rounded-xl border border-line bg-raised/30"
        >
          <div className="animate-pulse font-mono text-[13px] text-faint">loading candles…</div>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          <div className="flex flex-wrap items-center gap-4 font-mono text-[12px]">
            <span className="text-faint">
              close:{" "}
              <span className={windowChangePct != null && windowChangePct >= 0 ? "text-acid" : "text-crimson"}>
                {lastClose != null ? lastClose.toPrecision(6) : "—"}
              </span>
            </span>
            <span className="text-faint">{candles.length} candles</span>
            <span className="text-faint">
              {fmtTime(candles[0]?.time ?? 0, range)} → {fmtTime(candles[candles.length - 1]?.time ?? 0, range)}
            </span>
          </div>
          <div ref={containerRef} className="h-72 w-full" />
        </>
      )}

      {state.kind === "no-history" && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-raised/30 text-center">
          <p className="font-mono text-[13px] text-muted">No candle history for this window.</p>
          <p className="max-w-md font-mono text-[12px] text-faint">
            {state.note ??
              "Candles appear only when real trades occur — nothing is synthesized from spot prices."}
          </p>
        </div>
      )}

      {state.kind === "pending-discovery" && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-warn/30 bg-warn/5 text-center">
          <p className="font-mono text-[13px] text-warn">Waiting for market-data indexing…</p>
          <p className="max-w-md font-mono text-[12px] text-faint">
            {state.note ??
              "The token is verified on-chain; SpawnPad retries discovery with bounded backoff until a provider indexes its pool."}
          </p>
          <button
            onClick={() => void load(range)}
            className="mt-1 rounded-full border border-line-strong px-3 py-1.5 font-mono text-[12px] text-muted transition-colors hover:border-acid/50 hover:text-acid"
          >
            retry now
          </button>
        </div>
      )}

      {state.kind === "rate-limited" && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-warn/30 bg-warn/5 text-center">
          <p className="font-mono text-[13px] text-warn">Market-data provider rate-limited.</p>
          <p className="max-w-md font-mono text-[12px] text-faint">
            {state.note ?? "SpawnPad will retry shortly."}
            {state.retryAfterMs ? ` Retrying in ~${Math.ceil(state.retryAfterMs / 1000)}s.` : ""}
          </p>
          {state.hadCached && (
            <button
              onClick={() => void load(range)}
              className="mt-1 rounded-full border border-line-strong px-3 py-1.5 font-mono text-[12px] text-muted transition-colors hover:border-acid/50 hover:text-acid"
            >
              retry now
            </button>
          )}
        </div>
      )}

      {state.kind === "unavailable" && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-crimson/30 bg-crimson/5 text-center">
          <p className="font-mono text-[13px] text-crimson">Market-data provider unavailable.</p>
          <p className="max-w-md font-mono text-[12px] text-faint">{state.note}</p>
          <button
            onClick={() => void load(range)}
            className="mt-1 rounded-full border border-line-strong px-3 py-1.5 font-mono text-[12px] text-muted transition-colors hover:border-acid/50 hover:text-acid"
          >
            retry now
          </button>
        </div>
      )}
    </div>
  );
}
