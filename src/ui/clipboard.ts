import { spawn, spawnSync } from 'node:child_process'

export function copyToClipboard(
  text: string,
  renderer?: { isOsc52Supported(): boolean; copyToClipboardOSC52(text: string): boolean }
): boolean {
  if (renderer?.isOsc52Supported()) {
    renderer.copyToClipboardOSC52(text)
    return true
  }

  const command = clipboardCommand()
  if (!command) return false

  const child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'ignore', 'ignore'] })
  child.stdin.write(text)
  child.stdin.end()
  return true
}

function clipboardCommand(): string[] | undefined {
  if (process.platform === 'darwin') return ['pbcopy']
  if (process.platform === 'win32') return ['clip']

  if (hasCommand('wl-copy')) return ['wl-copy']
  if (hasCommand('xclip')) return ['xclip', '-selection', 'clipboard']
  if (hasCommand('xsel')) return ['xsel', '--clipboard', '--input']

  return undefined
}

function hasCommand(command: string): boolean {
  if (process.platform === 'win32') {
    return spawnSync('where', [command], { stdio: 'ignore' }).status === 0
  }

  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0
}
