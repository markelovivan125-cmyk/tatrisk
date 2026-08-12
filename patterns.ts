import L from "leaflet";
import type { FillType } from "../types/shapes";

const SVG_NS = "http://www.w3.org/2000/svg";

function hashColor(color: string) {
  return color.replace("#", "");
}

/**
 * Makes sure the map's SVG renderer has a <defs> node we control,
 * then lazily creates (and caches) a <pattern> element for the
 * requested fill type + color combination. Returns the pattern id
 * so it can be referenced via `url(#id)`.
 */
export function ensurePattern(map: L.Map, fillType: FillType, color: string): string | null {
  if (fillType === "solid") return null;

  const renderer = getSvgRenderer(map);
  if (!renderer) return null;

  const svg: SVGElement = (renderer as unknown as { _container: SVGElement })._container;
  let defs = svg.querySelector("defs.zone-defs") as SVGDefsElement | null;
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
    defs.setAttribute("class", "zone-defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const id = `zone-pattern-${fillType}-${hashColor(color)}`;
  if (defs.querySelector(`#${id}`)) return id;

  const pattern = document.createElementNS(SVG_NS, "pattern");
  pattern.setAttribute("id", id);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");

  if (fillType === "dots") {
    pattern.setAttribute("width", "14");
    pattern.setAttribute("height", "14");
    const c1 = document.createElementNS(SVG_NS, "circle");
    c1.setAttribute("cx", "3.5");
    c1.setAttribute("cy", "3.5");
    c1.setAttribute("r", "2.1");
    c1.setAttribute("fill", color);
    const c2 = document.createElementNS(SVG_NS, "circle");
    c2.setAttribute("cx", "10.5");
    c2.setAttribute("cy", "10.5");
    c2.setAttribute("r", "2.1");
    c2.setAttribute("fill", color);
    pattern.appendChild(c1);
    pattern.appendChild(c2);
  } else if (fillType === "hatch") {
    pattern.setAttribute("width", "8");
    pattern.setAttribute("height", "8");
    pattern.setAttribute("patternTransform", "rotate(45)");
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", "8");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "3");
    pattern.appendChild(line);
  }

  defs.appendChild(pattern);
  return id;
}

function getSvgRenderer(map: L.Map): L.Renderer | null {
  const anyMap = map as unknown as { _renderer?: L.Renderer };
  const renderer = map.getRenderer(L.polyline([]));
  return renderer ?? anyMap._renderer ?? null;
}

/** Applies fill (pattern or solid) + stroke dash to a live Leaflet path layer. */
export function applyShapeStyle(
  layer: L.Path,
  style: { color: string; lineStyle: "solid" | "dashed"; fillType: FillType; opacity: number; weight: number }
) {
  const dashArray = style.lineStyle === "dashed" ? "10, 8" : undefined;

  layer.setStyle({
    color: style.color,
    weight: style.weight,
    opacity: 1,
    dashArray,
    fillColor: style.color,
    fillOpacity: style.opacity,
    fill: true,
  });

  const map = (layer as unknown as { _map?: L.Map })._map;
  const path = (layer as unknown as { _path?: SVGPathElement })._path;
  if (!map || !path) return;

  if (style.fillType === "solid") {
    path.setAttribute("fill", style.color);
  } else {
    const patternId = ensurePattern(map, style.fillType, style.color);
    if (patternId) {
      path.setAttribute("fill", `url(#${patternId})`);
    }
  }
}
