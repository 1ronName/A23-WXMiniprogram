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

  goDocuments() {
    wx.switchTab({ url: '/pages/docai/documents/index' })
  },

  goAutoFill() {
    wx.switchTab({ url: '/pages/docai/autofill/index' })
  },

  goChat() {
    wx.switchTab({ url: '/pages/docai/chat/index' })
  },

  goGenerate() {
    wx.switchTab({ url: '/pages/docai/generate/index' })
  },
})
