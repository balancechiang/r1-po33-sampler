/** A reusable 32-square SVG indicator. No framework or animation required. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PO33Indicator = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SEGMENT_COUNT = 32;
  const SVG_NS = "http://www.w3.org/2000/svg";

  /**
   * @typedef {Object} IndicatorProps
   * @property {"pitch"|"trim"|"level"} mode
   * @property {number} [pitch=0] Semitone offset; 2 squares per semitone.
   * @property {number} [start=0] Trim start, in percent (0–100).
   * @property {number} [length=100] Trim length, in percent (0–100).
   * @property {number} [value=0] Level/FX count (0–32).
   * @property {string} [onColor="#fff"] Solid active color.
   * @property {string} [offColor="#222"] Solid inactive color.
   */

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }

  /** Pure mapping, also usable by a canvas or another UI framework.
   * @param {IndicatorProps} props
   * @returns {boolean[]} Exactly 32 states, ordered left to right.
   */
  function segments(props) {
    const result = Array(SEGMENT_COUNT).fill(false);
    if (props.mode === "pitch") {
      const value = Number(props.pitch);
      const pitch = Number.isFinite(value) ? clamp(value, -8, 8) : 0;
      const count = Math.round(Math.abs(pitch) * 2);
      // The center is between 15 and 16; neutral shows these two squares.
      if (count === 0) result[15] = result[16] = true;
      for (let i = 0; i < count; i++) result[pitch < 0 ? 15 - i : 16 + i] = true;
    } else if (props.mode === "trim") {
      const start = clamp(props.start === undefined ? 0 : props.start, 0, 100);
      const length = clamp(props.length === undefined ? 100 : props.length, 0, 100 - start);
      const first = Math.floor(start * SEGMENT_COUNT / 100);
      const end = Math.min(SEGMENT_COUNT, Math.ceil((start + length) * SEGMENT_COUNT / 100));
      if (length > 0) for (let i = first; i < end; i++) result[i] = true;
    } else if (props.mode === "level") {
      const count = Math.round(clamp(props.value === undefined ? 0 : props.value, 0, SEGMENT_COUNT));
      for (let i = 0; i < count; i++) result[i] = true;
    } else {
      throw new TypeError('Indicator mode must be "pitch", "trim" or "level".');
    }
    return result;
  }

  /**
   * Create the squares once, then update their fill colors in place.
   * @param {SVGGElement} container Existing empty SVG <g> element.
   * @param {IndicatorProps} initialProps
   * @param {{x?:number,y?:number,size?:number,gap?:number}} [layout]
   * @returns {{setProps: function(Partial<IndicatorProps>): void, destroy: function(): void}}
   */
  function create(container, initialProps, layout) {
    const geometry = Object.assign({ x: 0, y: 0, size: 4.5, gap: 1.8 }, layout);
    let props = Object.assign({ mode: "level", value: 0, pitch: 0, start: 0, length: 100,
      onColor: "#fff", offColor: "#222" }, initialProps);
    // Validate before touching an existing drawing.
    segments(props);
    container.replaceChildren();
    container.setAttribute("role", "img");
    const squares = Array.from({ length: SEGMENT_COUNT }, function (_, i) {
      const square = container.ownerDocument.createElementNS(SVG_NS, "rect");
      square.setAttribute("x", geometry.x + i * (geometry.size + geometry.gap));
      square.setAttribute("y", geometry.y);
      square.setAttribute("width", geometry.size);
      square.setAttribute("height", geometry.size);
      square.setAttribute("data-segment", i);
      container.appendChild(square);
      return square;
    });

    function setProps(nextProps) {
      const next = Object.assign({}, props, nextProps);
      const active = segments(next);
      props = next;
      squares.forEach(function (square, i) {
        const color = active[i] ? props.onColor : props.offColor;
        if (square.getAttribute("fill") !== color) square.setAttribute("fill", color);
        square.setAttribute("data-active", String(active[i]));
      });
      container.setAttribute("data-indicator-mode", props.mode);
      const detail = props.mode === "pitch" ? props.pitch + " semitones"
        : props.mode === "trim" ? props.start + "% start, " + props.length + "% length"
        : clamp(props.value, 0, SEGMENT_COUNT) + "/32";
      container.setAttribute("aria-label", props.mode + ": " + detail);
    }

    setProps(props);
    return {
      setProps: setProps,
      destroy: function () {
        squares.forEach(function (square) { square.remove(); });
        container.removeAttribute("role");
        container.removeAttribute("aria-label");
        container.removeAttribute("data-indicator-mode");
      }
    };
  }

  return { SEGMENT_COUNT: SEGMENT_COUNT, segments: segments, create: create };
});
