# UI-2 适配

设计源：`C:/Users/Chiang-Workstation/Documents/Rabbit R1 PO-33/UI-2.ai`，240×282。
`panel-art.svg` 只显示设计稿中的机械部件；面板标签和编号使用真实文本。LED、数值、状态图标和电平条由实时状态驱动。
右侧数值及 ton / FLt / tri 使用本地打包的 DSEG7 字体单一文本节点，不再逐段拼接或叠画背景。

## 操作

- 按住 sound，按 1–16 选择音色。1–8 旋律，9–16 十六等分鼓切片。
- 按住 record 和目标数字键录音，松开任意一个即停止；共用 40 秒内存。
- write 单击切换步进编辑；数字键添加/移除步进。play 启停，不退出编辑。
- 播放中按住 write 和数字键录入音符。
- FX 单击切换 TONE / FILTER / TRIM。A/B 分别调节音高/音量、滤波/共振、起点/长度。
- 鼓槽 TRIM 调节最后触发的切片；旋钮上下拖动，总行程 280°。
- BPM 单击循环 80 / 120 / 140；按住 BPM，A 调 swing，B 在 60–240 内调速度。
- 按住 BPM 和数字键设置主音量 1–16。
- 播放中按住 FX 和 1–15 施加效果；16 释放效果。编辑模式中记录效果；FX+16 清除模式内效果。
- 按住 write 并在播放中调整 TONE/FILTER，记录当前步参数锁。
- 按住 pattern 和数字键选模式；同一次按住过程中依次选择可建立最多 128 项的循环模式链。
- write+pattern+数字键复制模式；record+pattern 清除当前模式。
- write+sound+数字键复制整个采样；record+sound 删除当前采样。
- 按键调用 12ms 振动，无瞬时按下视觉效果。振动取决于设备 WebView 支持。

## 验证与范围

`test-ui2.py` 使用 Edge/Playwright 和模拟麦克风，验证组合操作、录音、恢复、指示器及脚本错误。
参考的 GitHub 仓库是手册，不提供原机 DSP。15 个 FX 为 Web Audio 的循环、变速、叠音、反向和门控实现，声音不保证与原机完全一致。
尚未实现原机的跨鼓槽单切片复制、步进倍率及专有模拟音频备份/同步协议。页面不模拟电池、时钟/闹钟或硬件断电操作。
真机麦克风权限、振动、音频延迟和存储上限需要在 r1 上验证。

参考：
- https://teenage.engineering/guides/po-33/en
- https://github.com/lode/PO-33
