# 38-segment LCD indicator

`lcd-indicator.js` is a dependency-free SVG component. It exports
`PO33Indicator` in a browser and the same API through CommonJS for tests.
The 38-square mapping follows the requested design; it is not a claim that all
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
- Normal playback uses a centered level meter that expands equally left and right. Idle/manual audition keep the center origin too; input monitoring and BPM volume selection use the left origin. SOUND-slot preview suppresses the output meter. Existing IN/OUT logic is unchanged.

简体中文：接口支持 `pitch`、`trim`、`level` 三种模式；`setProps()` 可随时切换。
零音高用中间两格标记，正值向右、负值向左，每半音两格，超过 ±8 半音时指示条封顶，数字显示不变。
`start` 和 `length` 都是整个区间的百分比；空区间不点亮。
播放及停止后的电平使用 `origin:'center'`，左右成对扩开并居中归零；SOUND 选槽试听不显示输出电平；输入监听与音量设置保持 `origin:'left'`。奇数格数向上取整为一对，零值全灭。

## 待真机校验：LCD 与七段码显示（2026-11-21）

本节仅记录后续核对项，不是已确认的硬件规格，也不改变当前页面行为。
电量显示不纳入开发计划，不新增电量读取、百分比模拟或电池图标。
现有 SOUND + BPM 行为保持不变；不因本清单修改组合键或功能映射。

| 待核对项目 | 需要真机确认的内容 | 确认前的处理 |
| --- | --- | --- |
| 电平条几何结构 | 实际独立分段数量、尺寸、间距；是否另有左右圆点，以及圆点与 IN/OUT 的区别。参考资料存在“32 格”和“10 格＋两点”冲突。 | 保留现有 32 格，不能将任一说法当作定论。 |
| 播放与手动演奏电平 | 点亮方向是否从中心或左端开始；采用峰值、RMS 或其他映射；上升与回落速度、峰值驻留。 | 保留现有中心扩展播放电平及现有手动演奏显示。 |
| 左右端点 | 是否独立存在；代表削波、范围端点或其他状态；是否真的分别对应左右声道；触发门限、驻留与熄灭方式。 | 不新增未经验证的左右声道削波灯或直流偏移警报。 |
| 录音待机与录音电平 | RECORD 待机、ARMED、RECORDING 时的显示差异；输入过载提示的位置及持续时间。 | 保留现有输入监控和录音反馈，不预设所谓最佳格数。 |
| TRIM 范围指示 | Start 和 Length 如何映射亮格；边界取整；首尾是否有专用标记；旋律槽与鼓切片有无显示差异。 | 保留现有选区映射，不改变原始 PCM 或 Trim 语义。 |
| 音高与参数条 | TON、FLT、主音量、Swing 调整时指示条的映射、中心点、饱和位置及显示优先级。 | 保留现有映射；不得将显示格数推导成新的音频参数范围。 |
| 备份发送显示 | 实际七段码代码、LED 顺序；电平条显示进度还是信号电平；成功时的文字与驻留。 | 保留当前发送状态机与进度显示。 |
| 备份接收显示 | 等待、输入中、解码、成功、失败时的文字；电平和进度是否交替；端点是否提示过载。 | 保留当前接收状态机；不以未经确认的格数判定校验成功或失败。 |
| 四位七段码格式 | 字符字形、左右对齐、前导零、负号、小数点、冒号、闪烁节奏和提示驻留时间。 | 保留现有四位布局；逐状态对照真机画面。 |
| 参数读数刻度 | Pitch、Volume、Cutoff、Resonance、Start、Length、Swing 的屏幕刻度及默认显示值，旋律槽与鼓组槽是否不同。 | 未确认前不改默认音量、调音跨度、滤波曲线或其他声音行为。 |
| 系统提示代码 | rcv、snd、End/don、err、cpy、clr 等是否实际出现，大小写、触发时机和退出方式。 | 将这些视作待观察候选，不凭资料新增系统功能、错误条件或错误编号。 |
| 同步相关显示 | 若日后单独实现 Sync，再核对 SY0–SY5 及脉冲相关显示。 | 当前不新增 Sync；不模拟不存在的外部同步活动。 |

校验时记录真机型号/固件信息（若可获取）、操作顺序、当前模式、旋钮位置、
屏幕近拍或视频及观察结果。分段结构使用清晰静态近拍，闪烁和电平响应使用视频；
涉及电平门限的结论需要已知信号与幅度，不能仅凭听感或单张照片判断。
经确认后，再单独决定哪些显示规则应用到网页，并保留当前用户指定的行为差异。

Manual sound/pad audition while stopped does not drive the output meter or OUT marker. Sequencer playback and input monitoring retain their meters; deliberate knob editing retains the relevant parameter indicator.

Tone knobs use neutral midpoints: pitch 0 at 50%, volume unity (100%) at 50% of a 0–200% gain range. Following the hardware video (2026-11-27), volume uses left-to-right 38-cell fill with a center reference; pitch uses one neutral center cell and expands into the complete 19-cell left/right half at -12/+12. Resonance, swing, tempo and held-step note/length indicators normalize their actual knob specification to the complete bar. Trim remains a physical selection interval, and cutoff retains its bipolar shrinking range. Existing saved sound parameters are preserved. The desktop QR has no caption; its footer only states no affiliation with Teenage Engineering.
