/** A reusable 38-square SVG indicator. No framework or animation required. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PO33Indicator = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SEGMENT_COUNT = 38;
  const SVG_NS = "http://www.w3.org/2000/svg";

  /**
   * @typedef {Object} IndicatorProps
   * @property {"pitch"|"trim"|"level"|"filter"|"meter"} mode
   * @property {number} [peak=0] Symmetric peak extent (0–38), meter mode only.
   * @property {number[]} [trail] Per-cell fading persistence (0–1), meter mode only.
   * @property {number} [cutoff=0] Signed filter position (-100 to 100).
   * @property {number} [pitch=0] Semitone offset; 2 squares per semitone.
   * @property {number} [start=0] Trim start, in percent (0–100).
   * @property {number} [length=100] Trim length, in percent (0–100).
   * @property {number} [value=0] Level/FX count (0–38).
   * @property {"left"|"center"} [origin="left"] Level fill direction; center uses symmetric pairs.
   * @property {string} [onColor="#fff"] Solid active color.
   * @property {string} [offColor="#222"] Solid inactive color.
   */

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }

  /** Pure mapping, also usable by a canvas or another UI framework.
   * @param {IndicatorProps} props
   * @returns {boolean[]} Exactly 38 states, ordered left to right.
   */
  // Audio-clock-independent display ballistics; these timings are visual approximations.
  class Meter {
    constructor(){this.reset();}
    reset(){this.last=null;this.body=0;this.peak=0;this.hold=0;this.trail=Array(SEGMENT_COUNT).fill(0);}
    update(rms,peak,time){
      const dt=this.last===null?0:Math.min(100,Math.max(0,time-this.last));this.last=time;
      const scale=v=>v>.0005?clamp(v*1.5,0,1)*SEGMENT_COUNT:0;
      const target=scale(rms),top=Math.max(target,scale(peak));
      this.body=target+(this.body-target)*Math.exp(-dt/(target>this.body?25:140));
      if(top>this.peak){this.peak=top;this.hold=time+240;}
      else if(time>this.hold)this.peak=Math.max(top,this.peak-dt*SEGMENT_COUNT/650);
      if(target===0 && this.body<.4)this.body=0;
      if(top===0 && this.peak<.4)this.peak=0;
      const active=segments({mode:'level',origin:'center',value:Math.floor(this.body)});
      this.trail=this.trail.map((v,i)=>active[i]?1:v*Math.exp(-dt/130));
      return {mode:'meter',origin:'center',value:Math.floor(this.body),peak:this.peak,trail:this.trail.slice()};
    }
  }
  function segments(props) {
    const result = Array(SEGMENT_COUNT).fill(false);
    if (props.mode === "pitch") {
      const value = Number(props.pitch);
      const pitch = Number.isFinite(value) ? clamp(value, -8, 8) : 0;
      const count = Math.round(Math.abs(pitch) * 2);
      // The center is between 18 and 19; neutral shows these two squares.
      if (count === 0) result[18] = result[19] = true;
      for (let i = 0; i < count; i++) result[pitch < 0 ? 18 - i : 19 + i] = true;
    } else if (props.mode === "filter") {
      const value=clamp(props.cutoff || 0,-100,100);
      if(Math.abs(value)<=4)result[18]=true;
      else {const count=Math.round((1-Math.abs(value)/100)*SEGMENT_COUNT);for(let i=0;i<count;i++)result[value<0?i:SEGMENT_COUNT-1-i]=true;}
    } else if (props.mode === "trim") {
      const start = clamp(props.start === undefined ? 0 : props.start, 0, 100);
      const length = clamp(props.length === undefined ? 100 : props.length, 0, 100 - start);
      const first = Math.floor(start * SEGMENT_COUNT / 100);
      const end = Math.min(SEGMENT_COUNT, Math.ceil((start + length) * SEGMENT_COUNT / 100));
      if (length > 0) for (let i = first; i < end; i++) result[i] = true;
    } else if ((props.mode === "level" || props.mode === "meter")) {
      const count = Math.round(clamp(props.value === undefined ? 0 : props.value, 0, SEGMENT_COUNT));
      if (props.origin === "center") {
        const pairs = Math.ceil(count / 2);
        for (let i = 0; i < pairs; i++) result[18 - i] = result[19 + i] = true;
      } else {
        for (let i = 0; i < count; i++) result[i] = true;
      }
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
    const geometry = Object.assign({ x: 0, y: 0, size: 4.5*199.8/237.6, gap: 1.8*199.8/237.6 }, layout);
    let props = Object.assign({ mode: "level", value: 0, origin: "left", pitch: 0, start: 0, length: 100,
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

    const dots=Array.from({length:2},()=>{const dot=container.ownerDocument.createElementNS(SVG_NS,'circle');dot.setAttribute('r',geometry.size*.26);dot.setAttribute('cy',geometry.y+geometry.size/2);dot.setAttribute('data-peak-dot','');container.appendChild(dot);return dot;});
    function setProps(nextProps) {
      const next = Object.assign({}, props, nextProps);
      const active = segments(next);
      props = next;
      squares.forEach(function (square, i) {
        const ghost=props.mode==='meter' && !active[i] ? clamp((props.trail || [])[i] || 0,0,1)*.38:0;
        const color = active[i] ? props.onColor : ghost>.025?'#'+Array(3).fill(Math.round(34+221*ghost).toString(16).padStart(2,'0')).join(''):props.offColor;
        square.setAttribute('data-trail',ghost>.025?'true':'false');
        if (square.getAttribute("fill") !== color) square.setAttribute("fill", color);
        square.setAttribute("data-active", String(active[i]));
      });
      const extent=Math.ceil(clamp(props.peak || 0,0,SEGMENT_COUNT)/2);
      dots.forEach((dot,i)=>{dot.setAttribute('cx',geometry.x+(i===0?19-extent:18+extent)*(geometry.size+geometry.gap)+geometry.size/2);dot.setAttribute('fill',props.mode==='meter'?props.onColor:props.offColor);dot.setAttribute('visibility',props.mode==='meter' && extent>0?'visible':'hidden');});
      container.setAttribute("data-indicator-mode", props.mode);
      container.setAttribute("data-indicator-origin", (props.mode === "level" || props.mode === "meter") ? props.origin : "");
      const detail = props.mode === "pitch" ? props.pitch + " semitones"
        : props.mode === "trim" ? props.start + "% start, " + props.length + "% length"
        : clamp(props.value, 0, SEGMENT_COUNT) + "/38";
      container.setAttribute("aria-label", props.mode + ": " + detail);
    }

    setProps(props);
    return {
      setProps: setProps,
      destroy: function () {
        squares.concat(dots).forEach(function (square) { square.remove(); });
        container.removeAttribute("role");
        container.removeAttribute("aria-label");
        container.removeAttribute("data-indicator-mode");
        container.removeAttribute("data-indicator-origin");
      }
    };
  }

  return { Meter:Meter, SEGMENT_COUNT: SEGMENT_COUNT, segments: segments, create: create };
});
