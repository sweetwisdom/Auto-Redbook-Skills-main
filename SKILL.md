---
name: xhs-note-creator
description: 小红书笔记素材创作技能。当用户需要创建小红书图文笔记素材时使用这个技能。技能包含：根据用户需求和资料撰写小红书笔记内容，生成渲染用 Markdown，并使用 Node.js + Playwright/marked/yaml 渲染封面和正文图片卡片。支持 10 种主题、4 种分页模式、HTML/PNG 输出开关、封面 Logo、页脚作者/口号和 Markdown 图片路径处理。
---

# 小红书笔记创作技能

根据用户提供的资料或需求，创作小红书笔记内容，并用 Node.js 渲染生成精美图片卡片。

> 详细参数文档见 `references/params.md`

---

## 工作流程

### 第一步：撰写小红书笔记内容

根据用户需求和资料，创作符合小红书风格的内容：

**标题**：不超过 20 字，吸引眼球，可用数字/疑问句/感叹号增强吸引力。

**正文**：段落清晰，点缀少量 Emoji（每段 1-2 个），短句短段，结尾附 5-10 个 SEO 标签。

---

### 第二步：生成渲染用 Markdown 文档

**注意：此 Markdown 专为图片渲染设计，禁止直接使用上一步的笔记正文。**

文档结构：

```markdown
---
emoji: "🚀"
title: "封面大标题（≤15字）"
subtitle: "封面副标题（≤15字）"
---

# 正文内容...

---

# 第二张卡片内容...（使用 --- 手动分隔时）
```

分页策略选择：
- 内容需精确切分 → 用 `---` 手动分隔，配合 `-m separator`
- 内容长短不稳定 → 生成普通 Markdown，使用 `-m auto-split`
- 单张内容希望固定尺寸不溢出 → 使用 `-m auto-fit`
- 允许卡片按内容增高 → 使用 `-m dynamic`

可选 frontmatter：

```yaml
author: "你的名字"
slogan: "@xxx 和我一起进步"
img_max_width: 80
logo:
  icon: "mdi:lightning-bolt"
  img: "./cover-avatar.png"
  label: "品牌名"
  subtext: "副标题或一句话介绍"
  size: 220
```

- `author` / `slogan` 显示在正文页脚，页脚中间自动显示页码。
- `img_max_width` 控制正文图片最大宽度百分比，默认 `80`。
- `logo` 仅显示在封面；`logo.img` 相对 Markdown 文件目录解析，且优先于 `logo.icon`。

---

### 第三步：渲染图片卡片

主推 Node.js 版本（当前仓库的主要渲染入口，支持 10 种主题、HTML/PNG 输出开关、PNG 并行渲染）：

```bash
node scripts/render_xhs.js <markdown_file> [options]
```

常用示例：

```bash
# 默认（PNG 开启，HTML 关闭；正文卡片 PNG 默认最多 3 张并行）
node scripts/render_xhs.js content.md

# 只输出 HTML（不截图）
node scripts/render_xhs.js content.md --emit-html --no-emit-png

# 指定输出目录和主题
node scripts/render_xhs.js content.md -o out -t terminal -m auto-split
```

默认值：
- 主题：`default`
- 分页：`separator`
- 尺寸：`1080x1440`
- 输出：PNG 开启，HTML 关闭

生成结果：`cover.png`（封面）+ `card_1.png`、`card_2.png`...（正文卡片）

**可用主题**（`-t`）：`sketch`、`default`、`ai-charging`、`playful-geometric`、`neo-brutalism`、`botanical`、`professional`、`retro`、`terminal`、`charged-official`

**分页模式**（`-m`）：`separator`、`auto-fit`、`auto-split`、`dynamic`

> 完整参数说明见 `references/params.md`

---

## 技能资源

### 脚本
- `scripts/render_xhs.js` — 主渲染脚本（Node.js，10 主题 + 4 分页模式）

### 模板与样式
- `assets/cover.html` — 封面 HTML 模板
- `assets/card.html` — 正文卡片 HTML 模板
- `assets/styles.css` — 公共容器样式
- `assets/themes/` — 各主题 CSS 文件

### 参考文档
- `references/params.md` — 完整参数参考（主题/模式/Markdown 元数据参数）
