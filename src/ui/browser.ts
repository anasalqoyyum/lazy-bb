export function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['cmd', '/c', 'start', '', url] : ['xdg-open', url]
  Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' })
}
