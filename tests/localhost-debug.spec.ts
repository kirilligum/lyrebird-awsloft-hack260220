import { test, expect } from '@playwright/test'
import fs from 'fs'

test('localhost lyrebird debug render + flow', async ({ page }) => {
  page.setDefaultTimeout(120000)
  const events: string[] = []

  page.on('console', (msg) => {
    events.push(`[${msg.type()}] ${msg.text()}`)
  })

  page.on('pageerror', (err) => {
    events.push(`[pageerror] ${err.message}`)
  })

  page.on('requestfailed', (req) => {
    events.push(`[requestfailed] ${req.method()} ${req.url()} - ${req.failure()?.errorText || 'unknown'}`)
  })

  await page.goto('/', { waitUntil: 'networkidle' })
  await page.screenshot({ path: 'test-results/manual/01-home.png', fullPage: true })

  await expect(page.getByRole('heading', { name: 'Egg → Yolk → Albumen → Song' })).toBeVisible()
  await page.getByRole('button', { name: 'Run Yolk' }).click()
  await expect(page.getByText('Yolk produced explainable facts. Review and transform.')).toBeVisible()

  await page.getByRole('button', { name: 'Run Albumen Pass' }).click()
  await expect(page.getByText('Albumen pass applied. Graph and facts now include transform history.')).toBeVisible()

  await page.getByRole('button', { name: 'Build Graph' }).click()
  await expect(page.getByText('Graph built from mock provenance and transform metadata.')).toBeVisible()

  await page.getByRole('button', { name: 'Generate Song' }).click()
  await expect(page.getByText('Song generated. You can now play the artifact below.', { exact: true })).toBeVisible({ timeout: 30000 })

  await expect(page.locator('audio')).toBeVisible({ timeout: 30000 })
  await page.screenshot({ path: 'test-results/manual/02-flow-complete.png', fullPage: true })
  fs.writeFileSync('test-results/manual/browser-events.txt', events.join('\n'))
})
