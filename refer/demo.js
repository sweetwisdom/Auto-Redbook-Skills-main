import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

async function openBrowser(headless) {
  const candidates = [
    { channel: 'msedge', name: 'Microsoft Edge' },
    { channel: 'chrome', name: 'Google Chrome' },
    { channel: undefined, name: 'Chromium' },
  ]

  let lastError
  for (const candidate of candidates) {
    try {
      const browser = await chromium.launch({
        headless,
        channel: candidate.channel,
      })
      return { browser, browserName: candidate.name }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}
async function main() {
  const searchUrl = 'https://cn.bing.com'
  let browser
  try {
    const { browser: openedBrowser, browserName } = await openBrowser(false)
    browser = openedBrowser

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      locale: 'zh-CN',
    })
    const page = await context.newPage()

    console.log(`打开 Bing，浏览器: ${browserName}`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await delay(2)
    const outputFile = path.join('./output', `${formatDate()}.png`)
    await page.screenshot({ path: outputFile, fullPage: true })
    console.log(`截图已保存: ${outputFile}`)
  } catch (error) {
    console.error('执行失败:', error instanceof Error ? error.message : String(error))

    process.exitCode = 1
  } finally {
    if (browser) {
      console.log(`✅本次任务执行完毕`)
      await browser.close().catch(() => {})
    }
  }
}

main()

async function delay(second = 1) {
  console.log(`等待${second}秒`)
  await new Promise(resolve => setTimeout(resolve, second * 1000))
}

function formatDate() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
}
