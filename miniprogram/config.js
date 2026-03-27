/**
 * DocAI mini program configuration.
 */

const LOCAL_API_BASE_URL = 'http://127.0.0.1:8080/api/v1'
const LOCAL_API_FALLBACK_URLS = ['http://127.0.0.1:18080/api/v1']
const REMOTE_API_BASE_URL = 'http://docai.sa1.tunnelfrp.com/api/v1'
const REMOTE_API_FALLBACK_URLS = [LOCAL_API_BASE_URL].concat(LOCAL_API_FALLBACK_URLS)

// Keep local mode as the default. Set this to true to use README "Method 2".
const useRemoteApiBaseUrl = false

const config = {
  apiBaseUrl: useRemoteApiBaseUrl ? REMOTE_API_BASE_URL : LOCAL_API_BASE_URL,
  apiBaseFallbackUrls: useRemoteApiBaseUrl ? REMOTE_API_FALLBACK_URLS : LOCAL_API_FALLBACK_URLS,
  remoteApiBaseUrl: REMOTE_API_BASE_URL,
  requestTimeout: 120000,
  aiRequestTimeout: 300000,
}

module.exports = config
