import { useRef, useState } from "react";
import {
  MousePointer2,
  Hexagon,
  RectangleHorizontal,
  Circle as CircleIcon,
  PenTool,
  Minus,
  MapPin,
  Move,
  PencilRuler,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  Eraser,
  Download,
  Upload,
  Eye,
  EyeOff,
  X,
  CloudLightning,
  Locate,
  Home,
  ChevronDown,
} from "lucide-react";
import type { DrawMode, ShapeRecord, ShapeStyle, FillType, LineStyle } from "../types/shapes";
import { CATEGORY_PRESETS, COLOR_SWATCHES } from "../types/shapes";
import { cn } from "../utils/cn";

interface ToolTypeDef {
  mode: DrawMode;
  label: string;
  icon: React.ReactNode;
}

const DRAW_TOOLS: ToolTypeDef[] = [
  { mode: "select", label: "Выбор", icon: <MousePointer2 size={18} /> },
  { mode: "polygon", label: "Полигон", icon: <Hexagon size={18} /> },
  { mode: "rectangle", label: "Прямоугольник", icon: <RectangleHorizontal size={18} /> },
  { mode: "circle", label: "Круг", icon: <CircleIcon size={18} /> },
  { mode: "freehand", label: "Произвольно", icon: <PenTool size={18} /> },
  { mode: "line", label: "Линия", icon: <Minus size={18} /> },
  { mode: "point", label: "Метка", icon: <MapPin size={18} /> },
];

