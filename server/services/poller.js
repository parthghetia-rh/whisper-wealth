export {
  addSSEClient,
  getRates,
  refreshMarketData,
  startMarketData as startPoller,
  stopMarketData as stopPoller,
  updatePortfolioSnapshot,
  getMarketHealth,
} from './marketDataService.js'

import { refreshMarketData } from './marketDataService.js'

export function triggerQuickRefresh() {
  return refreshMarketData({ reason: 'quick-refresh', force: true })
}

export function triggerPoll() {
  return refreshMarketData({ reason: 'manual-refresh', force: true })
}
