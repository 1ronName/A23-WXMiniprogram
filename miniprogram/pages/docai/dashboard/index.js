const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
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
    await this.loadStats()
  },

  async loadStats() {
    try {
      const res = await api.getDocumentStats()
      this.setData({
        stats: res.data || this.data.stats,
      })
    } catch (err) {
      wx.showToast({ title: '统计加载失败', icon: 'none' })
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
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
