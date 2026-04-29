#!/usr/bin/env node
/**
 * 小红书卡片渲染脚本 - Node.js 增强版
 * 支持多种排版样式和智能分页策略
 *
 * 使用方法:
 *     node render_xhs.js <markdown_file> [options]
 *
 * 选项:
 *     --output-dir, -o     输出目录（默认为当前工作目录）
 *     --theme, -t          排版主题：default, playful-geometric, neo-brutalism, 等
 *     --mode, -m           分页模式：separator, auto-fit, auto-split, dynamic
 *     --width, -w          图片宽度（默认 1080）
 *     --height, -h         图片高度（默认 1440）
 *     --dpr                设备像素比（默认 2）
 *
 * 依赖安装:
 *     npm i
 */

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import yaml from "yaml";
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";

// 获取脚本所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR = path.dirname(__dirname);
const ASSETS_DIR = path.join(SCRIPT_DIR, "assets");
const THEMES_DIR = path.join(ASSETS_DIR, "themes");

// 默认卡片尺寸配置 (3:4 比例)
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1440;
const MAX_HEIGHT = 2160;

// 可用主题列表
const AVAILABLE_THEMES = [
    "default",
    "playful-geometric",
    "neo-brutalism",
    "botanical",
    "professional",
    "retro",
    "terminal",
    "sketch",
    "charged-official",
];

// 分页模式
const PAGING_MODES = ["separator", "auto-fit", "auto-split", "dynamic"];

// 主题背景色
const THEME_BACKGROUNDS = {
    default: "linear-gradient(180deg, #f3f3f3 0%, #f9f9f9 100%)",
    "playful-geometric": "linear-gradient(135deg, #8B5CF6 0%, #F472B6 100%)",
    "neo-brutalism": "linear-gradient(135deg, #FF4757 0%, #FECA57 100%)",
    botanical: "linear-gradient(135deg, #4A7C59 0%, #8FBC8F 100%)",
    professional: "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)",
    retro: "linear-gradient(135deg, #D35400 0%, #F39C12 100%)",
    terminal: "linear-gradient(135deg, #0D1117 0%, #161B22 100%)",
    sketch: "linear-gradient(135deg, #555555 0%, #888888 100%)",
    "charged-official":
        "linear-gradient(180deg, #fb923c 0%, #fef3c7 45%, #fffbeb 100%)",
};

// 封面标题文字渐变（随主题变化）
const THEME_TITLE_GRADIENTS = {
    default: "linear-gradient(180deg, #111827 0%, #4B5563 100%)",
    "playful-geometric": "linear-gradient(180deg, #7C3AED 0%, #F472B6 100%)",
    "neo-brutalism": "linear-gradient(180deg, #000000 0%, #FF4757 100%)",
    botanical: "linear-gradient(180deg, #1F2937 0%, #4A7C59 100%)",
    professional: "linear-gradient(180deg, #1E3A8A 0%, #2563EB 100%)",
    retro: "linear-gradient(180deg, #8B4513 0%, #D35400 100%)",
    terminal: "linear-gradient(180deg, #39D353 0%, #58A6FF 100%)",
    sketch: "linear-gradient(180deg, #111827 0%, #6B7280 100%)",
    "charged-official":
        "linear-gradient(180deg, #431407 0%, #ea580c 55%, #fbbf24 100%)",
};

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        markdownFile: null,
        outputDir: process.cwd(),
        theme: "default",
        mode: "separator",
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        maxHeight: MAX_HEIGHT,
        dpr: 2,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case "--output-dir":
            case "-o":
                options.outputDir = nextArg;
                i++;
                break;
            case "--theme":
            case "-t":
                options.theme = nextArg;
                i++;
                break;
            case "--mode":
            case "-m":
                options.mode = nextArg;
                i++;
                break;
            case "--width":
            case "-w":
                options.width = parseInt(nextArg);
                i++;
                break;
            case "--height":
                options.height = parseInt(nextArg);
                i++;
                break;
            case "--max-height":
                options.maxHeight = parseInt(nextArg);
                i++;
                break;
            case "--dpr":
                options.dpr = parseInt(nextArg);
                i++;
                break;
            case "--help":
                printHelp();
                process.exit(0);
            default:
                if (!arg.startsWith("-")) {
                    options.markdownFile = arg;
                }
        }
    }

    return options;
}

/**
 * 打印帮助信息
 */
