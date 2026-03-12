const config = require('./config')

App({
  onLaunch() {
    const token = wx.getStorageSync('token') || ''
    this.globalData.token = token
    this.globalData.isLogin = Boolean(token)
  },

  globalData: {
    apiBaseUrl: config.apiBaseUrl,
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
