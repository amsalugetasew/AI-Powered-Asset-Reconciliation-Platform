import axios from 'axios'

const CACHE_TTL_MS = 15000
const responseCache = new Map()
const pendingRequests = new Map()

const getCacheKey = (url, options) => {
  const params = options?.params ? JSON.stringify(options.params) : ''
  return `${axios.defaults.headers.common.Authorization || 'anonymous'}:${url}:${params}`
}

export const cachedGet = async (url, options = {}) => {
  const { ttl = CACHE_TTL_MS, force = false, ...axiosOptions } = options
  const key = getCacheKey(url, axiosOptions)
  const cached = responseCache.get(key)

  if (!force && cached && Date.now() - cached.timestamp < ttl) {
    return cached.response
  }

  if (!force && pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }

  const request = axios.get(url, axiosOptions)
    .then(response => {
      responseCache.set(key, { response, timestamp: Date.now() })
      return response
    })
    .finally(() => pendingRequests.delete(key))

  pendingRequests.set(key, request)
  return request
}

export const clearCachedGets = () => {
  responseCache.clear()
  pendingRequests.clear()
}
