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
      // 第一步：上传模板，获取 templateId
      wx.showLoading({ title: '上传模板中', mask: true })
      const uploadRes = await api.uploadTemplateFile(this.data.templatePath, this.data.templateName)
      const templateId = (uploadRes.data && uploadRes.data.id) || uploadRes.id
      if (!templateId) {
        throw new Error('模板上传失败，未返回模板ID')
      }

      // 第二步：解析模板槽位
      wx.showLoading({ title: '解析模板中', mask: true })
      await api.parseTemplateSlots(templateId)

      // 第三步：获取用户源文档 ID 列表
      const sourceIds = await this.getSourceDocIds()
      if (sourceIds.length === 0) {
        wx.showToast({ title: '暂无可用文档数据', icon: 'none' })
        return
      }

      // 第四步：执行自动填表
      wx.showLoading({ title: '自动填表中', mask: true })
      const res = await api.fillTemplate(templateId, sourceIds)
      const data = res.data || {}
      const summary = [
        '填表完成！',
        '已填槽位：' + (data.filledCount || 0),
        '未填槽位：' + (data.blankCount || 0),
        '总槽位数：' + (data.totalSlots || 0),
        '模板ID：' + templateId,
      ].join('\n')
      this.setData({ resultText: summary })
      wx.showToast({ title: '填表完成', icon: 'success' })
    } catch (err) {
      this.setData({
        resultText: (err && err.message) || '填表失败',
      })
      wx.showToast({ title: '填表失败', icon: 'none' })
    } finally {
      wx.hideLoading()
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
      const res = await api.getSourceDocuments()
      const list = res.data || []
      return list
        .filter((item) => Boolean(item && item.id))
        .slice(0, 10)
        .map((item) => item.id)
    } catch (err) {
      return []
    }
  },
})
