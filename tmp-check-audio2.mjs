import { chromium, expect } from '@playwright/test'

const base = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('console', (msg) => console.log(`[console] ${msg.type()} ${msg.text()}`))
const responses = []
page.on('response', (resp) => {
  if (resp.url().includes('music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3')) {
    responses.push({ url: resp.url(), status: resp.status() })
  }
})
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Run Yolk/ }).click()
await expect(page.getByText('Yolk produced explainable facts. Review and transform.')).toBeVisible({ timeout: 30000 })
await page.getByRole('button', { name: '🔍' }).click()
await page.getByRole('button', { name: '🔎 Find' }).click()
await page.getByRole('button', { name: '✍️' }).click()
await page.getByRole('button', { name: 'Replace' }).click()
await page.locator('button', { hasText: 'Run Graph' }).first().click()
await expect(page.getByText('Graph built from profile/context input and atomic facts.')).toBeVisible({ timeout: 30000 })
await page.getByRole('button', { name: 'Load Song Placeholder' }).click()
await expect(page.getByText('Loaded reference track and queued playback.')).toBeVisible({ timeout: 30000 })
const audio = page.locator('audio').first()
await audio.waitFor({ state: 'visible' })
const state1 = await audio.evaluate((a) => ({
  src: a.currentSrc,
  paused: a.paused,
  readyState: a.readyState,
  networkState: a.networkState,
  duration: Number.isFinite(a.duration) ? a.duration : null,
  currentTime: a.currentTime,
  error: a.error ? String(a.error.message || a.error.code) : null,
  ended: a.ended,
  bufferedCount: a.buffered.length,
  controls: a.controls
}))
await page.waitForTimeout(3000)
const state2 = await audio.evaluate((a) => ({
  paused: a.paused,
  currentTime: a.currentTime,
  duration: Number.isFinite(a.duration) ? a.duration : null,
  ended: a.ended,
  bufferedCount: a.buffered.length,
  volume: a.volume,
  muted: a.muted,
}))
console.log('RESP', JSON.stringify(responses))
console.log('STATE1', JSON.stringify(state1))
console.log('STATE2', JSON.stringify(state2))
await page.screenshot({ path: 'tmp-audio.png' })
await browser.close()
