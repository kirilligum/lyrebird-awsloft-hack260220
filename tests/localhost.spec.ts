import { test, expect } from '@playwright/test'

test('localhost lyrebird demo flow', async ({ page }) => {
  page.setDefaultTimeout(120000)

  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: 'Egg → Yolk → Albumen → Song' })).toBeVisible()

  await page.getByRole('button', { name: /Run Yolk/ }).click()
  await expect(page.getByText('Yolk produced explainable facts. Review and transform.')).toBeVisible()

  await page.getByRole('button', { name: '🔍' }).click()
  await page.getByRole('button', { name: '🔎 Find' }).click()
  await expect(page.getByText(/Find matched/)).toBeVisible()

  await page.getByRole('button', { name: '✍️' }).click()
  await page.getByRole('button', { name: '✍️ Replace' }).click()
  await expect(page.getByText(/Replace completed/)).toBeVisible()

  await page.getByRole('button', { name: /Run Albumen Pass/ }).click()
  await expect(page.getByText(/Albumen pass applied/)).toBeVisible()

  await page.getByRole('button', { name: /Run Graph/ }).click()
  await expect(page.getByText('Graph built from mock provenance and transform metadata.')).toBeVisible()

  await page.getByRole('button', { name: /Generate Song/ }).click()
  await expect(page.getByText('Song generated. You can now play the artifact below.', { exact: true })).toBeVisible({ timeout: 30000 })

  await expect(page.locator('audio')).toBeVisible({ timeout: 30000 })
})
