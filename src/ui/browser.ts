import { spawn } from 'node:child_process'

export function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url] : ['xdg-open', url]
  spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' }).unref()
}