const EDIT_TOOLS: ToolTypeDef[] = [
  { mode: "edit", label: "Узлы", icon: <PencilRuler size={18} /> },
  { mode: "move", label: "Переместить", icon: <Move size={18} /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
  mode: DrawMode;
  setMode: (m: DrawMode) => void;
  shapes: ShapeRecord[];
  selectedId: string | null;
  selectShape: (id: string) => void;
  onDeleteSelected: () => void;
  onDuplicate: () => void;
  onClearAll: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  activeStyle: ShapeStyle;
  setActiveStyle: (s: ShapeStyle) => void;
  exportGeoJSON: () => void;
  importGeoJSON: (text: string) => void;
  toggleVisibility: (id: string) => void;
  zoomToShape: (id: string) => void;
  locate: () => void;
  resetView: () => void;
}

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-wider text-slate-400";

export default function Toolbar(props: Props) {
  const {
    open,
    onClose,
    mode,
    setMode,
    shapes,
    selectedId,
    selectShape,
    onDeleteSelected,
    onDuplicate,
    onClearAll,
    undo,
    redo,
    canUndo,
    canRedo,
    activeCategory,
    setActiveCategory,
    activeStyle,
    setActiveStyle,
    exportGeoJSON,
    importGeoJSON,
    toggleVisibility,
    zoomToShape,
    locate,
    resetView,
  } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") importGeoJSON(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      {/* backdrop for mobile */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-1000 ease-in-out md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-[100dvh] w-[85vw] max-w-[360px] flex-col overflow-hidden border-r border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-1000 ease-in-out md:w-[360px]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-4 text-white">
          <div className="flex items-center gap-2">
            <CloudLightning size={22} />
            <div>
              <h1 className="text-sm font-bold leading-tight">Редактор метеозон</h1>
              <p className="text-[11px] text-indigo-100">Рисуйте зоны прямо на карте</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/90 transition hover:bg-white/15 active:scale-95"
            aria-label="Скрыть панель"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Draw tools */}
          <section>
            <p className={SECTION_TITLE}>Инструменты рисования</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DRAW_TOOLS.map((t) => (
                <button
                  key={t.mode}
                  onClick={() => setMode(t.mode)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-medium transition active:scale-95",
                    mode === t.mode
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {t.icon}
                  <span className="leading-none">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Edit tools */}
          <section>
            <p className={SECTION_TITLE}>Редактирование</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {EDIT_TOOLS.map((t) => (
                <button
                  key={t.mode}
                  disabled={!selectedId}
                  onClick={() => setMode(t.mode)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                    mode === t.mode
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {t.icon}
                  <span className="leading-none">{t.label}</span>
                </button>
              ))}
              <button
                disabled={!selectedId}
                onClick={onDuplicate}
                className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-2.5 text-[10px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy size={18} />
                <span className="leading-none">Копия</span>
              </button>
              <button
                disabled={!selectedId}
                onClick={onDeleteSelected}
                className="flex flex-col items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-1 py-2.5 text-[10px] font-medium text-red-600 transition hover:bg-red-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={18} />
                <span className="leading-none">Удалить</span>
              </button>
            </div>
          </section>

          {/* History */}
          <section className="flex gap-2">
            <button
              disabled={!canUndo}
              onClick={undo}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            >
              <Undo2 size={16} /> Отменить
            </button>
            <button
              disabled={!canRedo}
              onClick={redo}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            >
              <Redo2 size={16} /> Вернуть
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 active:scale-95"
              title="Очистить всё"
            >
              <Eraser size={16} />
            </button>
          </section>

          {/* Category presets */}
          <section>
            <p className={SECTION_TITLE}>Шаблоны опасных явлений</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CATEGORY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActiveCategory(preset.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition active:scale-95",
                    activeCategory === preset.id
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <span>{preset.emoji}</span>
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{preset.description}</span>
                  <span
                    className="mt-1 h-1.5 w-full rounded-full"
                    style={{ backgroundColor: preset.style.color, opacity: 0.6 }}
                  />
                </button>
              ))}
            </div>
          </section>

          {/* Custom style */}
          <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className={SECTION_TITLE}>Свой стиль{selectedId ? " (для выбранной зоны)" : ""}</p>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">Цвет</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveStyle({ ...activeStyle, color: c })}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition active:scale-90",
                      activeStyle.color === c ? "border-slate-800 scale-110" : "border-white shadow"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">Линия контура</p>
              <SegmentedControl<LineStyle>
                value={activeStyle.lineStyle}
                options={[
                  { value: "solid", label: "Сплошная" },
                  { value: "dashed", label: "Пунктир" },
                ]}
                onChange={(lineStyle) => setActiveStyle({ ...activeStyle, lineStyle })}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">Заливка</p>
              <SegmentedControl<FillType>
                value={activeStyle.fillType}
                options={[
                  { value: "dots", label: "Точки" },
                  { value: "hatch", label: "Штрихи" },
                  { value: "solid", label: "Сплошная" },
                ]}
                onChange={(fillType) => setActiveStyle({ ...activeStyle, fillType })}
              />
            </div>

            <div>
              <p className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-500">
                <span>Непрозрачность заливки</span>
                <span>{Math.round(activeStyle.opacity * 100)}%</span>
              </p>
              <input
                type="range"
                min={10}
                max={70}
                value={Math.round(activeStyle.opacity * 100)}
                onChange={(e) => setActiveStyle({ ...activeStyle, opacity: Number(e.target.value) / 100 })}
                className="w-full accent-indigo-600"
              />
            </div>
          </section>

          {/* Layers */}
          <section>
            <button
              onClick={() => setLayersOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <p className={SECTION_TITLE}>Слои ({shapes.length})</p>
              <ChevronDown size={14} className={cn("text-slate-400 transition-transform", layersOpen && "rotate-180")} />
            </button>
            {layersOpen && (
              <div className="mt-2 space-y-1.5">
                {shapes.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
                    Пока нет ни одной зоны. Выберите инструмент выше и нарисуйте её на карте.
                  </p>
                )}
                {shapes.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      selectShape(s.id);
                      zoomToShape(s.id);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
                      selectedId === s.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.style.color }} />
                    <span className="flex-1 truncate font-medium text-slate-700">{s.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisibility(s.id);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100"
                    >
                      {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Import / Export */}
          <section>
            <p className={SECTION_TITLE}>Данные</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={exportGeoJSON}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95"
              >
                <Download size={14} /> Экспорт
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95"
              >
                <Upload size={14} /> Импорт
              </button>
              <input ref={fileInputRef} type="file" accept=".json,.geojson" onChange={handleFile} className="hidden" />
            </div>
          </section>

          {/* Map utils */}
          <section className="flex gap-2 pb-2">
            <button
              onClick={locate}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95"
            >
              <Locate size={14} /> Моё место
            </button>
            <button
              onClick={resetView}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95"
            >
              <Home size={14} /> Обзор
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-slate-200/70 p-1 text-[11px] font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 transition",
            value === o.value ? "bg-white text-indigo-700 shadow" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