function printHelp() {
    console.log(`
小红书卡片渲染脚本 - Node.js 版本

使用方法:
    node render_xhs.js <markdown_file> [options]

选项:
    --output-dir, -o     输出目录（默认为当前工作目录）
    --theme, -t          排版主题
    --mode, -m           分页模式
    --width, -w          图片宽度（默认 1080）
    --height             图片高度（默认 1440）
    --max-height         最大高度（默认 2160）
    --dpr                设备像素比（默认 2）

可用主题: ${AVAILABLE_THEMES.join(", ")}
分页模式: ${PAGING_MODES.join(", ")}
`);
}

/**
 * 解析 Markdown 文件
 */
function parseMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");

    // 解析 YAML 头部
    const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

    let metadata = {};
    let body = content;

    if (yamlMatch) {
        try {
            metadata = yaml.parse(yamlMatch[1]) || {};
        } catch (e) {
            metadata = {};
        }
        body = content.slice(yamlMatch[0].length);
    }

    return { metadata, body: body.trim() };
}

/**
 * HTML 转义（用于页脚等文本）
 */
function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * 判断是否可直接使用的外链或内联资源
 */
function isExternalOrInlineUrl(url) {
    return /^(https?:)?\/\//i.test(url) || /^data:/i.test(url);
}

/**
 * 将 Markdown 中 img 路径统一重写为相对 outputDir 的相对路径
 * - 网络路径与 data URI 保持不变
 * - 本地相对路径先按 markdownDir 解析，再转为相对 outputDir
 */
function rewriteImageSrcForOutputDir(html, markdownDir, outputDir) {
    return html.replace(
        /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi,
        (match, prefix, quote, src) => {
            const rawSrc = src.trim();
            if (!rawSrc || isExternalOrInlineUrl(rawSrc)) {
                return match;
            }
            const absolutePath = path.isAbsolute(rawSrc)
                ? rawSrc
                : path.resolve(markdownDir, rawSrc);
            const relativePath = path
                .relative(outputDir, absolutePath)
                .split(path.sep)
                .join("/");
            return `${prefix}${quote}${relativePath}${quote}`;
        },
    );
}

/**
 * 解析图片最大宽度配置（默认 80%）
 */
function parseImageMaxWidth(metadata) {
    const raw =
        metadata.img_max_width ??
        metadata.image_max_width ??
        metadata.imgMaxWidth ??
        metadata.imageMaxWidth;
    if (raw === undefined || raw === null || raw === "") {
        return "80%";
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const num = Math.max(10, Math.min(100, raw));
        return `${num}%`;
    }
    const str = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(str)) {
        const num = Math.max(10, Math.min(100, Number(str)));
        return `${num}%`;
    }
    if (/^\d+(\.\d+)?%$/.test(str)) {
        const num = Number(str.replace("%", ""));
        const normalized = Math.max(10, Math.min(100, num));
        return `${normalized}%`;
    }
    return "80%";
}

/**
 * 本地资源路径解析为相对 outputDir 的路径（用于 logo 等）
 */
function resolveLocalAssetToRelativeSrc(rawSrc, markdownDir, outputDir) {
    const src = String(rawSrc || "").trim();
    if (!src || isExternalOrInlineUrl(src)) {
        return src;
    }
    const absolutePath = path.isAbsolute(src)
        ? src
        : path.resolve(markdownDir, src);
    return path.relative(outputDir, absolutePath).split(path.sep).join("/");
}

/**
 * 解析 logo.size，支持 `200`、误写 `200ss` 等
 */
function parseLogoSize(raw) {
    if (raw === undefined || raw === null || raw === "") {
        return 220;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return Math.max(80, Math.min(400, Math.round(raw)));
    }
    const digits = String(raw).replace(/[^\d.]/g, "");
    const n = parseFloat(digits);
    if (!Number.isFinite(n)) {
        return 220;
    }
    return Math.max(80, Math.min(400, Math.round(n)));
}

/**
 * 解析 frontmatter 中的 logo（img 优先于 icon）
 */
