import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const responses = []
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3')) {
    responses.push({ status: r.status(), url: u })
  }
})
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Run Yolk/ }).click()
await page.getByRole('button', { name: '🔎 Find' }).click()
await page.getByRole('button', { name: 'Replace' }).click()
await page.getByRole('button', { name: /Load Song Placeholder|⚡/ }).click()

const audio = page.locator('audio').first()
await audio.waitFor({ state: 'visible', timeout: 30000 })
const state1 = await audio.evaluate((el) => {
  const a = el
  return {
    src: a.currentSrc,
    paused: a.paused,
    readyState: a.readyState,
    networkState: a.networkState,
    duration: Number.isFinite(a.duration) ? a.duration : null,
    buffered: a.buffered.length,
    currentSrc: a.currentSrc,
    error: a.error ? `${a.error.code}:${a.error.message || ''}` : null,
  }
})
await page.waitForTimeout(2500)
const state2 = await audio.evaluate((el) => {
  const a = el
  return {
    paused: a.paused,
    currentTime: a.currentTime,
    duration: Number.isFinite(a.duration) ? a.duration : null,
    ended: a.ended,
    played: a.played.length,
  }
})
console.log(JSON.stringify({ responses, state1, state2 }, null, 2))
await browser.close()
