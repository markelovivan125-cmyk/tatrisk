import { Check, RotateCcw, X } from "lucide-react";
import type { DrawMode } from "../types/shapes";

interface Props {
  mode: DrawMode;
  hint: string;
  onFinish: () => void;
  onCancel: () => void;
  onUndoPoint: () => void;
}

const MULTI_POINT_MODES: DrawMode[] = ["polygon", "line"];
const ACTIVE_MODES: DrawMode[] = ["polygon", "rectangle", "circle", "freehand", "line", "point", "edit", "move"];

export default function DrawControls({ mode, hint, onFinish, onCancel, onUndoPoint }: Props) {
  if (!ACTIVE_MODES.includes(mode)) return null;
  const showFinishControls = MULTI_POINT_MODES.includes(mode);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {hint && (
        <div className="pointer-events-auto mx-4 max-w-md rounded-full bg-slate-900/85 px-4 py-2 text-center text-xs font-medium text-white shadow-lg backdrop-blur">
          {hint}
        </div>
      )}
      {showFinishControls && (
        <div className="pointer-events-auto flex gap-2 rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-slate-200 backdrop-blur">
          <button
            onClick={onUndoPoint}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95"
          >
            <RotateCcw size={16} /> Назад
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
          >
            <X size={16} /> Отмена
          </button>
          <button
            onClick={onFinish}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 active:scale-95"
          >
            <Check size={16} /> Готово
          </button>
        </div>
      )}
    </div>
  );
}
