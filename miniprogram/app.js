const config = require('./config')
const initialRuntimeConfig = config && typeof config.getRuntimeConfig === 'function'
  ? config.getRuntimeConfig()
  : config

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function getRuntimeConfig() {
  return config && typeof config.getRuntimeConfig === 'function'
    ? config.getRuntimeConfig()
    : config
}

function getAllowedBaseUrls() {
  const runtimeConfig = getRuntimeConfig()
  return [runtimeConfig.apiBaseUrl].concat(runtimeConfig.apiBaseFallbackUrls || []).map(normalizeBaseUrl).filter(Boolean)
}

App({
  onLaunch() {
    const runtimeConfig = getRuntimeConfig()
    const token = wx.getStorageSync('token') || ''
    const user = wx.getStorageSync('user') || null
    const cachedBaseUrl = normalizeBaseUrl(wx.getStorageSync('docai_api_base_url'))
    const allowedBaseUrls = getAllowedBaseUrls()
    const activeApiBaseUrl = allowedBaseUrls.indexOf(cachedBaseUrl) !== -1
      ? cachedBaseUrl
      : normalizeBaseUrl(runtimeConfig.apiBaseUrl)

    wx.setStorageSync('docai_api_base_url', activeApiBaseUrl)

    this.globalData.token = token
    this.globalData.isLogin = Boolean(token)
    this.globalData.user = user
    this.globalData.apiBaseUrl = normalizeBaseUrl(runtimeConfig.apiBaseUrl)
    this.globalData.activeApiBaseUrl = activeApiBaseUrl
  },

  globalData: {
    apiBaseUrl: normalizeBaseUrl(initialRuntimeConfig.apiBaseUrl),
    activeApiBaseUrl: normalizeBaseUrl(initialRuntimeConfig.apiBaseUrl),
    token: '',
    isLogin: false,
    user: null,
  },

  setAuth(token, user) {
    this.globalData.token = token || ''
    this.globalData.isLogin = Boolean(token)
    this.globalData.user = user || null

    wx.setStorageSync('token', token || '')
    wx.setStorageSync('user', user || null)
  },

  clearAuth() {
    this.globalData.token = ''
    this.globalData.isLogin = false
    this.globalData.user = null

    wx.removeStorageSync('token')
    wx.removeStorageSync('user')
  },
})
