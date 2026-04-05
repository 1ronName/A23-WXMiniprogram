/**
 * DocAI mini program configuration.
 */

const DEVTOOLS_API_BASE_URL = 'http://127.0.0.1:8080/api/v1'
const DEVTOOLS_API_FALLBACK_URLS = ['http://127.0.0.1:18080/api/v1']
// Update these two URLs when the computer joins a different LAN.
const REAL_DEVICE_API_BASE_URL = 'http://10.76.87.179:8080/api/v1'
const REAL_DEVICE_API_FALLBACK_URLS = ['http://10.76.87.179:18080/api/v1']
const REMOTE_API_BASE_URL = 'https://docai.sa1.tunnelfrp.com/api/v1'
const REMOTE_API_FALLBACK_URLS = []
const REMOTE_WEB_BASE_URL = 'https://docai.sa1.tunnelfrp.com'

// Set this to false to switch back to README "Method 1" local mode.
const useRemoteApiBaseUrl = true

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function uniqueUrls(list) {
  const result = []

  ;(list || []).forEach((item) => {
    const value = normalizeBaseUrl(item)
    if (!value || result.indexOf(value) !== -1) {
      return
    }

    result.push(value)
  })

  return result
}

function normalizePath(path) {
  const value = String(path || '').trim()
  if (!value) {
    return ''
  }

  return '/' + value.replace(/^\/+/, '')
}

function buildQueryString(query) {
  const pairs = []

  Object.keys(query || {}).forEach((key) => {
    const value = query[key]
    if (value === undefined || value === null || value === '') {
      return
    }

    pairs.push(
      encodeURIComponent(key) + '=' + encodeURIComponent(String(value))
    )
  })

  return pairs.join('&')
}

function buildRemoteWebUrl(path, query) {
  const baseUrl = normalizeBaseUrl(REMOTE_WEB_BASE_URL)
  if (!baseUrl) {
    return ''
  }

  const normalizedPath = normalizePath(path)
  const queryString = buildQueryString(query)
  const url = normalizedPath ? baseUrl + normalizedPath : baseUrl

  return queryString ? url + '?' + queryString : url
}

function detectRuntimePlatform() {
  if (typeof wx === 'undefined' || !wx || typeof wx.getSystemInfoSync !== 'function') {
    return 'devtools'
  }

  try {
    const systemInfo = wx.getSystemInfoSync() || {}
    const platform = String(systemInfo.platform || '').toLowerCase()
    return platform || 'devtools'
  } catch (err) {
    return 'devtools'
  }
}

function isRealDevicePlatform(platform) {
  return Boolean(platform) && platform !== 'devtools'
}

function buildRuntimeApiConfig(platform) {
  if (useRemoteApiBaseUrl) {
    return {
      apiBaseUrl: REMOTE_API_BASE_URL,
      apiBaseFallbackUrls: REMOTE_API_FALLBACK_URLS,
    }
  }

  if (isRealDevicePlatform(platform)) {
    return {
      apiBaseUrl: REAL_DEVICE_API_BASE_URL,
      apiBaseFallbackUrls: REAL_DEVICE_API_FALLBACK_URLS,
    }
  }

  return {
    apiBaseUrl: DEVTOOLS_API_BASE_URL,
    apiBaseFallbackUrls: DEVTOOLS_API_FALLBACK_URLS,
  }
}

function getRuntimeConfig() {
  const runtimeApiConfig = buildRuntimeApiConfig(detectRuntimePlatform())

  return {
    apiBaseUrl: normalizeBaseUrl(runtimeApiConfig.apiBaseUrl),
    apiBaseFallbackUrls: uniqueUrls(runtimeApiConfig.apiBaseFallbackUrls),
    remoteApiBaseUrl: normalizeBaseUrl(REMOTE_API_BASE_URL),
    remoteWebBaseUrl: normalizeBaseUrl(REMOTE_WEB_BASE_URL),
    requestTimeout: 120000,
    aiRequestTimeout: 300000,
  }
}

const runtimeConfig = getRuntimeConfig()

const config = {
  devtoolsApiBaseUrl: normalizeBaseUrl(DEVTOOLS_API_BASE_URL),
  devtoolsApiBaseFallbackUrls: uniqueUrls(DEVTOOLS_API_FALLBACK_URLS),
  realDeviceApiBaseUrl: normalizeBaseUrl(REAL_DEVICE_API_BASE_URL),
  realDeviceApiBaseFallbackUrls: uniqueUrls(REAL_DEVICE_API_FALLBACK_URLS),
  remoteApiBaseUrl: normalizeBaseUrl(REMOTE_API_BASE_URL),
  remoteApiBaseFallbackUrls: uniqueUrls(REMOTE_API_FALLBACK_URLS),
  remoteWebBaseUrl: normalizeBaseUrl(REMOTE_WEB_BASE_URL),
  useRemoteApiBaseUrl,
  detectRuntimePlatform,
  getRuntimeConfig,
  buildRemoteWebUrl,
  apiBaseUrl: runtimeConfig.apiBaseUrl,
  apiBaseFallbackUrls: runtimeConfig.apiBaseFallbackUrls,
  requestTimeout: runtimeConfig.requestTimeout,
  aiRequestTimeout: runtimeConfig.aiRequestTimeout,
}

module.exports = config
