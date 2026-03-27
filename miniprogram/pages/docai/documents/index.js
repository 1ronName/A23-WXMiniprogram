const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')
const {
  forgetDocumentName,
  normalizeFileName,
} = require('../../../utils/document-name')

const FAVORITE_STORAGE_KEY = 'docai_document_favorites'
const UPLOAD_EXTENSIONS = ['docx', 'xlsx', 'md', 'txt']
const CATEGORIES = [
  { key: 'recent', label: '最近' },
  { key: 'favorite', label: '收藏' },
]

const TYPE_META = {
  doc: { badge: 'W', label: 'Word 文档', theme: 'word' },
  docx: { badge: 'W', label: 'Word 文档', theme: 'word' },
  xls: { badge: 'X', label: 'Excel 表格', theme: 'excel' },
  xlsx: { badge: 'X', label: 'Excel 表格', theme: 'excel' },
  pdf: { badge: 'P', label: 'PDF 文档', theme: 'pdf' },
  md: { badge: 'M', label: 'Markdown 文档', theme: 'markdown' },
  txt: { badge: 'T', label: '文本文件', theme: 'text' },
}

function getTimeValue(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getFallbackType(fileName) {
  const parts = String(fileName || '').split('.')
  if (parts.length < 2) {
    return ''
  }

  return String(parts.pop() || '').toLowerCase()
}

function getSelectedFileName(file) {
  const normalizedName = normalizeFileName(file && file.name)
  if (normalizedName) {
    return normalizedName
  }

  const filePath = String((file && (file.path || file.tempFilePath)) || '')
  return normalizeFileName(filePath.split(/[\\/]/).pop())
}

function getUploadStatusText(status) {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === 'parsed') {
    return '已解析'
  }

  if (normalizedStatus === 'parsing') {
    return '解析中'
  }

  if (normalizedStatus === 'failed') {
    return '解析失败'
  }

  if (!normalizedStatus) {
    return '待处理'
  }

  return status
}

function getUploadStatusTone(status) {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === 'parsed') {
    return 'success'
  }

  if (normalizedStatus === 'parsing') {
    return 'warning'
  }

  if (normalizedStatus === 'failed') {
    return 'danger'
  }

  return 'plain'
}

function buildSlideButtons(itemId, isFavorite) {
  const id = String(itemId)

  return [
    {
      text: isFavorite ? '取消收藏' : '收藏',
      extClass: 'document-swipe-btn document-swipe-btn--favorite',
      data: {
        action: 'favorite',
        id,
      },
    },
    {
      type: 'warn',
      text: '删除',
      extClass: 'document-swipe-btn document-swipe-btn--delete',
      data: {
        action: 'delete',
        id,
      },
    },
  ]
}