function parseLogoConfig(metadata) {
    const raw = metadata.logo;
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const img =
        raw.img != null && String(raw.img).trim() !== ""
            ? String(raw.img).trim()
            : "";

    const hasExplicitIcon =
        Object.prototype.hasOwnProperty.call(raw, "icon") &&
        raw.icon != null &&
        String(raw.icon).trim() !== "";

    const icon = hasExplicitIcon ? String(raw.icon).trim() : "mdi:flash";

    const label = raw.label != null ? String(raw.label).trim() : "";
    const subtext = raw.subtext != null ? String(raw.subtext).trim() : "";

    const size = parseLogoSize(raw.size);

    const meaningful =
        !!img ||
        hasExplicitIcon ||
        label !== "" ||
        subtext !== "";

    if (!meaningful) {
        return null;
    }

    return { img, icon, size, label, subtext };
}

/**
 * 生成中部品牌区 HTML（Iconify 或本地图，img 优先）
 */
function buildLogoBlockHtml(logo, markdownDir, outputDir) {
    if (!logo) {
        return "";
    }

    const w = logo.size;
    let markInner = "";
    if (logo.img) {
        const rel = resolveLocalAssetToRelativeSrc(
            logo.img,
            markdownDir,
            outputDir,
        );
        markInner = `<img class="logo-img" src="${escapeHtml(rel)}" alt="" />`;
    } else {
        const innerPx = Math.max(96, Math.round(w * 0.92));
        markInner = `<iconify-icon icon="${escapeHtml(
            logo.icon,
        )}" width="${innerPx}" height="${innerPx}" style="width:${innerPx}px;height:${innerPx}px;display:block;margin:0;padding:0;"></iconify-icon>`;
    }

    const lines = [
        '<section class="card-logo-block">',
        `<div class="logo-mark" style="width:${w}px;height:${w}px;min-width:${w}px;min-height:${w}px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">`,
        markInner,
        "</div>",
    ];
    if (logo.label) {
        lines.push(`<p class="logo-label">${escapeHtml(logo.label)}</p>`);
    }
    if (logo.subtext) {
        lines.push(`<p class="logo-subtext">${escapeHtml(logo.subtext)}</p>`);
    }
    lines.push("</section>");
    return lines.join("\n");
}

/**
 * 按分隔符拆分内容
 */
function splitContentBySeparator(body) {
    const parts = body.split(/\n---+\n/);
    return parts.map((p) => p.trim()).filter((p) => p);
}

/**
 * 加载主题 CSS
 */
function loadThemeCss(theme) {
    const themeFile = path.join(THEMES_DIR, `${theme}.css`);
    if (fs.existsSync(themeFile)) {
        return fs.readFileSync(themeFile, "utf-8");
    }
    const defaultFile = path.join(THEMES_DIR, "default.css");
    if (fs.existsSync(defaultFile)) {
        return fs.readFileSync(defaultFile, "utf-8");
    }
    return "";
}

/**
 * 封面页中部 Logo 区域样式（与正文 .card-logo-block 一致）
 */
function getCoverLogoBlockCss(width) {
    const mb = Math.floor(width * 0.03);
    return `
        .cover-inner .cover-logo-slot {
            flex-shrink: 0;
            margin-bottom: ${mb}px;
        }
        .cover-inner .card-logo-block {
            margin: 0 auto ${mb}px auto;
            max-width: 88%;
            text-align: center;
        }
        .cover-inner .card-logo-block .logo-mark {
            margin: 0 auto ${Math.floor(width * 0.02)}px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            background: linear-gradient(145deg, #0f172a 0%, #020617 100%);
            border-radius: 42px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
        }
        .cover-inner .card-logo-block .logo-mark iconify-icon {
            display: block !important;
            margin: 0 auto !important;
            flex-shrink: 0 !important;
            max-width: none !important;
            max-height: none !important;
            box-sizing: border-box !important;
        }
        .cover-inner .card-logo-block .logo-img {
            width: 68%;
            height: 68%;
            object-fit: contain;
            display: block;
            border-radius: 12px;
        }
        .cover-inner .card-logo-block .logo-label {
            font-size: ${Math.floor(width * 0.085)}px;
            font-weight: 900;
            color: #030712;
            margin: ${Math.floor(width * 0.02)}px 0 0 0;
            line-height: 1.15;
        }
        .cover-inner .card-logo-block .logo-subtext {
            font-size: ${Math.floor(width * 0.038)}px;
            font-weight: 550;
            color: #374151;
            margin: ${Math.floor(width * 0.022)}px auto 0 auto;
            max-width: 92%;
            line-height: 1.5;
        }
    `;
}

/**
 * 生成封面 HTML
 */
