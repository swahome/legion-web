import { useState } from "react";
import { moneyIn, type Flows } from "../api/dashboard";
import { formatMoney } from "../lib/format";

// Money in (teal) against money out (orange) per period, as paired bars.
// Both colours pass the dataviz palette checks on the light and dark card
// surfaces. Hovering or focusing a period shows its breakdown.

export interface Period extends Flows {
  label: string; // short axis label
  title: string; // full name for the tooltip
}

const IN = "#0d9488";
const OUT = "#ea580c";
const W = 720;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

const compact = new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 });

/** niceMax rounds the top of the scale up so that its quarters are round numbers. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.6, 2, 3, 4, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function MoneyChart({ periods, currency }: { periods: Period[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = periods.map((p) => ({ in: moneyIn(p), out: Number(p.expenses) }));
  const top = niceMax(Math.max(0, ...values.flatMap((v) => [v.in, v.out])));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(periods.length, 1);
  const bar = Math.max(2, Math.min(18, (slot - 8) / 2 - 1));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const every = Math.ceil(periods.length / 12);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const h = hover != null ? periods[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: IN }} aria-hidden /> Money in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: OUT }} aria-hidden /> Expenses
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Money in and expenses by period">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px]">
              {compact.format(t)}
            </text>
          </g>
        ))}
        {periods.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const v = { in: moneyIn(p), out: Number(p.expenses) };
          return (
            <g key={p.title} opacity={hover == null || hover === i ? 1 : 0.45}>
              <Bar x={cx - bar - 1} w={bar} y={y(v.in)} base={y(0)} fill={IN} />
              <Bar x={cx + 1} w={bar} y={y(v.out)} base={y(0)} fill={OUT} />
              {i % every === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                  {p.label}
                </text>
              )}
              <rect
                x={cx - slot / 2}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.title}: in ${formatMoney(String(v.in), currency)}, expenses ${formatMoney(p.expenses, currency)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-8 z-10 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={
            hover < periods.length / 2
              ? { left: `${((PAD.left + slot * (hover + 1)) / W) * 100}%` }
              : { right: `${((W - PAD.left - slot * hover) / W) * 100}%` }
          }
        >
          <p className="mb-1.5 font-semibold">{h.title}</p>
          <TipRow label="Contributions" value={h.contributions} currency={currency} />
          <TipRow label="Fines" value={h.fines} currency={currency} />
          <TipRow label="Other payments" value={h.misc} currency={currency} />
          <TipRow label="Income" value={h.income} currency={currency} />
          <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
          <TipRow label="Money in" value={String(moneyIn(h))} currency={currency} swatch={IN} strong />
          <TipRow label="Expenses" value={h.expenses} currency={currency} swatch={OUT} strong />
        </div>
      )}
    </div>
  );
}

function Bar({ x, w, y, base, fill }: { x: number; w: number; y: number; base: number; fill: string }) {
  const h = base - y;
  if (h <= 0) return null;
  const r = Math.min(4, w / 2, h);
  // Rounded at the data end, square on the baseline.
  return <path d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`} fill={fill} />;
}

function TipRow({ label, value, currency, swatch, strong }: { label: string; value: string; currency: string; swatch?: string; strong?: boolean }) {
  return (
    <p className={`flex items-center justify-between gap-3 py-0.5 ${strong ? "font-medium" : "text-slate-600 dark:text-slate-300"}`}>
      <span className="flex items-center gap-1.5">
        {swatch && <span className="size-2 rounded-sm" style={{ background: swatch }} aria-hidden />}
        {label}
      </span>
      <span className="whitespace-nowrap tabular-nums">{formatMoney(value, currency)}</span>
    </p>
  );
}
