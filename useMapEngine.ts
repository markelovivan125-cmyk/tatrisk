import { useEffect, useRef, useState, useCallback } from "react";
import { MapEngine } from "../lib/mapEngine";
import type { DrawMode, ShapeRecord, ShapeStyle } from "../types/shapes";
import { CATEGORY_PRESETS } from "../types/shapes";

export function useMapEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MapEngine | null>(null);

  const [mode, setModeState] = useState<DrawMode>("select");
  const [shapes, setShapes] = useState<ShapeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ShapeStyle | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hint, setHint] = useState("");
  const [activeCategory, setActiveCategoryState] = useState(CATEGORY_PRESETS[0].id);
  const [activeStyle, setActiveStyleState] = useState<ShapeStyle>(CATEGORY_PRESETS[0].style);

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;
    const engine = new MapEngine(containerRef.current, {
      onChange: setShapes,
      onModeChange: setModeState,
      onSelectionChange: (id, style) => {
        setSelectedId(id);
        setSelectedStyle(style);
      },
      onHistoryChange: (undo, redo) => {
        setCanUndo(undo);
        setCanRedo(redo);
      },
      onHint: setHint,
    });
    engineRef.current = engine;
    engine.emitChange();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const setMode = useCallback((m: DrawMode) => engineRef.current?.setMode(m), []);
  const setActiveCategory = useCallback((id: string) => {
    const preset = CATEGORY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setActiveCategoryState(id);
    setActiveStyleState(preset.style);
    engineRef.current?.setActiveCategory(id);
    engineRef.current?.setActiveStyle(preset.style);
    if (engineRef.current?.getSelectedId()) {
      engineRef.current.applyCategoryToSelected(id, preset.style);
    }
  }, []);

  const setActiveStyle = useCallback((style: ShapeStyle) => {
    setActiveStyleState(style);
    engineRef.current?.setActiveStyle(style);
    if (engineRef.current?.getSelectedId()) {
      engineRef.current.applyStyleToSelected(style);
    }
  }, []);

  return {
    containerRef,
    engine: engineRef,
    mode,
    setMode,
    shapes,
    selectedId,
    selectedStyle,
    canUndo,
    canRedo,
    hint,
    activeCategory,
    setActiveCategory,
    activeStyle,
    setActiveStyle,
  };
}