function generateCoverHtml(
    metadata,
    theme,
    width,
    height,
    logoBlockHtml = "",
) {
    const emoji = metadata.emoji || "📝";
    let title = metadata.title || "标题";
    let subtitle = metadata.subtitle || "";

    if (title.length > 15) title = title.slice(0, 15);
    if (subtitle.length > 15) subtitle = subtitle.slice(0, 15);

    const hasCoverLogo = String(logoBlockHtml || "").trim().length > 0;

    const bg = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS["default"];
    const titleBg =
        THEME_TITLE_GRADIENTS[theme] || THEME_TITLE_GRADIENTS["default"];
    const chargedOfficialCover = theme === "charged-official";
    const coverInnerBg = chargedOfficialCover
        ? "linear-gradient(180deg, #fff7ed 0%, #fde68a 52%, #fffbeb 100%)"
        : "#F3F3F3";
    const chargedOverlay = chargedOfficialCover
        ? `
        .cover-container::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image:
                radial-gradient(circle at 18% 28%, rgba(251, 191, 36, 0.22) 0%, transparent 42%),
                radial-gradient(circle at 82% 18%, rgba(245, 158, 11, 0.18) 0%, transparent 38%),
                repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.08) 0px, rgba(255, 255, 255, 0.08) 2px, transparent 2px, transparent 80px);
            pointer-events: none;
        }
        `
        : "";

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=${width}, height=${height}">
    <title>小红书封面</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
        }
        
        .cover-container {
            width: ${width}px;
            height: ${height}px;
            background: ${bg};
            position: relative;
            overflow: hidden;
        }
        ${chargedOverlay}
        
        .cover-inner {
            position: absolute;
            width: ${Math.floor(width * 0.88)}px;
            height: ${Math.floor(height * 0.91)}px;
            left: ${Math.floor(width * 0.06)}px;
            top: ${Math.floor(height * 0.045)}px;
            background: ${coverInnerBg};
            border-radius: 25px;
            display: flex;
            flex-direction: column;
            padding: ${Math.floor(width * 0.074)}px ${Math.floor(width * 0.079)}px;
        }
        
        .cover-emoji {
            font-size: ${Math.floor(width * 0.167)}px;
            line-height: 1.2;
            margin-bottom: ${Math.floor(height * 0.035)}px;
        }
        
        .cover-title {
            font-weight: 900;
            font-size: ${Math.floor(width * 0.12)}px;
            line-height: 1.4;
            background: ${titleBg};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            ${hasCoverLogo ? "flex-shrink: 0;" : "flex: 1;"}
            display: flex;
            align-items: flex-start;
            word-break: break-all;
        }
        
        .cover-fill-spacer {
            flex: 1;
            min-height: 0;
        }
        
        .cover-subtitle {
            font-weight: 350;
            font-size: ${Math.floor(width * 0.067)}px;
            line-height: 1.4;
            color: #000000;
            margin-top: ${hasCoverLogo ? "0" : "auto"};
        }
        ${hasCoverLogo ? getCoverLogoBlockCss(width) : ""}
    </style>
    ${
        hasCoverLogo
            ? '<script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>'
            : ""
    }
</head>
<body>
    <div class="cover-container">
        <div class="cover-inner">
            <div class="cover-emoji">${emoji}</div>
            <div class="cover-title">${title}</div>
            ${
                hasCoverLogo
                    ? `<div class="cover-logo-slot">${logoBlockHtml}</div><div class="cover-fill-spacer"></div>`
                    : ""
            }
            <div class="cover-subtitle">${subtitle}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 生成正文卡片 HTML
 */
