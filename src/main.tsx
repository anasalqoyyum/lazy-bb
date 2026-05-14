import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { loadConfig } from './config'
import { App } from './ui/App'
import { SetupError } from './ui/SetupError'

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  consoleMode: 'disabled'
})

const root = createRoot(renderer)

try {
  const config = await loadConfig()
  root.render(<App config={config} />)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  root.render(<SetupError message={message} />)
}
