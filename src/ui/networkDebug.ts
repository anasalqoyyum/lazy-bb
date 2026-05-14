import type { NetworkRequestLog } from '../bitbucket/client'

export function renderNetworkRequests(requests: NetworkRequestLog[]): string {
  if (requests.length === 0) return 'No requests yet'

  return requests
    .map(request => {
      const time = request.timestamp.toLocaleTimeString(undefined, {
        hour12: false
      })
      const status = request.cached ? 'CACHE' : request.status
      return `${time} ${request.method} ${status} ${request.durationMs}ms ${request.url}`
    })
    .join('\n')
}
