# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Auto-Redbook-Skills 是一个小红书笔记素材创作工具，通过解析 Markdown 生成精美的图片卡片（封面 + 正文）。

## 常用命令

```bash
# 安装依赖
cd scripts && npm i

# 渲染图片卡片
node scripts/render_xhs.js <markdown_file> [options]
# 或
npm run render -- demos/content.md

# 安装 Playwright 浏览器
npm run install-browsers
```

### 核心参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--theme` | `-t` | 排版主题 | `sketch` |
| `--mode` | `-m` | 分页模式 | `separator` |
| `--width` | `-w` | 图片宽度 | `1080` |
| `--height` | | 图片高度 | `1440` |
| `--emit-html / --no-emit-html` | | 是否输出 HTML | 关闭 |
| `--emit-png / --no-emit-png` | | 是否输出 PNG | 开启 |

**主题**（`-t`）：`sketch`、`default`、`playful-geometric`、`neo-brutalism`、`botanical`、`professional`、`retro`、`terminal`、`charged-official`

**分页模式**（`-m`）：
- `separator` - 按 `---` 手动分页
- `auto-fit` - 固定尺寸自动缩放
- `auto-plot` - 自动根据高度切分
- `dynamic` - 动态调整高度

### 性能说明

- PNG 渲染会复用同一个 Chromium 实例
- 正文卡片 PNG 渲染默认 **最多 3 张并行**（日志中会显示 `并行x3`）

## 架构说明

- **渲染核心**：`scripts/render_xhs.js` 使用 Playwright + marked 解析 Markdown 并渲染为图片
- **HTML 模板**：`assets/cover.html`（封面）、`assets/card.html`（正文卡片）
- **主题样式**：`assets/themes/` 下 8 套 CSS 主题

## Markdown 格式

```yaml
---
emoji: "🚀"
title: "封面大标题"
subtitle: "封面副标题"
---

# 正文内容（支持完整 Markdown 语法）

---

# 第二张卡片（使用 --- 分隔）
```