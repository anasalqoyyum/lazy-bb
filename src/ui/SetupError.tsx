import { useKeyboard, useRenderer } from '@opentui/react'
import { theme } from './theme'

type Props = {
  message: string
}

export function SetupError({ message }: Props) {
  const renderer = useRenderer()

  useKeyboard(key => {
    if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      renderer.destroy()
    }
  })

  return (
    <box width="100%" height="100%" backgroundColor={theme.bg} alignItems="center" justifyContent="center">
      <box width={72} borderStyle="rounded" borderColor={theme.danger} padding={2} flexDirection="column" gap={1}>
        <text fg={theme.danger}>lazybb setup error</text>
        <text fg={theme.text}>{message}</text>
        <text fg={theme.muted}>
          Set BKT_USER, BKT_TOKEN, and BKT_WORKSPACE. BKT_WORKSPACE can be inferred from a Bitbucket git remote. Optional: BKT_REPOS,
          BKT_FILTER, BKT_CACHE_TTL seconds.
        </text>
        <text fg={theme.muted}>Press q to quit.</text>
      </box>
    </box>
  )
}
