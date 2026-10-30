import client from './client.js'
import { filterParams } from './candidates.js'

// GET /api/candidates/summary → { pending, approved, declined, joined }, counted by the
// server over the candidates this user can see (no need to download them all).
export async function getDashboardSummary(filters = {}) {
  const response = await client.get('/api/candidates/summary', { params: filterParams(filters) })
  return response.data
}
