import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { applyShapeStyle } from "./patterns";
import type { DrawMode, ShapeKind, ShapeRecord, ShapeStyle } from "../types/shapes";
import { CATEGORY_PRESETS } from "../types/shapes";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

interface Internal {
  id: string;
  kind: ShapeKind;
  layer: L.Layer;
  style: ShapeStyle;
  categoryId: string;
  name: string;
  visible: boolean;
  center?: L.LatLng;
  radius?: number;
}

interface Snapshot {
  id: string;
  kind: ShapeKind;
  categoryId: string;
  name: string;
  style: ShapeStyle;
  visible: boolean;
  latlngs?: [number, number][];
  center?: [number, number];
  radius?: number;
}

export interface EngineCallbacks {
  onChange: (shapes: ShapeRecord[]) => void;
  onModeChange: (mode: DrawMode) => void;
  onSelectionChange: (id: string | null, style: ShapeStyle | null) => void;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  onHint: (hint: string) => void;
}

const HINTS: Partial<Record<DrawMode, string>> = {
  select: "Нажмите на зону на карте, чтобы выбрать её.",
  polygon: "Нажимайте на карту, чтобы добавлять точки. Завершите зону кнопкой «Готово».",
  rectangle: "Проведите пальцем или мышью по карте, чтобы задать прямоугольник.",
  circle: "Нажмите и потяните от центра, чтобы задать радиус круга.",
  freehand: "Ведите пальцем по экрану — область нарисуется по вашей траектории.",
  line: "Нажимайте на карту, чтобы добавлять точки линии. Завершите кнопкой «Готово».",
  point: "Нажмите на карту, чтобы поставить точечную метку.",
  edit: "Перетаскивайте узлы, чтобы изменить форму зоны.",
  move: "Перетащите зону в нужное место.",
  none: "",
};

export class MapEngine {
  map: L.Map;
  private shapes = new Map<string, Internal>();
  private order: string[] = [];
  private mode: DrawMode = "select";
  private activeStyle: ShapeStyle = CATEGORY_PRESETS[0].style;
  private activeCategory: string = CATEGORY_PRESETS[0].id;
  private selectedId: string | null = null;
  private cb: EngineCallbacks;

  // Draw-in-progress state
  private draftPoints: L.LatLng[] = [];
  private draftLayer: L.Polyline | L.Polygon | null = null;
  private draftMarkers: L.CircleMarker[] = [];
  private dragStart: L.LatLng | null = null;
  private dragPreview: L.Layer | null = null;
  private pointerActive = false;

  // Vertex editing
  private editHandles: L.CircleMarker[] = [];
  private editRadiusHandle: L.CircleMarker | null = null;

  // Move
  private moveFrom: L.LatLng | null = null;

  // History
  private undoStack: Snapshot[][] = [];
  private redoStack: Snapshot[][] = [];

