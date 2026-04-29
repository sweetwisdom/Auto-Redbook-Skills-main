# 参数参考文档

## 渲染脚本（render_xhs.js，Node.js）

```bash
node scripts/render_xhs.js <markdown_file> [options]
```

### 参数列表

| 参数 | 简写 | 说明 | 默认值 |
|---|---|---|---|
| `--output-dir` | `-o` | 输出目录 | 当前工作目录 |
| `--theme` | `-t` | 排版主题 | `default` |
| `--mode` | `-m` | 分页模式 | `separator` |
| `--width` | `-w` | 图片宽度（px） | `1080` |
| `--height` | | 图片高度（`dynamic` 下为最小高度） | `1440` |
| `--max-height` | | `dynamic` 模式下的最大高度 | `2160` |
| `--dpr` | | 设备像素比（清晰度） | `2` |
| `--emit-html` / `--no-emit-html` | | 是否输出 HTML | 关闭 |
| `--emit-png` / `--no-emit-png` | | 是否输出 PNG | 开启 |

### 性能说明

- PNG 渲染会复用同一个 Chromium 实例（避免逐张启动浏览器）
- 正文卡片 PNG 渲染默认 **最多 3 张并行**（日志中会出现 `并行x3`）

### 常用命令示例

```bash
# 默认（PNG 开启，HTML 关闭）
node scripts/render_xhs.js demos/content.md -o out

# 只输出 HTML（不截图）
node scripts/render_xhs.js demos/content.md -o out-html --emit-html --no-emit-png
```

### 排版主题（`--theme`）

| 值 | 名称 | 说明 |
|---|---|---|
| `sketch` | 手绘素描 | 手绘风格 |
| `default` | 默认简约 | 浅灰渐变背景（`#f3f3f3 → #f9f9f9`） |
| `ai-charging` | AI 充电官 | 深蓝渐变、闪电水印、粗体标题 |
| `playful-geometric` | 活泼几何 | Memphis 设计风格 |
| `neo-brutalism` | 新粗野主义 | 粗框线条、强对比 |
| `botanical` | 植物园自然 | 自然绿植风格 |
| `professional` | 专业商务 | 简洁商务蓝 |
| `retro` | 复古怀旧 | 暖色复古感 |
| `terminal` | 终端命令行 | 深色代码终端风格 |
| `charged-official` | 充电参考风 | 暖黄渐变、粗黑标题、可配中部 Logo（Iconify / 本地图） |

### 分页模式（`--mode`）

| 值 | 说明 | 适用场景 |
|---|---|---|
| `separator` | 按 `---` 分隔符分页 | 内容已手动控量，需要精确分页 |
| `auto-fit` | 固定尺寸，自动整体缩放内容 | 封面 + 单张图，尺寸固定不溢出 |
| `auto-split` | 根据渲染后高度自动切分 | 内容长短不稳定，推荐通用选择 |
| `dynamic` | 根据内容动态调整图片高度 | 允许不同高度卡片，字数 ≤550 |

---

## Markdown 文档格式

### YAML 头部元数据

```yaml
---
emoji: "🚀"           # 封面装饰 Emoji
title: "大标题"        # 封面大标题（不超过 15 字）
subtitle: "副标题文案"  # 封面副标题（不超过 15 字）
author: "你的名字"      # 可选，正文页脚左侧
slogan: "@xxx 和我一起进步" # 可选，正文页脚右侧
img_max_width: 80       # 可选，正文图片最大宽度百分比
logo:                  # 可选，仅封面显示
  icon: "mdi:lightning-bolt"
  img: "./cover-avatar.png"
  label: "品牌名"
  subtext: "一句话介绍"
  size: 220
---
```

- `logo.img` 和 Markdown 图片相对 Markdown 文件所在目录解析。
- 同时配置 `logo.img` 与 `logo.icon` 时，优先使用本地图片。

### 分页分隔符

使用 `---` 手动分割卡片（配合 `-m separator` 使用）：

```markdown
---
emoji: "💡"
title: "工具推荐"
subtitle: "提升效率的 5 个神器"
---

# 神器一：Notion

> 全能笔记工具...

---

# 神器二：Raycast

快捷启动工具...
```
