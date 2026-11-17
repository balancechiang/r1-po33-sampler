# 32-segment LCD indicator

`lcd-indicator.js` is a dependency-free SVG component. It exports
`PO33Indicator` in a browser and the same API through CommonJS for tests.
The 32-square mapping follows the requested design; it is not a claim that all
display details have been verified against physical hardware.

```html
<svg viewBox="0 0 200 4.5" role="presentation">
  <g id="indicator"></g>
</svg>
<script src="lcd-indicator.js"></script>
<script>
  const bar = PO33Indicator.create(document.querySelector('#indicator'), {
    mode: 'pitch',
    pitch: 2
  });

  bar.setProps({ mode: 'trim', start: 25, length: 50 });
  bar.setProps({ mode: 'level', value: 20 });
</script>
```

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `mode` | `'pitch' \| 'trim' \| 'level'` | `'level'` in `create()` | Select mapping. |
| `pitch` | number | 0 | Semitone offset; two squares per semitone, left for negative and right for positive. |
| `start` | number | 0 | Trim start as an absolute percentage, 0–100. |
| `length` | number | 100 | Absolute width of the selected interval, 0–100; clips at 100 minus start. |
| `value` | number | 0 | Level amount, 0–32; rounded and clamped. `origin` chooses the fill direction. |
| `origin` | `'left' \| 'center'` | `'left'` | Level fill direction. Center lights mirrored pairs; odd counts round up to the next pair. Zero remains off. |
| `onColor` | string | `'#fff'` | Active fill. |
| `offColor` | string | `'#222'` | Inactive fill. |

`setProps()` merges new props with previous props. It updates existing rectangles
in place, using solid fill colors; it does not overlay bars or rebuild the SVG.
`destroy()` removes the component's rectangles and accessibility attributes.
`segments(props)` is a pure mapping function returning exactly 32 booleans, for
reuse in another framework or canvas renderer.

The center lies between indices 15 and 16. Neutral pitch lights these two squares.
Positive pitch fills from index 16 rightwards; negative pitch fills from index 15
leftwards. Each half has 16 squares, so the bar saturates at ±8 semitones. The app's
numeric pitch range remains ±12; numeric values are not changed by saturation.
Trim lights every square overlapping a nonempty selected interval. A zero-length
interval lights none; `start:100` also lights none.

The optional third `create()` argument controls static geometry:
`{x:0,y:0,size:4.5,gap:1.8}`. All segments are true squares. The app uses
`{x:19,y:24.25}` to align the bar between IN and OUT without overlap.

## App adapter

- Microphone monitoring and active FX take priority and show measured level.
- Holding BPM displays master volume, with each volume unit using two squares.
- Active step editing displays its note plus the sound's pitch offset.
- TONE displays the selected sound's pitch. FILTER uses the normal level meter.
- TRIM displays the actual selected region. The existing melodic/copied-slice
  length is stored as a percentage of the remaining sound, so the adapter converts
  it to absolute interval width. A native drum slice is positioned within its take.
- Normal playback uses a centered level meter that expands equally left and right. Idle/manual audition, input monitoring and BPM volume selection use the left origin. Existing IN/OUT logic is unchanged.

简体中文：接口支持 `pitch`、`trim`、`level` 三种模式；`setProps()` 可随时切换。
零音高用中间两格标记，正值向右、负值向左，每半音两格，超过 ±8 半音时指示条封顶，数字显示不变。
`start` 和 `length` 都是整个区间的百分比；空区间不点亮。
播放电平使用 `origin:'center'`，左右成对扩开；输入监听与音量设置保持 `origin:'left'`。奇数格数向上取整为一对，零值全灭。