  constructor(container: HTMLDivElement, callbacks: EngineCallbacks) {
    this.cb = callbacks;
    this.map = L.map(container, {
      center: [55.751244, 37.618423],
      zoom: 10,
      zoomControl: false,
      attributionControl: true,
      renderer: L.svg(),
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    L.control.zoom({ position: "bottomright" }).addTo(this.map);

    this.bindEvents();
    this.pushHistory();
  }

  private bindEvents() {
    this.map.on("click", this.handleMapClick);
    const pane = this.map.getContainer();
    pane.addEventListener("pointerdown", this.handlePointerDown);
    pane.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
  }

  destroy() {
    const pane = this.map.getContainer();
    pane.removeEventListener("pointerdown", this.handlePointerDown);
    pane.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.map.remove();
  }

  // ---------- Mode management ----------
  setMode(mode: DrawMode) {
    this.cancelDrawing();
    this.clearEditHandles();
    this.mode = mode;
    const dragToolModes: DrawMode[] = ["rectangle", "circle", "freehand"];
    this.map.dragging[dragToolModes.includes(mode) ? "disable" : "enable"]();
    if (mode === "edit" && this.selectedId) {
      this.buildEditHandles(this.selectedId);
    }
    this.cb.onModeChange(mode);
    this.cb.onHint(HINTS[mode] ?? "");
  }

  getMode() {
    return this.mode;
  }

  setActiveStyle(style: ShapeStyle) {
    this.activeStyle = style;
  }

  setActiveCategory(categoryId: string) {
    this.activeCategory = categoryId;
  }

  // ---------- Map click (polygon / line / point vertex adding) ----------
  private handleMapClick = (e: L.LeafletMouseEvent) => {
    if (this.mode === "select" || this.mode === "edit" || this.mode === "move") {
      if (this.selectedId) this.selectShape(null);
      return;
    }
    if (this.mode === "point") {
      this.createPointMarker(e.latlng);
      return;
    }
    if (this.mode === "polygon" || this.mode === "line") {
      this.addDraftPoint(e.latlng);
    }
  };

  private addDraftPoint(latlng: L.LatLng) {
    this.draftPoints.push(latlng);
    const marker = L.circleMarker(latlng, {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: this.activeStyle.color,
      fillOpacity: 1,
    }).addTo(this.map);

    if (this.draftPoints.length === 1) {
      marker.on("click", (evt) => {
        L.DomEvent.stopPropagation(evt);
        if (this.mode === "polygon" && this.draftPoints.length >= 3) {
          this.finishDrawing();
        }
      });
    }
    this.draftMarkers.push(marker);
    this.redrawDraft();
  }

  private redrawDraft() {
    if (this.draftLayer) {
      this.map.removeLayer(this.draftLayer);
      this.draftLayer = null;
    }
    if (this.draftPoints.length < 2) return;
    const isPolygon = this.mode === "polygon";
    if (isPolygon) {
      const layer = L.polygon(this.draftPoints, { color: this.activeStyle.color, weight: 2, dashArray: "6,6", fillOpacity: 0.1 });
      this.draftLayer = layer;
      layer.addTo(this.map);
    } else {
      const layer = L.polyline(this.draftPoints, { color: this.activeStyle.color, weight: 3, dashArray: "6,6" });
      this.draftLayer = layer;
      layer.addTo(this.map);
    }
  }

  undoLastPoint() {
    if (!this.draftPoints.length) return;
    this.draftPoints.pop();
    const m = this.draftMarkers.pop();
    if (m) this.map.removeLayer(m);
    this.redrawDraft();
  }

  finishDrawing() {
    const min = this.mode === "line" ? 2 : 3;
    if (this.draftPoints.length >= min) {
      if (this.mode === "polygon") {
        this.commitShape("polygon", this.draftPoints.slice());
      } else if (this.mode === "line") {
        this.commitShape("line", this.draftPoints.slice());
      }
    }
    this.resetDraft();
  }

  cancelDrawing() {
    this.resetDraft();
    if (this.dragPreview) {
      this.map.removeLayer(this.dragPreview);
      this.dragPreview = null;
    }
    this.dragStart = null;
    this.pointerActive = false;
  }

  private resetDraft() {
    this.draftPoints = [];
    this.draftMarkers.forEach((m) => this.map.removeLayer(m));
    this.draftMarkers = [];
    if (this.draftLayer) {
      this.map.removeLayer(this.draftLayer);
      this.draftLayer = null;
    }
  }

  // ---------- Pointer-drag tools: rectangle, circle, freehand, move, edit-handle ----------
  private handlePointerDown = (ev: PointerEvent) => {
    if (!["rectangle", "circle", "freehand"].includes(this.mode)) return;
    if (ev.button !== undefined && ev.button > 0) return;
    const latlng = this.eventToLatLng(ev);
    if (!latlng) return;
    this.pointerActive = true;
    this.dragStart = latlng;
    if (this.mode === "freehand") {
      this.draftPoints = [latlng];
    }
  };

  private handlePointerMove = (ev: PointerEvent) => {
    if (!this.pointerActive || !this.dragStart) return;
    const latlng = this.eventToLatLng(ev);
    if (!latlng) return;

    if (this.dragPreview) {
      this.map.removeLayer(this.dragPreview);
      this.dragPreview = null;
    }

    if (this.mode === "rectangle") {
      const bounds = L.latLngBounds(this.dragStart, latlng);
      this.dragPreview = L.rectangle(bounds, {
        color: this.activeStyle.color,
        weight: 2,
        dashArray: "6,6",
        fillOpacity: 0.1,
      }).addTo(this.map);
    } else if (this.mode === "circle") {
      const radius = this.map.distance(this.dragStart, latlng);
      this.dragPreview = L.circle(this.dragStart, {
        radius,
        color: this.activeStyle.color,
        weight: 2,
        dashArray: "6,6",
        fillOpacity: 0.1,
      }).addTo(this.map);
    } else if (this.mode === "freehand") {
      this.draftPoints.push(latlng);
      this.dragPreview = L.polygon(this.draftPoints, {
        color: this.activeStyle.color,
        weight: 2,
        dashArray: "6,6",
        fillOpacity: 0.1,
      }).addTo(this.map);
    }
  };

  private handlePointerUp = () => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    if (this.dragPreview) {
      this.map.removeLayer(this.dragPreview);
      this.dragPreview = null;
    }
    if (this.mode === "rectangle" && this.dragStart) {
      const last = this.lastMoveLatLng;
      if (last && this.map.distance(this.dragStart, last) > 5) {
        const b = L.latLngBounds(this.dragStart, last);
        this.commitShape("rectangle", [b.getSouthWest(), b.getNorthWest(), b.getNorthEast(), b.getSouthEast()]);
      }
    } else if (this.mode === "circle" && this.dragStart) {
      const last = this.lastMoveLatLng;
      if (last) {
        const radius = this.map.distance(this.dragStart, last);
        if (radius > 5) this.commitCircle(this.dragStart, radius);
      }
    } else if (this.mode === "freehand" && this.draftPoints.length >= 3) {
      this.commitShape("freehand", this.draftPoints.slice());
    }
    this.dragStart = null;
    this.draftPoints = [];
  };

  private lastMoveLatLng: L.LatLng | null = null;

  private eventToLatLng(ev: PointerEvent): L.LatLng | null {
    const rect = this.map.getContainer().getBoundingClientRect();
    const point = L.point(ev.clientX - rect.left, ev.clientY - rect.top);
    const latlng = this.map.containerPointToLatLng(point);
    this.lastMoveLatLng = latlng;
    return latlng;
  }

  // ---------- Commit helpers ----------
  private commitShape(kind: ShapeKind, points: L.LatLng[], categoryId = this.activeCategory, style: ShapeStyle = this.activeStyle) {
    const id = uid();
    let layer: L.Path;
    if (kind === "line") {
      layer = L.polyline(points, {});
    } else {
      layer = L.polygon(points, {});
    }
    layer.addTo(this.map);
    applyShapeStyle(layer, style);
    this.attachSelectHandler(layer, id);
    const preset = CATEGORY_PRESETS.find((p) => p.id === categoryId);
    const record: Internal = {
      id,
      kind,
      layer,
      style: { ...style },
      categoryId,
      name: preset ? preset.label : "Зона",
      visible: true,
    };
    this.shapes.set(id, record);
    this.order.push(id);
    this.pushHistory();
    this.emitChange();
    this.selectShape(id);
  }

  private commitCircle(center: L.LatLng, radius: number, categoryId = this.activeCategory, style: ShapeStyle = this.activeStyle) {
    const id = uid();
    const layer = L.circle(center, { radius });
    layer.addTo(this.map);
    applyShapeStyle(layer, style);
    this.attachSelectHandler(layer, id);
    const preset = CATEGORY_PRESETS.find((p) => p.id === categoryId);
    const record: Internal = {
      id,
      kind: "circle",
      layer,
      style: { ...style },
      categoryId,
      name: preset ? preset.label : "Зона",
      visible: true,
      center,
      radius,
    };
    this.shapes.set(id, record);
    this.order.push(id);
    this.pushHistory();
    this.emitChange();
    this.selectShape(id);
  }

  private createPointMarker(latlng: L.LatLng) {
    const id = uid();
    const layer = L.circleMarker(latlng, { radius: 10 });
    layer.addTo(this.map);
    applyShapeStyle(layer, this.activeStyle);
    this.attachSelectHandler(layer, id);
    const preset = CATEGORY_PRESETS.find((p) => p.id === this.activeCategory);
    const record: Internal = {
      id,
      kind: "point",
      layer,
      style: { ...this.activeStyle },
      categoryId: this.activeCategory,
      name: preset ? preset.label : "Метка",
      visible: true,
      center: latlng,
    };
    this.shapes.set(id, record);
    this.order.push(id);
    this.pushHistory();
    this.emitChange();
    this.selectShape(id);
  }

  private attachSelectHandler(layer: L.Layer, id: string) {
    layer.on("click", (e) => {
      L.DomEvent.stopPropagation(e as unknown as Event);
      if (this.mode === "select" || this.mode === "edit" || this.mode === "move") {
        this.selectShape(id);
        if (this.mode !== "select") this.setMode(this.mode);
      }
    });
    layer.on("pointerdown" as never, () => undefined);
    (layer as L.Path).on("mousedown", (e) => {
      if (this.mode !== "move" || this.selectedId !== id) return;
      L.DomEvent.stopPropagation(e as unknown as Event);
      this.moveFrom = (e as L.LeafletMouseEvent).latlng;
      const onMove = (ev: L.LeafletMouseEvent) => {
        if (!this.moveFrom) return;
        const dLat = ev.latlng.lat - this.moveFrom.lat;
        const dLng = ev.latlng.lng - this.moveFrom.lng;
        this.translateShape(id, dLat, dLng);
        this.moveFrom = ev.latlng;
      };
      const onUp = () => {
        this.map.off("mousemove", onMove);
        this.map.off("mouseup", onUp);
        this.moveFrom = null;
        this.pushHistory();
      };
      this.map.on("mousemove", onMove);
      this.map.on("mouseup", onUp);
    });
  }

  private translateShape(id: string, dLat: number, dLng: number) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    if (rec.kind === "circle" || rec.kind === "point") {
      const c = rec.center!;
      const nc = L.latLng(c.lat + dLat, c.lng + dLng);
      rec.center = nc;
      (rec.layer as L.Circle | L.CircleMarker).setLatLng(nc);
    } else {
      const poly = rec.layer as L.Polygon | L.Polyline;
      const latlngs = poly.getLatLngs() as L.LatLng[];
      const moved = latlngs.map((p) => L.latLng(p.lat + dLat, p.lng + dLng));
      poly.setLatLngs(moved);
    }
  }

