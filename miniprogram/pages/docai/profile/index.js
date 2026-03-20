const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
    userName: '团队成员',
    userEmail: '',
    avatarText: '团',
  },

  onShow() {
    if (!ensureLogin()) {
      return
    }

    this.loadUser()
  },

  loadUser() {
    const app = getApp()
    const appUser = (app && app.globalData && app.globalData.user) || null
    const cachedUser = wx.getStorageSync('user') || null
    const user = appUser || cachedUser || {}
    const userName = user.nickname || user.username || user.userName || '团队成员'
    const userEmail = user.email || ''
    const avatarText = String(userName || '团').trim().slice(0, 1).toUpperCase() || '团'

    this.setData({
      userName,
      userEmail,
      avatarText,
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号并返回登录页吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        const app = getApp()
        if (app && app.clearAuth) {
          app.clearAuth()
        }

        wx.removeStorageSync('docai_current_doc')
        wx.reLaunch({ url: '/pages/docai/login/index' })
      },
    })
  },
})
