import { test, expect } from '@playwright/test'

test('localhost lyrebird demo flow', async ({ page }) => {
  page.setDefaultTimeout(120000)

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: 'Lyrebird' })).toBeVisible()

  await page.getByRole('button', { name: /Run Yolk/ }).click()
  await expect(page.getByText('Yolk produced explainable facts. Review and transform.')).toBeVisible()

  await page.getByRole('button', { name: '🔍' }).click()
  await page.getByRole('button', { name: '🔎 Find' }).click()
  await expect(page.getByText(/Find matched/)).toBeVisible()

  await page.getByRole('button', { name: '✍️' }).click()
  await page.getByRole('button', { name: 'Replace' }).click()
  await expect(page.getByText(/Replace completed/)).toBeVisible()

  await page.locator('button', { hasText: 'Run Graph' }).click()
  await expect(page.getByText('Graph built from profile/context input and atomic facts.')).toBeVisible()

  await page.getByRole('button', { name: 'Load Song Placeholder' }).click()
  await expect(page.getByText('Loaded reference track and queued playback.')).toBeVisible()
  await expect(page.locator('.copilot-card:has(button[aria-label="Load Song Placeholder"]) audio')).toHaveAttribute(
    'src',
    /music_prod_tts-20260221103606-udrEprgbjcAeqNKa\.mp3/,
  )

  await expect(page.locator('audio')).toBeVisible({ timeout: 30000 })
})
