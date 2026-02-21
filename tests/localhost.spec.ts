import { test, expect } from '@playwright/test'

test('localhost lyrebird demo flow', async ({ page }) => {
  page.setDefaultTimeout(120000)
  const trackPath = 'music_prod_tts-20260221103606-udrEprgbjcAeqNKa.mp3'
  const trackResponses: number[] = []

  await page.goto('/', { waitUntil: 'networkidle' })

  page.on('response', (response) => {
    if (response.url().includes(trackPath)) {
      trackResponses.push(response.status())
    }
  })

  await expect(page.getByRole('heading', { name: 'Lyrebird' })).toBeVisible()

  await page.getByRole('button', { name: 'Run Yolk', exact: true }).click()
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
  await expect.poll(() => trackResponses.length).toBeGreaterThan(0)
  expect([200, 206]).toContain(trackResponses.at(-1))
  await expect(page.locator('.copilot-card:has(button[aria-label="Load Song Placeholder"]) audio')).toHaveAttribute(
    'src',
    /music_prod_tts-20260221103606-udrEprgbjcAeqNKa\.mp3/,
  )
  await expect
    .poll(async () => {
      const duration = await page.locator('.copilot-card:has(button[aria-label="Load Song Placeholder"]) audio').evaluate(
        (audio) => (audio as HTMLAudioElement).duration,
      )
      return Number.isFinite(duration) && duration > 60
    })
    .toBeTruthy()
  const audioState = await page.locator('.copilot-card:has(button[aria-label="Load Song Placeholder"]) audio').evaluate((audio) => new Promise((resolve) => {
    const element = audio as HTMLAudioElement
    if (element.readyState >= 1) return resolve({ readyState: element.readyState })

    const settle = () => resolve({ readyState: element.readyState, error: element.error ? String(element.error.message || element.error.code) : null })
    element.addEventListener('loadedmetadata', settle, { once: true })
    element.addEventListener('error', settle, { once: true })
    setTimeout(() => settle(), 5000)
  }))
  expect(audioState.readyState).toBeGreaterThan(0)
  expect(audioState).toHaveProperty('readyState')
  await expect(page.locator('audio')).toBeVisible({ timeout: 30000 })
})
