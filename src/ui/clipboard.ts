export function copyToClipboard(text: string, renderer?: { isOsc52Supported(): boolean; copyToClipboardOSC52(text: string): boolean }): boolean {
  if (renderer?.isOsc52Supported()) {
    renderer.copyToClipboardOSC52(text)
    return true
  }

  const command = clipboardCommand()
  if (!command) return false

  const process = Bun.spawn(command, {
    stdin: 'pipe',
    stdout: 'ignore',
    stderr: 'ignore'
  })
  process.stdin.write(text)
  process.stdin.end()
  return true
}

function clipboardCommand(): string[] | undefined {
  if (process.platform === 'darwin') return ['pbcopy']
  if (process.platform === 'win32') return ['clip']

  if (Bun.which('wl-copy')) return ['wl-copy']
  if (Bun.which('xclip')) return ['xclip', '-selection', 'clipboard']
  if (Bun.which('xsel')) return ['xsel', '--clipboard', '--input']

  return undefined
}
