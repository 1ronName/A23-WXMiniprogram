const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
    loading: false,
    templatePath: '',
    templateName: '',
    templateStatusText: '等待选择模板',
    sourceDocCount: 0,
    resultReady: false,
    resultText: '',
    resultMeta: {
      filledCount: 0,
      blankCount: 0,
      totalSlots: 0,
      fillTimeMs: 0,
      fileSizeText: '0 B',
      templateName: '',
    },
  },

  onShow() {
    if (!ensureLogin()) {
      return
    }
    this.loadSourceSummary()
  },

  formatSize(size) {
    if (!size && size !== 0) {
      return '-'
    }

    const kb = 1024
    const mb = kb * 1024
    if (size < kb) {
      return size + ' B'
    }
    if (size < mb) {
      return (size / kb).toFixed(1) + ' KB'
    }
    return (size / mb).toFixed(1) + ' MB'
  },

  async loadSourceSummary() {
    try {
      const res = await api.getSourceDocuments()
      const list = res.data || []
      this.setData({ sourceDocCount: list.length })
    } catch (err) {
      this.setData({ sourceDocCount: 0 })
    }
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
        templateStatusText: '模板已就绪，可开始预览',
        resultReady: false,
        resultText: '',
      })
    } catch (err) {
      wx.showToast({ title: '未选择模板文件', icon: 'none' })
    }
  },

  async startFill() {
    if (!ensureLogin()) {
      return
    }

    if (!this.data.templatePath) {
      wx.showToast({ title: '请先选择模板文件', icon: 'none' })
      return
    }

    this.setData({ loading: true, resultReady: false, resultText: '' })

    try {
      wx.showLoading({ title: '正在上传模板', mask: true })
      const uploadRes = await api.uploadTemplateFile(this.data.templatePath, this.data.templateName)
      const templateId = (uploadRes.data && uploadRes.data.id) || uploadRes.id
      if (!templateId) {
        throw new Error('模板上传失败，未返回模板 ID')
      }

      wx.showLoading({ title: '正在解析模板', mask: true })
      await api.parseTemplateSlots(templateId)

      const sourceIds = await this.getSourceDocIds()
      if (sourceIds.length === 0) {
        wx.showToast({ title: '当前没有可用的来源文档', icon: 'none' })
        return
      }

      wx.showLoading({ title: '正在生成预览', mask: true })
      const res = await api.fillTemplate(templateId, sourceIds)
      const data = res.data || {}

      this.setData({
        resultReady: true,
        resultText: [
          '本次预览已完成。',
          '系统已基于当前模板和来源文档返回填表摘要，可继续用于演示或验证字段匹配效果。',
        ].join('\n'),
        resultMeta: {
          filledCount: data.filledCount || 0,
          blankCount: data.blankCount || 0,
          totalSlots: data.totalSlots || 0,
          fillTimeMs: data.fillTimeMs || 0,
          fileSizeText: this.formatSize(data.fileSize || 0),
          templateName: data.templateName || this.data.templateName || '',
        },
      })
      wx.showToast({ title: '预览生成完成', icon: 'success' })
    } catch (err) {
      this.setData({
        resultReady: true,
        resultText: (err && err.message) || '智能填表失败，请稍后重试。',
      })
      wx.showToast({ title: '智能填表失败', icon: 'none' })
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
