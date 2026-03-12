const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
    loading: false,
    templatePath: '',
    templateName: '',
    resultText: '',
  },

  onShow() {
    ensureLogin()
  },

  async chooseTemplate() {
    try {
      const pick = await this.chooseMessageFileAsync({
        count: 1,
        type: 'file',
        extension: ['docx', 'xlsx'],
      })
      const file = (pick.tempFiles || [])[0]
      if (!file) {
        return
      }
      this.setData({
        templatePath: file.path,
        templateName: file.name,
      })
    } catch (err) {
      wx.showToast({ title: '未选择文件', icon: 'none' })
    }
  },

  async startFill() {
    if (!ensureLogin()) {
      return
    }
    if (!this.data.templatePath) {
      wx.showToast({ title: '请先选择模板', icon: 'none' })
      return
    }

    this.setData({ loading: true, resultText: '' })
    try {
      const sourceIds = await this.getSourceDocIds()
      if (sourceIds.length === 0) {
        wx.showToast({ title: '暂无可用文档数据', icon: 'none' })
        return
      }

      const res = await api.autoFillPreview(this.data.templatePath, sourceIds)
      const data = res.data || res
      this.setData({
        resultText: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      })
      wx.showToast({ title: '预览完成', icon: 'success' })
    } catch (err) {
      this.setData({
        resultText: (err && err.message) || '预览失败',
      })
      wx.showToast({ title: '预览失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  chooseMessageFileAsync(options) {
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile(Object.assign({}, options, {
        success: resolve,
        fail: reject,
      }))
    })
  },

  async getSourceDocIds() {
    try {
      const res = await api.getDocuments({ page: 1, size: 20 })
      const pageData = res.data || {}
      const list = pageData.records || pageData || []
      return list
        .filter((item) => Boolean(item && item.id))
        .slice(0, 5)
        .map((item) => item.id)
    } catch (err) {
      return []
    }
  },
})
