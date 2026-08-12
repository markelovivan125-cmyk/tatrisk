export type LineStyle = "solid" | "dashed";
export type FillType = "dots" | "hatch" | "solid";

export type DrawMode =
  | "none"
  | "select"
  | "polygon"
  | "rectangle"
  | "circle"
  | "freehand"
  | "line"
  | "point"
  | "edit"
  | "move";

export type ShapeKind =
  | "polygon"
  | "rectangle"
  | "circle"
  | "freehand"
  | "line"
  | "point";

export interface ShapeStyle {
  color: string;
  lineStyle: LineStyle;
  fillType: FillType;
  opacity: number;
  weight: number;
}

export interface ShapeRecord {
  id: string;
  kind: ShapeKind;
  name: string;
  categoryId: string;
  style: ShapeStyle;
  visible: boolean;
}

export interface CategoryPreset {
  id: string;
  label: string;
  description: string;
  emoji: string;
  style: ShapeStyle;
}

export const DEFAULT_OPACITY = 0.3;

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: "thunderstorm",
    label: "Гроза",
    description: "Заливка точками",
    emoji: "⛈️",
    style: {
      color: "#7c3aed",
      lineStyle: "solid",
      fillType: "dots",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
  {
    id: "hail",
    label: "Град",
    description: "Заливка точками",
    emoji: "🧊",
    style: {
      color: "#0891b2",
      lineStyle: "solid",
      fillType: "dots",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
  {
    id: "risk",
    label: "Риск",
    description: "Заливка без точек",
    emoji: "⚠️",
    style: {
      color: "#f59e0b",
      lineStyle: "solid",
      fillType: "solid",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
  {
    id: "warning",
    label: "Предупреждение о грозе",
    description: "Пунктирная линия контура",
    emoji: "🚨",
    style: {
      color: "#ef4444",
      lineStyle: "dashed",
      fillType: "dots",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
  {
    id: "wind",
    label: "Шквалистый ветер",
    description: "Штриховая заливка",
    emoji: "🌬️",
    style: {
      color: "#16a34a",
      lineStyle: "dashed",
      fillType: "hatch",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
  {
    id: "custom",
    label: "Своя зона",
    description: "Настройте стиль вручную",
    emoji: "🎨",
    style: {
      color: "#2563eb",
      lineStyle: "solid",
      fillType: "solid",
      opacity: DEFAULT_OPACITY,
      weight: 3,
    },
  },
];

export const COLOR_SWATCHES = [
  "#7c3aed",
  "#0891b2",
  "#f59e0b",
  "#ef4444",
  "#16a34a",
  "#2563eb",
  "#db2777",
  "#334155",
];