Page({
  data: {
    loading: false,
    keyword: '',
    showFloatingSearch: false,
    userName: '团队成员',
    avatarText: '团',
    categories: CATEGORIES,
    activeCategory: 'recent',
    favoriteMap: {},
    allDocuments: [],
    documents: [],
    isEmpty: true,
    openSwipeId: '',
    lastPickedFiles: [],
    lastPickedCount: 0,
    lastPickedMoreCount: 0,
  },

  async onShow() {
    if (!ensureLogin()) {
      return
    }

    this.loadUser()
    await this.loadDocuments()
  },

  async onPullDownRefresh() {
    if (!ensureLogin()) {
      wx.stopPullDownRefresh()
      return
    }

    this.loadUser()
    const success = await this.loadDocuments({ silent: true })
    wx.stopPullDownRefresh()

    wx.showToast({
      title: success ? '文档已刷新' : '刷新失败',
      icon: success ? 'success' : 'none',
    })
  },

  onPageScroll(e) {
    const showFloatingSearch = e.scrollTop > 108
    if (showFloatingSearch !== this.data.showFloatingSearch) {
      this.setData({ showFloatingSearch })
    }
  },

  loadUser() {
    const app = getApp()
    const appUser = (app && app.globalData && app.globalData.user) || null
    const cachedUser = wx.getStorageSync('user') || null
    const user = appUser || cachedUser || {}
    const userName = user.nickname || user.username || user.userName || '团队成员'
    const avatarText = String(userName || '文').trim().slice(0, 1).toUpperCase() || '文'

    this.setData({
      userName,
      avatarText,
    })
  },

  loadFavoriteMap() {
    const favoriteMap = wx.getStorageSync(FAVORITE_STORAGE_KEY) || {}
    return favoriteMap && typeof favoriteMap === 'object' ? favoriteMap : {}
  },

  saveFavoriteMap(favoriteMap) {
    wx.setStorageSync(FAVORITE_STORAGE_KEY, favoriteMap)
  },

  getTypeMeta(fileType) {
    const normalizedType = String(fileType || '').toLowerCase()
    const fallbackBadge = (normalizedType || 'F').slice(0, 1).toUpperCase()
    return TYPE_META[normalizedType] || {
      badge: fallbackBadge,
      label: '资料文档',
      theme: 'default',
    }
  },

  formatDate(value) {
    if (!value) {
      return '--'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '--'
    }

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return month + '-' + day + ' ' + hours + ':' + minutes
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

  buildDocument(item, favoriteMap) {
    const title = item.fileName || item.title || '未命名文件'
    const fileType = String(item.fileType || getFallbackType(title)).toLowerCase()
    const typeMeta = this.getTypeMeta(fileType)
    const uploadedAt = item.createdAt || item.updatedAt || ''
    const sortTime = item.createdAt || item.updatedAt || ''
    const authorText = item.author || item.ownerName || item.userName || item.nickname || this.data.userName || '系统用户'
    const statusText = getUploadStatusText(item.uploadStatus)
    const previewText = String(item.docSummary || item.contentText || item.rawText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
    const isFavorite = Boolean(favoriteMap[item.id])

    return Object.assign({}, item, {
      idText: String(item.id),
      title,
      fileType,
      statusText,
      fileBadge: typeMeta.badge,
      fileTheme: typeMeta.theme,
      fileTypeLabel: typeMeta.label,
      fileSizeText: this.formatSize(Number(item.fileSize) || 0),
      authorText,
      uploadedAtText: this.formatDate(uploadedAt),
      uploadedAtValue: getTimeValue(uploadedAt),
      sortTimeValue: getTimeValue(sortTime),
      previewText,
      statusTone: getUploadStatusTone(item.uploadStatus),
      isFavorite,
      slideButtons: buildSlideButtons(item.id, isFavorite),
      searchText: [
        title,
        authorText,
        typeMeta.label,
        fileType,
        statusText,
        previewText,
      ].join(' ').toLowerCase(),
    })
  },

  getCategoryDocuments(list) {
    const categoryKey = this.data.activeCategory
    const nextList = list.slice()

    if (categoryKey === 'favorite') {
      return nextList.filter((item) => item.isFavorite)
    }

    return nextList.sort((left, right) => right.sortTimeValue - left.sortTimeValue).slice(0, 20)
  },

  applyFilters() {
    const keyword = String(this.data.keyword || '').trim().toLowerCase()
    const categoryList = this.getCategoryDocuments(this.data.allDocuments)
    const documents = categoryList.filter((item) => {
      if (!keyword) {
        return true
      }

      return item.searchText.indexOf(keyword) !== -1
    })
    const openSwipeId = documents.some((item) => item.idText === this.data.openSwipeId)
      ? this.data.openSwipeId
      : ''

    this.setData({
      documents,
      isEmpty: documents.length === 0,
      openSwipeId,
    })
  },

  async loadDocuments(options) {
    const settings = Object.assign({
      silent: false,
    }, options || {})

    this.setData({
      loading: true,
      openSwipeId: '',
    })

    try {
      const favoriteMap = this.loadFavoriteMap()
      const res = await api.getSourceDocuments()
      const documents = (res.data || [])
        .map((item) => this.buildDocument(item, favoriteMap))
        .sort((left, right) => right.sortTimeValue - left.sortTimeValue)

      this.setData({
        favoriteMap,
        allDocuments: documents,
      })
      this.applyFilters()
      return true
    } catch (err) {
      if (!settings.silent) {
        wx.showToast({ title: '文档加载失败', icon: 'none' })
      }
      return false
    } finally {
      this.setData({ loading: false })
    }
  },

  onKeywordInput(e) {
    this.setData({
      keyword: e.detail.value || '',
    }, () => {
      this.applyFilters()
    })
  },

  clearKeyword() {
    this.setData({
      keyword: '',
      openSwipeId: '',
    }, () => {
      this.applyFilters()
    })
  },

  switchCategory(e) {
    const activeCategory = e.currentTarget.dataset.key || 'recent'
    this.setData({
      activeCategory,
      openSwipeId: '',
    }, () => {
      this.applyFilters()
    })
  },

  async chooseAndUpload() {
    try {
      const pick = await this.chooseMessageFileAsync({
        count: 9,
        type: 'file',
        extension: UPLOAD_EXTENSIONS,
      })
      const files = pick.tempFiles || []

      if (files.length === 0) {
        return
      }

      const pickedFiles = files.map((file) => ({
        key: String(Math.random()).slice(2),
        name: getSelectedFileName(file),
        sizeText: this.formatSize(Number(file.size) || 0),
      }))

      this.setData({
        lastPickedFiles: pickedFiles.slice(0, 6),
        lastPickedCount: pickedFiles.length,
        lastPickedMoreCount: Math.max(0, pickedFiles.length - 6),
      })

      wx.showLoading({
        title: '正在上传',
        mask: true,
      })

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        await api.uploadDocument(file.path, getSelectedFileName(file))
      }

      const refreshed = await this.loadDocuments({ silent: true })
      wx.showToast({
        title: refreshed ? '上传成功，后台正在解析' : '上传成功，下拉刷新可查看',
        icon: 'success',
      })
    } catch (err) {
      if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
        return
      }

      wx.showToast({
        title: '上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  getDocumentFromEvent(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isNaN(index) && this.data.documents[index]) {
      return this.data.documents[index]
    }

    const id = e.currentTarget.dataset.id
    if (id || id === 0) {
      return this.findDocumentById(id)
    }

    return null
  },

  findDocumentById(id) {
    const docId = String(id)
    for (let index = 0; index < this.data.allDocuments.length; index += 1) {
      const item = this.data.allDocuments[index]
      if (String(item.id) === docId) {
        return item
      }
    }

    return null
  },

  previewDocumentItem(item) {
    if (!item) {
      return
    }

    const summary = item.docSummary || item.contentText || item.rawText || item.previewText || ''
    const content = [
      '状态：' + getUploadStatusText(item.uploadStatus),
      summary
        ? '\n' + String(summary).slice(0, 820)
        : '\n' + (item.uploadStatus === 'parsing'
          ? '文档已上传，DocAI 正在后台抽取字段，请稍后刷新列表再查看摘要或用于智能填表。'
          : '当前暂无可预览摘要。'),
    ].join('')

    wx.showModal({
      title: item.title || '文档预览',
      content: String(content).slice(0, 900),
      showCancel: false,
    })
  },

  previewDoc(e) {
    const item = this.getDocumentFromEvent(e)
    if (!item) {
      return
    }

    if (this.data.openSwipeId && item.idText === this.data.openSwipeId) {
      this.setData({ openSwipeId: '' })
      return
    }

    this.previewDocumentItem(item)
  },

  deleteDocumentFromEvent(e) {
    this.deleteDocumentByItem(this.getDocumentFromEvent(e))
  },

  handleSwipeShow(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id || id === this.data.openSwipeId) {
      return
    }

    this.setData({ openSwipeId: id })
  },

  handleSwipeHide(e) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id || this.data.openSwipeId !== id) {
      return
    }

    this.setData({ openSwipeId: '' })
  },

  handleSwipeButtonTap(e) {
    const detail = e.detail || {}
    const data = detail.data || {}
    const item = this.findDocumentById(data.id)

    this.setData({ openSwipeId: '' })

    if (!item) {
      return
    }

    if (data.action === 'favorite') {
      this.toggleFavoriteByItem(item)
      return
    }

    if (data.action === 'delete') {
      this.deleteDocumentByItem(item)
    }
  },

  goChat() {
    wx.removeStorageSync('docai_current_doc')
    wx.switchTab({ url: '/pages/docai/chat/index' })
  },

  goDashboard() {
    wx.switchTab({ url: '/pages/docai/dashboard/index' })
  },

  openChatWithItem(item) {
    if (!item) {
      return
    }

    wx.setStorageSync('docai_current_doc', {
      id: item.id,
      title: item.title,
    })
    wx.switchTab({ url: '/pages/docai/chat/index' })
  },

  toggleFavoriteByItem(item) {
    if (!item) {
      return
    }

    const favoriteMap = Object.assign({}, this.data.favoriteMap)
    const docId = item.id
    const nextValue = !favoriteMap[docId]

    if (nextValue) {
      favoriteMap[docId] = true
    } else {
      delete favoriteMap[docId]
    }

    this.saveFavoriteMap(favoriteMap)

    const allDocuments = this.data.allDocuments.map((doc) => {
      if (String(doc.id) !== String(docId)) {
        return doc
      }

      return Object.assign({}, doc, {
        isFavorite: nextValue,
        slideButtons: buildSlideButtons(docId, nextValue),
      })
    })

    this.setData({
      favoriteMap,
      allDocuments,
      openSwipeId: '',
    }, () => {
      this.applyFilters()
    })

    wx.showToast({
      title: nextValue ? '已收藏' : '已取消收藏',
      icon: 'none',
    })
  },

  deleteDocumentByItem(item) {
    if (!item) {
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }

        try {
          await api.deleteDocument(item.id)
          forgetDocumentName(item.id)

          const favoriteMap = Object.assign({}, this.data.favoriteMap)
          if (favoriteMap[item.id]) {
            delete favoriteMap[item.id]
            this.saveFavoriteMap(favoriteMap)
          }

          await this.loadDocuments()
          wx.showToast({
            title: '删除成功',
            icon: 'success',
          })
        } catch (err) {
          wx.showToast({
            title: '删除失败',
            icon: 'none',
          })
        }
      },
    })
  },

  onShareAppMessage() {
    return {
      title: '智能文档处理系统',
      path: '/pages/docai/documents/index',
    }
  },

  openMoreActions(e) {
    const item = this.getDocumentFromEvent(e)
    if (!item) {
      return
    }

    this.setData({ openSwipeId: '' })

    const actions = [
      '预览',
      'AI 对话',
    ]

    wx.showActionSheet({
      itemList: actions,
      success: (res) => {
        const action = actions[res.tapIndex]

        if (action === '预览') {
          this.previewDocumentItem(item)
          return
        }

        if (action === 'AI 对话') {
          this.openChatWithItem(item)
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
