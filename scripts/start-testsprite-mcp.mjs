#!/usr/bin/env node
import { spawn } from 'node:child_process'

const key = process.env.TESTSPRITE_API_KEY || process.env.API_KEY
if (!key) {
  console.error('Missing TestSprite API key: set TESTSPRITE_API_KEY (preferred) or API_KEY and retry.')
  process.exit(1)
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(
  command,
  ['-y', '@testsprite/testsprite-mcp@latest', 'server'],
  {
    env: {
      ...process.env,
      API_KEY: key,
    },
    stdio: 'inherit',
  },
)

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