  // ---------- Selection ----------
  selectShape(id: string | null) {
    this.selectedId = id;
    this.clearEditHandles();
    if (id && this.mode === "edit") this.buildEditHandles(id);
    const rec = id ? this.shapes.get(id) : null;
    this.cb.onSelectionChange(id, rec ? rec.style : null);
  }

  getSelectedId() {
    return this.selectedId;
  }

  // ---------- Vertex editing ----------
  private buildEditHandles(id: string) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    this.clearEditHandles();

    if (rec.kind === "circle") {
      const c = rec.center!;
      const edgePoint = this.destinationPoint(c, rec.radius ?? 0);
      const handle = L.circleMarker(edgePoint, {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#111827",
        fillOpacity: 1,
      }).addTo(this.map);
      handle.on("mousedown", (e) => {
        L.DomEvent.stopPropagation(e as unknown as Event);
        const onMove = (ev: L.LeafletMouseEvent) => {
          const newRadius = this.map.distance(c, ev.latlng);
          rec.radius = newRadius;
          (rec.layer as L.Circle).setRadius(newRadius);
          handle.setLatLng(this.destinationPoint(c, newRadius));
        };
        const onUp = () => {
          this.map.off("mousemove", onMove);
          this.map.off("mouseup", onUp);
          this.pushHistory();
        };
        this.map.on("mousemove", onMove);
        this.map.on("mouseup", onUp);
      });
      this.editRadiusHandle = handle;
      return;
    }