function generateCardHtml(
    content,
    theme,
    pageNumber,
    totalPages,
    width,
    height,
    mode,
    markdownDir,
    outputDir,
    footerConfig = {},
    imageMaxWidth = "80%",
    logoBlockHtml = "",
) {
    const htmlContent = rewriteImageSrcForOutputDir(
        marked.parse(content),
        markdownDir,
        outputDir,
    );
    const themeCss = loadThemeCss(theme);
    const pageText = `${pageNumber}/${totalPages}`;
    const bg = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS["default"];
    const authorText = escapeHtml(footerConfig.author || "");
    const sloganText = escapeHtml(footerConfig.slogan || "");

    let containerStyle, innerStyle, contentStyle;

    if (mode === "auto-fit") {
        containerStyle = `
            width: ${width}px;
            height: ${height}px;
            background: ${bg};
            position: relative;
            padding: 50px;
            overflow: hidden;
        `;
        innerStyle = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            height: calc(${height}px - 100px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        contentStyle = "flex: 1; min-height: 0; overflow: hidden;";
    } else if (mode === "dynamic") {
        containerStyle = `
            width: ${width}px;
            min-height: ${height}px;
            background: ${bg};
            position: relative;
            padding: 50px;
        `;
        innerStyle = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
        `;
        contentStyle = "flex: 1; min-height: 0;";
    } else {
        containerStyle = `
            width: ${width}px;
            min-height: ${height}px;
            background: ${bg};
            position: relative;
            padding: 50px;
            overflow: hidden;
        `;
        innerStyle = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            min-height: calc(${height}px - 100px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
        `;
        contentStyle = "flex: 1; min-height: 0;";
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=${width}">
    <title>小红书卡片</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: ${width}px;
            overflow: hidden;
            background: transparent;
        }
        
        .card-container { ${containerStyle} }
        .card-inner { ${innerStyle} }
        .card-content { line-height: 1.7; ${contentStyle} }
        /* auto-fit 用：对整个内容块做 transform 缩放 */
        .card-content-scale { transform-origin: top left; will-change: transform; }
        
        ${themeCss}

        .card-content img {
            max-width: ${imageMaxWidth} !important;
            width: auto;
        }
        
        .card-footer {
            position: absolute;
            left: 80px;
            right: 80px;
            bottom: 52px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            font-size: 24px;
           font-weight: 300;
            opacity: 0.6;
        }

        .card-footer > span {
            min-width: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .card-footer > span:first-child {
            flex: 1;
            text-align: left;
        }

        .footer-center {
            flex: 0 0 auto;
            font-size: 30px;
             font-weight: 600;
            opacity: 0.5;
        }

        .card-footer > span:last-child {
            flex: 1;
            text-align: right;
        }
    </style>
    <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
</head>
<body>
    <div class="card-container">
        <div class="card-inner">
            ${logoBlockHtml}
            <div class="card-content">
                <div class="card-content-scale">
                    ${htmlContent}
                </div>
            </div>
        </div>
        <div class="card-footer">
            <span>${authorText}</span>
            <span class="footer-center">${pageText}</span>
            <span>${sloganText}</span>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 渲染 HTML 为图片
 */
async function renderHtmlToImage(
    htmlContent,
    outputPath,
    width,
    height,
    mode,
    maxHeight,
    dpr,
) {
    const browser = await chromium.launch({
        channel: "chrome",
    });
    const viewportHeight = mode !== "dynamic" ? height : maxHeight;
    const page = await browser.newPage({
        viewport: { width, height: viewportHeight },
        deviceScaleFactor: dpr,
    });

    const htmlPath = outputPath.replace(/\.png$/i, ".html");
    if (fs.existsSync(htmlPath)) {
        await page.goto(pathToFileURL(path.resolve(htmlPath)).href, {
            waitUntil: "networkidle",
        });
    } else {
        await page.setContent(htmlContent);
        await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
        if (window.Iconify && typeof window.Iconify.scan === "function") {
            await window.Iconify.scan();
        }
    });
    await page.waitForTimeout(200);

    let actualHeight;

    if (mode === "auto-fit") {
        await page.evaluate(() => {
            const viewportContent = document.querySelector(".card-content");
            const scaleEl = document.querySelector(".card-content-scale");
            if (!viewportContent || !scaleEl) return;

            // reset
            scaleEl.style.transform = "none";
            scaleEl.style.width = "";
            scaleEl.style.height = "";

            const availableWidth = viewportContent.clientWidth;
            const availableHeight = viewportContent.clientHeight;

            const rect = scaleEl.getBoundingClientRect();
            const contentWidth = Math.max(scaleEl.scrollWidth, rect.width);
            const contentHeight = Math.max(scaleEl.scrollHeight, rect.height);

            if (
                !contentWidth ||
                !contentHeight ||
                !availableWidth ||
                !availableHeight
            )
                return;

            const scale = Math.min(
                1,
                availableWidth / contentWidth,
                availableHeight / contentHeight,
            );

            // expand layout box to avoid clip
            scaleEl.style.width = availableWidth / scale + "px";

            scaleEl.style.transformOrigin = "top left";
            scaleEl.style.transform = `translate(0px, 0px) scale(${scale})`;
        });
        await page.waitForTimeout(100);
        actualHeight = height;
    } else if (mode === "dynamic") {
        const contentHeight = await page.evaluate(() => {
            const container = document.querySelector(".card-container");
            return container ? container.scrollHeight : document.body.scrollHeight;
        });
        actualHeight = Math.max(height, Math.min(contentHeight, maxHeight));
    } else {
        const contentHeight = await page.evaluate(() => {
            const container = document.querySelector(".card-container");
            return container ? container.scrollHeight : document.body.scrollHeight;
        });
        actualHeight = Math.max(height, contentHeight);
    }

    await page.screenshot({
        path: outputPath,
        clip: { x: 0, y: 0, width, height: actualHeight },
        type: "png",
    });

    await browser.close();
    console.log(`  ✅ 已生成: ${outputPath} (${width}x${actualHeight})`);
    return actualHeight;
}

/**
 * 主渲染函数
 */
async function renderMarkdownToCards(options) {
    const {
        markdownFile,
        outputDir,
        theme,
        mode,
        width,
        height,
        maxHeight,
        dpr,
    } = options;

    console.log(`\n🎨 开始渲染: ${markdownFile}`);
    console.log(`  📐 主题: ${theme}`);
    console.log(`  📏 模式: ${mode}`);
    console.log(`  📐 尺寸: ${width}x${height}`);

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 解析 Markdown 文件
    const { metadata, body } = parseMarkdownFile(markdownFile);
    const markdownDir = path.dirname(path.resolve(markdownFile));
    const imageMaxWidth = parseImageMaxWidth(metadata);
    const footerConfig = {
        author: metadata.author || "",
        slogan: metadata.slogan || "",
    };
    const logoConfig = parseLogoConfig(metadata);
    const logoBlockHtml = buildLogoBlockHtml(
        logoConfig,
        markdownDir,
        outputDir,
    );

    // 分割内容
    const cardContents = splitContentBySeparator(body);
    const totalCards = cardContents.length;

    console.log(`  📄 检测到 ${totalCards} 张正文卡片`);

    // 生成封面
    if (metadata.emoji || metadata.title) {
        console.log("  📷 生成封面...");
        const coverHtml = generateCoverHtml(
            metadata,
            theme,
            width,
            height,
            logoBlockHtml,
        );
        fs.writeFileSync(path.join(outputDir, "cover.html"), coverHtml, "utf-8");
        const coverPath = path.join(outputDir, "cover.png");
        await renderHtmlToImage(
            coverHtml,
            coverPath,
            width,
            height,
            "separator",
            maxHeight,
            dpr,
        );
    }

    // 生成正文卡片
    for (let i = 0; i < cardContents.length; i++) {
        const content = cardContents[i];
        console.log(`  📷 生成卡片 ${i + 1}/${totalCards}...`);
        const cardHtml = generateCardHtml(
            content,
            theme,
            i + 1,
            totalCards,
            width,
            height,
            mode,
            markdownDir,
            outputDir,
            footerConfig,
            imageMaxWidth,
            "",
        );
        fs.writeFileSync(
            path.join(outputDir, `card_${i + 1}.html`),
            cardHtml,
            "utf-8",
        );
        const cardPath = path.join(outputDir, `card_${i + 1}.png`);
        await renderHtmlToImage(
            cardHtml,
            cardPath,
            width,
            height,
            mode,
            maxHeight,
            dpr,
        );
    }

    console.log(`\n✨ 渲染完成！图片已保存到: ${outputDir}`);
}

/**
 * 主函数
 */
async function main() {
    const options = parseArgs();

    if (!options.markdownFile) {
        console.error("❌ 错误: 请提供 Markdown 文件路径");
        printHelp();
        process.exit(1);
    }

    if (!fs.existsSync(options.markdownFile)) {
        console.error(`❌ 错误: 文件不存在 - ${options.markdownFile}`);
        process.exit(1);
    }

    if (!AVAILABLE_THEMES.includes(options.theme)) {
        console.error(`❌ 错误: 不支持的主题 - ${options.theme}`);
        console.error(`可用主题: ${AVAILABLE_THEMES.join(", ")}`);
        process.exit(1);
    }

    if (!PAGING_MODES.includes(options.mode)) {
        console.error(`❌ 错误: 不支持的分页模式 - ${options.mode}`);
        console.error(`可用模式: ${PAGING_MODES.join(", ")}`);
        process.exit(1);
    }

    await renderMarkdownToCards(options);
}

main().catch(console.error);
