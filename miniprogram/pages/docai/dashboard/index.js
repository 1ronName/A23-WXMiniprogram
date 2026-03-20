const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

function formatTime(ts) {
  const date = ts ? new Date(ts) : new Date()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return hours + ':' + minutes
}

Page({
  data: {
    userName: '团队成员',
    lastUpdated: '--:--',
    stats: {
      total: 0,
      docx: 0,
      xlsx: 0,
      txt: 0,
      md: 0,
    },
  },

  async onShow() {
    if (!ensureLogin()) {
      return
    }

    this.loadUser()
    await this.loadStats()
  },

  loadUser() {
    const app = getApp()
    const appUser = (app && app.globalData && app.globalData.user) || null
    const cachedUser = wx.getStorageSync('user') || null
    const user = appUser || cachedUser || {}
    const userName = user.username || user.nickname || '团队成员'
    this.setData({ userName })
  },

  async loadStats() {
    try {
      const res = await api.getDocumentStats()
      this.setData({
        stats: res.data || this.data.stats,
        lastUpdated: formatTime(Date.now()),
      })
    } catch (err) {
      wx.showToast({ title: '统计加载失败', icon: 'none' })
    }
  },

  goDocuments() {
    wx.switchTab({ url: '/pages/docai/documents/index' })
  },

  goAutofill() {
    wx.switchTab({ url: '/pages/docai/autofill/index' })
  },

  goChat() {
    wx.switchTab({ url: '/pages/docai/chat/index' })
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
