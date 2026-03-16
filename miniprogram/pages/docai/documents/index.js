const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
    loading: false,
    keyword: '',
    typeOptions: ['全部类型', 'docx', 'xlsx', 'txt', 'md'],
    typeIndex: 0,
    documents: [],
  },

  async onShow() {
    if (!ensureLogin()) {
      return
    }
    await this.loadDocuments()
  },

  async onPullDownRefresh() {
    await this.loadDocuments()
    wx.stopPullDownRefresh()
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value.trim() })
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) })
    this.loadDocuments()
  },

  formatDate(ts) {
    if (!ts) {
      return '-'
    }
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return y + '-' + m + '-' + day + ' ' + h + ':' + mm
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

  async loadDocuments() {
    this.setData({ loading: true })
    try {
      const selectedType = this.data.typeOptions[this.data.typeIndex]
      const keyword = this.data.keyword.toLowerCase()

      // /source/documents 返回当前用户全部文档（数组）
      const res = await api.getSourceDocuments()
      let rawList = res.data || []

      // 客户端过滤类型
      if (selectedType !== '全部类型') {
        rawList = rawList.filter((item) => item.fileType === selectedType)
      }
      // 客户端关键词过滤
      if (keyword) {
        rawList = rawList.filter((item) =>
          (item.fileName || '').toLowerCase().includes(keyword)
        )
      }

      const list = rawList.map((item) => {
        return Object.assign({}, item, {
          // WXML 模板使用 title 字段，映射到 fileName
          title: item.fileName || '',
          createdAtText: this.formatDate(item.createdAt),
          fileSizeText: this.formatSize(item.fileSize),
        })
      })
      this.setData({ documents: list })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async chooseAndUpload() {
    try {
      const pick = await this.chooseMessageFileAsync({
        count: 5,
        type: 'file',
        extension: ['docx', 'xlsx', 'txt', 'md'],
      })

      const files = pick.tempFiles || []
      if (files.length === 0) {
        return
      }

      wx.showLoading({ title: '上传中', mask: true })
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]
        await api.uploadDocument(file.path, file.name)
      }
      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
      this.loadDocuments()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  previewDoc(e) {
    const item = this.data.documents[e.currentTarget.dataset.index]
    const content = item.docSummary || item.contentText || item.rawText || '暂无可预览内容'
    wx.showModal({
      title: item.title || '文档预览',
      content: String(content).slice(0, 900),
      showCancel: false,
    })
  },

  openInChat(e) {
    const item = this.data.documents[e.currentTarget.dataset.index]
    wx.setStorageSync('docai_current_doc', {
      id: item.id,
      title: item.fileName || item.title || '',
    })
    wx.switchTab({ url: '/pages/docai/chat/index' })
  },

  deleteDoc(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        try {
          await api.deleteDocument(id)
          wx.showToast({ title: '删除成功', icon: 'success' })
          this.loadDocuments()
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
    })
  },

  chooseMessageFileAsync(options) {
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile(Object.assign({}, options, {
        success: resolve,
        fail: reject,
      }))
    })
  },
})
