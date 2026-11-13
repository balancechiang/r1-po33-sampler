[English](PRESETS.md) | [简体中文](PRESETS.zh-CN.md) | [日本語](PRESETS.ja.md) | [한국어](PRESETS.ko.md)

# 预置音色与节奏

预置声音全部通过正弦波、谐波合成、FM 和确定性噪声生成，不含第三方录音或现成乐曲。

| 槽位 | 名称 | 音色 |
| --- | --- | --- |
| 1 | Sub Bloom | C2 合成贝斯 |
| 2 | Amber Pluck | C3 泛音拨弦 |
| 3 | Glass FM | C4 FM 钟音 |
| 4 | Soft Fifth | 柔和五度铺底 |
| 9 | Analog Kit | 模拟鼓组 |
| 10 | Dust Kit | 噪声与鼓皮音色 |
| 11 | Electro Kit | 电子鼓组 |
| 12 | Perc Kit | 打击乐组 |

每套鼓组包含 16 个等长切片：底鼓、军鼓、闭镲、拍手、边击、通鼓、沙锤、开镲及变化版。**5–8、13–16 槽位默认为空**，可录音或复制音色进去。

**Pattern 1–4** 分别为 **Night Circuit**、**Broken Glass**、**Velvet Steps**、**Moon Return**，使用 C 小调音集组合贝斯、拨弦、钟音、铺底与四层鼓组。按住 pattern 并依次按 1、2、3、4，可循环播放整组。

预置从本地 presets.js 加载，不依赖外部音色服务，也计入 40 秒共享采样内存。删除预置音色后，重新加载不会自动恢复；初始化会保留已有录音和非空模式。

原创生成音色和这四组音序按 **CC0-1.0** 提供，仅适用于上述预置素材，不自动适用于整个应用或美术素材。

[操作说明](R1-CONTROLS.zh-CN.md) · [预置音色与节奏](PRESETS.zh-CN.md) · [发布说明](DEPLOY.zh-CN.md)
