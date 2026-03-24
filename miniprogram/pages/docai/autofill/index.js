const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

function isParsedDocument(item) {
  const status = String((item && item.uploadStatus) || '').toLowerCase()
  return status === 'parsed' || (!status && item && item.docSummary)
}

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
      this.setData({
        sourceDocCount: list.filter(isParsedDocument).length,
      })
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
        templateStatusText: '模板已就绪，可开始填充',
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
      const startedAt = Date.now()

      wx.showLoading({ title: '正在上传模板', mask: true })
      const uploadRes = await api.uploadTemplateFile(this.data.templatePath)
      const templateInfo = (uploadRes && uploadRes.data) || {}
      const templateId = (uploadRes.data && uploadRes.data.id) || uploadRes.id
      if (!templateId) {
        throw new Error('模板上传失败，未返回模板 ID')
      }

      this.setData({
        templateStatusText: '模板已上传，正在解析槽位',
      })

      wx.showLoading({ title: '正在解析模板', mask: true })
      const parseRes = await api.parseTemplateSlots(templateId)
      const slots = parseRes.data || []
      this.setData({
        templateStatusText: '模板已解析，识别到 ' + slots.length + ' 个槽位',
      })

      const sourceIds = await this.getSourceDocIds()
      if (sourceIds.length === 0) {
        wx.showToast({ title: '当前没有已解析完成的来源文档', icon: 'none' })
        return
      }

      wx.showLoading({ title: '正在执行填表', mask: true })
      const res = await api.fillTemplate(templateId, sourceIds)
      const data = res.data || {}
      const outputFile = String(data.outputFile || '')
      const outputName = outputFile ? outputFile.split(/[\\/]/).pop() : ''
      const decisions = Array.isArray(data.decisions) ? data.decisions : []

      this.setData({
        resultReady: true,
        resultText: [
          '本次智能填表已完成。',
          '已使用 ' + sourceIds.length + ' 份已解析来源文档参与填充。',
          data.auditId ? '审计编号：' + data.auditId : '',
          outputName ? '结果文件：' + outputName : '',
          decisions.length ? '已返回 ' + decisions.length + ' 条决策记录。' : '',
        ].filter(Boolean).join('\n'),
        resultMeta: {
          filledCount: data.filledCount || 0,
          blankCount: data.blankCount || 0,
          totalSlots: data.totalSlots || slots.length || 0,
          fillTimeMs: Date.now() - startedAt,
          fileSizeText: this.formatSize(templateInfo.fileSize || 0),
          templateName: templateInfo.fileName || this.data.templateName || '',
        },
      })
      wx.showToast({ title: '填表完成', icon: 'success' })
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
        .filter((item) => Boolean(item && item.id) && isParsedDocument(item))
        .slice(0, 10)
        .map((item) => item.id)
    } catch (err) {
      return []
    }
  },
})
