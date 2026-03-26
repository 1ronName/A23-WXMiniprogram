const config = require('./config')

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function getAllowedBaseUrls() {
  return [config.apiBaseUrl].concat(config.apiBaseFallbackUrls || []).map(normalizeBaseUrl).filter(Boolean)
}

App({
  onLaunch() {
    const token = wx.getStorageSync('token') || ''
    const user = wx.getStorageSync('user') || null
    const cachedBaseUrl = normalizeBaseUrl(wx.getStorageSync('docai_api_base_url'))
    const allowedBaseUrls = getAllowedBaseUrls()
    const activeApiBaseUrl = allowedBaseUrls.indexOf(cachedBaseUrl) !== -1
      ? cachedBaseUrl
      : normalizeBaseUrl(config.apiBaseUrl)

    wx.setStorageSync('docai_api_base_url', activeApiBaseUrl)

    this.globalData.token = token
    this.globalData.isLogin = Boolean(token)
    this.globalData.user = user
    this.globalData.apiBaseUrl = normalizeBaseUrl(config.apiBaseUrl)
    this.globalData.activeApiBaseUrl = activeApiBaseUrl
  },

  globalData: {
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
    activeApiBaseUrl: normalizeBaseUrl(config.apiBaseUrl),
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