    if (rec.kind === "point") return;

    const poly = rec.layer as L.Polygon | L.Polyline;
    const latlngs = poly.getLatLngs() as L.LatLng[];
    latlngs.forEach((ll, idx) => {
      const handle = L.circleMarker(ll, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#111827",
        fillOpacity: 1,
      }).addTo(this.map);
      handle.on("mousedown", (e) => {
        L.DomEvent.stopPropagation(e as unknown as Event);
        const onMove = (ev: L.LeafletMouseEvent) => {
          const current = poly.getLatLngs() as L.LatLng[];
          current[idx] = ev.latlng;
          poly.setLatLngs(current);
          handle.setLatLng(ev.latlng);
        };
        const onUp = () => {
          this.map.off("mousemove", onMove);
          this.map.off("mouseup", onUp);
          this.pushHistory();
        };
        this.map.on("mousemove", onMove);
        this.map.on("mouseup", onUp);
      });
      this.editHandles.push(handle);
    });
  }

  private destinationPoint(center: L.LatLng, meters: number): L.LatLng {
    const point = this.map.project(center);
    const scale = this.map.getZoom();
    const metersPerPixel = 40075016.686 * Math.abs(Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, scale + 8);
    const pixels = meters / (metersPerPixel || 1);
    const dest = L.point(point.x + pixels, point.y);
    return this.map.unproject(dest, scale);
  }

  private clearEditHandles() {
    this.editHandles.forEach((h) => this.map.removeLayer(h));
    this.editHandles = [];
    if (this.editRadiusHandle) {
      this.map.removeLayer(this.editRadiusHandle);
      this.editRadiusHandle = null;
    }
  }

  refreshEditHandles() {
    if (this.mode === "edit" && this.selectedId) this.buildEditHandles(this.selectedId);
  }

  // ---------- Style application ----------
  applyStyleToSelected(style: ShapeStyle) {
    if (!this.selectedId) return;
    const rec = this.shapes.get(this.selectedId);
    if (!rec) return;
    rec.style = { ...style };
    applyShapeStyle(rec.layer as L.Path, style);
    this.pushHistory();
    this.emitChange();
  }

  applyCategoryToSelected(categoryId: string, style: ShapeStyle) {
    if (!this.selectedId) return;
    const rec = this.shapes.get(this.selectedId);
    if (!rec) return;
    rec.categoryId = categoryId;
    rec.style = { ...style };
    const preset = CATEGORY_PRESETS.find((p) => p.id === categoryId);
    if (preset) rec.name = preset.label;
    applyShapeStyle(rec.layer as L.Path, style);
    this.pushHistory();
    this.emitChange();
  }

  // ---------- Delete / duplicate / clear ----------
  deleteSelected() {
    if (!this.selectedId) return;
    this.deleteShape(this.selectedId);
  }

  deleteShape(id: string) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    this.map.removeLayer(rec.layer);
    this.shapes.delete(id);
    this.order = this.order.filter((o) => o !== id);
    if (this.selectedId === id) this.selectShape(null);
    this.clearEditHandles();
    this.pushHistory();
    this.emitChange();
  }

  duplicateSelected() {
    if (!this.selectedId) return;
    const rec = this.shapes.get(this.selectedId);
    if (!rec) return;
    const offset = 0.01;
    if (rec.kind === "circle" || rec.kind === "point") {
      const c = rec.center!;
      const nc = L.latLng(c.lat + offset, c.lng + offset);
      if (rec.kind === "circle") this.commitCircle(nc, rec.radius ?? 500, rec.categoryId, rec.style);
      else this.createPointMarkerWith(nc, rec.categoryId, rec.style);
    } else {
      const poly = rec.layer as L.Polygon | L.Polyline;
      const latlngs = (poly.getLatLngs() as L.LatLng[]).map((p) => L.latLng(p.lat + offset, p.lng + offset));
      this.commitShape(rec.kind, latlngs, rec.categoryId, rec.style);
    }
  }

  private createPointMarkerWith(latlng: L.LatLng, categoryId: string, style: ShapeStyle) {
    const prevCat = this.activeCategory;
    const prevStyle = this.activeStyle;
    this.activeCategory = categoryId;
    this.activeStyle = style;
    this.createPointMarker(latlng);
    this.activeCategory = prevCat;
    this.activeStyle = prevStyle;
  }

  clearAll() {
    this.order.forEach((id) => {
      const rec = this.shapes.get(id);
      if (rec) this.map.removeLayer(rec.layer);
    });
    this.shapes.clear();
    this.order = [];
    this.selectShape(null);
    this.pushHistory();
    this.emitChange();
  }

  toggleVisibility(id: string) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    rec.visible = !rec.visible;
    if (rec.visible) rec.layer.addTo(this.map);
    else this.map.removeLayer(rec.layer);
    this.emitChange();
  }

  renameShape(id: string, name: string) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    rec.name = name;
    this.emitChange();
  }

  zoomToShape(id: string) {
    const rec = this.shapes.get(id);
    if (!rec) return;
    if (rec.kind === "circle" || rec.kind === "point") {
      this.map.setView(rec.center!, Math.max(this.map.getZoom(), 12), { animate: true });
    } else {
      const poly = rec.layer as L.Polygon;
      this.map.fitBounds(poly.getBounds(), { padding: [60, 60], animate: true });
    }
  }

  locate() {
    this.map.locate({ setView: true, maxZoom: 13 });
  }

  resetView() {
    this.map.setView([55.751244, 37.618423], 10, { animate: true });
  }

  // ---------- History ----------
  private snapshotAll(): Snapshot[] {
    return this.order.map((id) => {
      const rec = this.shapes.get(id)!;
      const snap: Snapshot = {
        id: rec.id,
        kind: rec.kind,
        categoryId: rec.categoryId,
        name: rec.name,
        style: { ...rec.style },
        visible: rec.visible,
      };
      if (rec.kind === "circle" || rec.kind === "point") {
        snap.center = [rec.center!.lat, rec.center!.lng];
        snap.radius = rec.radius;
      } else {
        const poly = rec.layer as L.Polygon | L.Polyline;
        snap.latlngs = (poly.getLatLngs() as L.LatLng[]).map((p) => [p.lat, p.lng]);
      }
      return snap;
    });
  }

  private pushHistory() {
    this.undoStack.push(this.snapshotAll());
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.cb.onHistoryChange(this.undoStack.length > 1, this.redoStack.length > 0);
  }

  private restoreSnapshot(snaps: Snapshot[]) {
    this.order.forEach((id) => {
      const rec = this.shapes.get(id);
      if (rec) this.map.removeLayer(rec.layer);
    });
    this.shapes.clear();
    this.order = [];
    this.clearEditHandles();

    snaps.forEach((snap) => {
      let layer: L.Path;
      if (snap.kind === "circle") {
        layer = L.circle([snap.center![0], snap.center![1]], { radius: snap.radius ?? 500 });
      } else if (snap.kind === "point") {
        layer = L.circleMarker([snap.center![0], snap.center![1]], { radius: 10 });
      } else if (snap.kind === "line") {
        layer = L.polyline(snap.latlngs!.map((p) => L.latLng(p[0], p[1])), {});
      } else {
        layer = L.polygon(snap.latlngs!.map((p) => L.latLng(p[0], p[1])), {});
      }
      applyShapeStyle(layer, snap.style);
      this.attachSelectHandler(layer, snap.id);
      if (snap.visible) layer.addTo(this.map);
      const rec: Internal = {
        id: snap.id,
        kind: snap.kind,
        layer,
        style: snap.style,
        categoryId: snap.categoryId,
        name: snap.name,
        visible: snap.visible,
        center: snap.center ? L.latLng(snap.center[0], snap.center[1]) : undefined,
        radius: snap.radius,
      };
      this.shapes.set(snap.id, rec);
      this.order.push(snap.id);
    });

    this.selectShape(null);
    this.emitChange();
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    this.restoreSnapshot(prev);
    this.cb.onHistoryChange(this.undoStack.length > 1, this.redoStack.length > 0);
  }

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.restoreSnapshot(next);
    this.cb.onHistoryChange(this.undoStack.length > 1, this.redoStack.length > 0);
  }

  // ---------- Export / Import ----------
  exportGeoJSON(): string {
    const features = this.order.map((id) => {
      const rec = this.shapes.get(id)!;
      let geometry: GeoJSON.Geometry;
      if (rec.kind === "circle" || rec.kind === "point") {
        geometry = { type: "Point", coordinates: [rec.center!.lng, rec.center!.lat] };
      } else {
        const poly = rec.layer as L.Polygon | L.Polyline;
        const latlngs = poly.getLatLngs() as L.LatLng[];
        const coords = latlngs.map((p) => [p.lng, p.lat]);
        if (rec.kind === "line") {
          geometry = { type: "LineString", coordinates: coords };
        } else {
          geometry = { type: "Polygon", coordinates: [[...coords, coords[0]]] };
        }
      }
      return {
        type: "Feature",
        properties: {
          id: rec.id,
          name: rec.name,
          categoryId: rec.categoryId,
          style: rec.style,
          radius: rec.radius,
        },
        geometry,
      };
    });
    return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
  }

  importGeoJSON(json: string) {
    try {
      const data = JSON.parse(json);
      const snaps: Snapshot[] = (data.features ?? []).map((f: {
        properties: { id?: string; name?: string; categoryId?: string; style?: ShapeStyle; radius?: number };
        geometry: { type: string; coordinates: unknown };
      }) => {
        const props = f.properties ?? {};
        const geom = f.geometry;
        const id = props.id ?? uid();
        const style: ShapeStyle = props.style ?? CATEGORY_PRESETS[0].style;
        if (geom.type === "Point") {
          const [lng, lat] = geom.coordinates as [number, number];
          const kind: ShapeKind = props.radius ? "circle" : "point";
          return {
            id,
            kind,
            categoryId: props.categoryId ?? "custom",
            name: props.name ?? "Зона",
            style,
            visible: true,
            center: [lat, lng],
            radius: props.radius,
          } as Snapshot;
        }
        if (geom.type === "LineString") {
          const coords = geom.coordinates as [number, number][];
          return {
            id,
            kind: "line",
            categoryId: props.categoryId ?? "custom",
            name: props.name ?? "Линия",
            style,
            visible: true,
            latlngs: coords.map((c) => [c[1], c[0]] as [number, number]),
          } as Snapshot;
        }
        const coords = (geom.coordinates as [number, number][][])[0].slice(0, -1);
        return {
          id,
          kind: "polygon",
          categoryId: props.categoryId ?? "custom",
          name: props.name ?? "Зона",
          style,
          visible: true,
          latlngs: coords.map((c) => [c[1], c[0]] as [number, number]),
        } as Snapshot;
      });
      this.restoreSnapshot(snaps);
      this.pushHistory();
    } catch (err) {
      console.error("Не удалось загрузить GeoJSON", err);
    }
  }

  // ---------- Getters for UI ----------
  emitChange() {
    const list: ShapeRecord[] = this.order.map((id) => {
      const rec = this.shapes.get(id)!;
      return {
        id: rec.id,
        kind: rec.kind,
        name: rec.name,
        categoryId: rec.categoryId,
        style: rec.style,
        visible: rec.visible,
      };
    });
    this.cb.onChange(list);
  }
}
