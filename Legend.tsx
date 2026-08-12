import { useState } from "react";
import { Info, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";

export default function Legend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-3 z-20 md:bottom-6 md:right-6">
      <div
        className={cn(
          "w-64 overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-slate-200 backdrop-blur transition-all duration-500 ease-in-out",
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0 ring-0"
        )}
      >
        <div className="space-y-2.5 p-3.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Условные обозначения</p>
          <LegendRow swatch={<DotsSwatch color="#0891b2" />} text="Заливка точками — град или гроза" />
          <LegendRow swatch={<SolidSwatch color="#f59e0b" />} text="Заливка без точек — риск явления" />
          <LegendRow swatch={<DashedSwatch color="#ef4444" />} text="Пунктирный контур — предупреждение о грозе" />
          <LegendRow swatch={<HatchSwatch color="#16a34a" />} text="Штриховая заливка — доп. явления (ветер и т.д.)" />
        </div>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-between gap-2 rounded-full bg-white/95 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xl ring-1 ring-slate-200 backdrop-blur active:scale-95"
      >
        <span className="flex items-center gap-1.5">
          <Info size={14} /> Легенда
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
}

function LegendRow({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {swatch}
      <span>{text}</span>
    </div>
  );
}

function DotsSwatch({ color }: { color: string }) {
  return (
    <svg width="28" height="20" className="shrink-0 rounded">
      <rect width="28" height="20" fill={color} opacity={0.3} />
      {[[5, 5], [16, 5], [10, 12], [22, 12], [5, 16], [16, 16]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill={color} />
      ))}
      <rect width="28" height="20" fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function SolidSwatch({ color }: { color: string }) {
  return (
    <svg width="28" height="20" className="shrink-0 rounded">
      <rect width="28" height="20" fill={color} opacity={0.3} />
      <rect width="28" height="20" fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function DashedSwatch({ color }: { color: string }) {
  return (
    <svg width="28" height="20" className="shrink-0 rounded">
      <rect width="28" height="20" fill={color} opacity={0.3} />
      <rect width="27" height="19" x={0.5} y={0.5} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
    </svg>
  );
}

function HatchSwatch({ color }: { color: string }) {
  const id = "legend-hatch";
  return (
    <svg width="28" height="20" className="shrink-0 rounded">
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth={2} />
        </pattern>
      </defs>
      <rect width="28" height="20" fill={`url(#${id})`} opacity={0.5} />
      <rect width="28" height="20" fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
