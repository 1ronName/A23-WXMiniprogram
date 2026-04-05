const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')
const {
  loadAutofillDraft,
  updateAutofillDraft,
} = require('../../../utils/autofill-draft')

const SOURCE_EXTENSIONS = ['docx', 'xlsx', 'txt', 'md']
const TEMPLATE_EXTENSIONS = ['docx', 'xlsx']
const SOURCE_POLL_INTERVAL = 4000

function toStageKey(doc) {
  const uploadStatus = String((doc && doc.uploadStatus) || '').toLowerCase()
  const questionStageKey = String((doc && doc.questionStageKey) || '').toLowerCase()

  if (questionStageKey) {
    return questionStageKey
  }

  if (uploadStatus === 'failed') {
    return 'failed'
  }

  if (uploadStatus === 'parsing') {
    return 'parsing'
  }

  if (doc && (doc.canChat === true || uploadStatus === 'parsed' || doc.docSummary)) {
    return 'ready'
  }

  return 'uploaded'
}

function isReadyDoc(doc) {
  return toStageKey(doc) === 'ready'
}

function buildMissingDoc(id, fallbackDoc) {
  const fileName = String((fallbackDoc && fallbackDoc.fileName) || '').trim()

  return {
    id: String(id),
    fileName: fileName || '已不存在的资料',
    fileType: String((fallbackDoc && fallbackDoc.fileType) || '').toLowerCase(),
    uploadStatus: 'missing',
    questionStageKey: 'failed',
    questionStageText: '资料不存在',
    questionStageDesc: '该文档已无法从 DocAI 当前列表中获取，请先将它移出选择。',
    questionStageTone: 'danger',
    canChat: false,
  }
}

function buildSourceCard(doc, selectedIds) {
  const stageKey = toStageKey(doc)
  const isSelected = (selectedIds || []).indexOf(String(doc.id)) !== -1
  const typeText = String((doc.fileType || '').toUpperCase() || 'FILE')

  let stageTone = 'plain'
  if (stageKey === 'ready') {
    stageTone = 'success'
  } else if (stageKey === 'parsing') {
    stageTone = 'warning'
  } else if (stageKey === 'indexing') {
    stageTone = 'info'
  } else if (stageKey === 'failed') {
    stageTone = 'danger'
  }

  const selectDisabled = !isSelected && stageKey === 'failed'
  const actionText = isSelected
    ? '移出已选'
    : (selectDisabled ? '不可选择' : '加入选择')

  return Object.assign({}, doc, {
    id: String(doc.id),
    stageKey,
    stageTone,
    stageText: doc.questionStageText || '待处理',
    stageDesc: doc.questionStageDesc || '当前资料还没有可用的处理说明。',
    selected: isSelected,
    selectDisabled,
    actionText,
    typeText,
  })
}

function mergeSelectedDocs(list, selectedIds, draftDocs) {
  const documents = Array.isArray(list) ? list : []
  const fallbackDocs = Array.isArray(draftDocs) ? draftDocs : []

  return (selectedIds || []).map((id) => {
    const matchedDoc = documents.find((item) => String(item.id) === String(id))
    if (matchedDoc) {
      return matchedDoc
    }

    const fallbackDoc = fallbackDocs.find((item) => String(item.id) === String(id))
    return buildMissingDoc(id, fallbackDoc)
  })
}

function summarizeSelection(sourceDocs) {
  const docs = Array.isArray(sourceDocs) ? sourceDocs : []

  return docs.reduce((summary, item) => {
    summary.total += 1

    const stageKey = toStageKey(item)
    if (stageKey === 'ready') {
      summary.ready += 1
    } else if (stageKey === 'failed') {
      summary.failed += 1
    } else {
      summary.pending += 1
    }

    return summary
  }, {
    total: 0,
    ready: 0,
    pending: 0,
    failed: 0,
  })
}

function trimErrorMessage(message, fallback) {
  const text = String(message || '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

Page({
  data: {
    mode: 'source',
    loading: false,
    uploading: false,
    documents: [],
    selectedDocIds: [],
    selectionSummary: {
      total: 0,
      ready: 0,
      pending: 0,
      failed: 0,
    },
    sourceTipText: '先选择或上传数据源文档，再进入模板选择。',
    templateName: '',
    templateLocalPath: '',
    sourcePreview: [],
    sourceCount: 0,
  },

  onLoad(options) {
    const mode = options && options.mode === 'template' ? 'template' : 'source'
    this.setData({ mode })

    wx.setNavigationBarTitle({
      title: mode === 'source' ? '选择数据源' : '选择模板',
    })

    if (!ensureLogin()) {
      return
    }

    if (mode === 'source') {
      this.loadSourceMode()
      return
    }

    this.loadTemplateMode()
  },

  onShow() {
    if (!ensureLogin()) {
      return
    }

    if (this.data.mode === 'template') {
      this.loadTemplateMode()
    }
  },

  onHide() {
    this.clearSourcePolling()
  },

  onUnload() {
    this.clearSourcePolling()
  },

  chooseMessageFileAsync(options) {
    return new Promise((resolve, reject) => {
      wx.chooseMessageFile(Object.assign({}, options, {
        success: resolve,
        fail: reject,
      }))
    })
  },

  clearSourcePolling() {
    if (this.sourcePollTimer) {
      clearTimeout(this.sourcePollTimer)
      this.sourcePollTimer = null
    }
  },

  scheduleSourcePolling() {
    this.clearSourcePolling()

    const shouldPoll = (this.data.documents || []).some((item) => {
      const stageKey = item.stageKey || toStageKey(item)
      return stageKey === 'uploaded' || stageKey === 'parsing' || stageKey === 'indexing'
    })

    if (!shouldPoll) {
      return
    }

    this.sourcePollTimer = setTimeout(() => {
      this.loadSourceMode({ silent: true })
    }, SOURCE_POLL_INTERVAL)
  },

  async loadSourceMode(options) {
    const silent = Boolean(options && options.silent)
    const draft = loadAutofillDraft()
    const selectedDocIds = (draft.sourceDocIds || []).map(String)

    if (!silent) {
      this.setData({ loading: true })
    }

    try {
      const res = await api.getSourceDocuments()
      const rawDocuments = Array.isArray(res.data) ? res.data : []
      const documents = rawDocuments.map((item) => buildSourceCard(item, selectedDocIds))
      const selectedDocs = mergeSelectedDocs(documents, selectedDocIds, draft.sourceDocs)
      const selectionSummary = summarizeSelection(selectedDocs)

      updateAutofillDraft({
        sourceDocIds: selectedDocs.map((item) => item.id),
        sourceDocs: selectedDocs,
        parsedReadyCount: selectionSummary.ready,
      })

      this.setData({
        documents,
        selectedDocIds: selectedDocs.map((item) => item.id),
        selectionSummary,
        sourceTipText: selectionSummary.total > 0
          ? '已选 ' + selectionSummary.total + ' 份资料，可继续进入模板步骤。'
          : '先选择至少 1 份数据源文档，再进入模板选择。',
      })

      this.scheduleSourcePolling()
    } catch (err) {
      this.setData({
        documents: [],
        sourceTipText: trimErrorMessage(err && err.message, '当前无法加载来源文档列表，请稍后重试。'),
      })
      this.clearSourcePolling()
    } finally {
      if (!silent) {
        this.setData({ loading: false })
      }
    }
  },

  loadTemplateMode() {
    const draft = loadAutofillDraft()
    const sourceDocs = Array.isArray(draft.sourceDocs) ? draft.sourceDocs : []

    this.setData({
      templateName: draft.templateName || '',
      templateLocalPath: draft.templateLocalPath || '',
      sourceCount: sourceDocs.length,
      sourcePreview: sourceDocs.slice(0, 3).map((item) => ({
        id: item.id,
        fileName: item.fileName,
      })),
    })
  },

  toggleSourceSelection(e) {
    const docId = String((e.currentTarget.dataset && e.currentTarget.dataset.id) || '')
    if (!docId) {
      return
    }

    const documents = this.data.documents || []
    const targetDoc = documents.find((item) => String(item.id) === docId)
    if (!targetDoc) {
      return
    }

    if (targetDoc.selectDisabled && !targetDoc.selected) {
      wx.showToast({
        title: '处理失败的资料不能继续用于填表',
        icon: 'none',
      })
      return
    }

    const nextSelectedIds = (this.data.selectedDocIds || []).slice()
    const currentIndex = nextSelectedIds.indexOf(docId)

    if (currentIndex >= 0) {
      nextSelectedIds.splice(currentIndex, 1)
    } else {
      nextSelectedIds.push(docId)
    }

    const nextDocuments = documents.map((item) => buildSourceCard(item, nextSelectedIds))
    const draft = loadAutofillDraft()
    const selectedDocs = mergeSelectedDocs(nextDocuments, nextSelectedIds, draft.sourceDocs)
    const selectionSummary = summarizeSelection(selectedDocs)

    updateAutofillDraft({
      sourceDocIds: nextSelectedIds,
      sourceDocs: selectedDocs,
      parsedReadyCount: selectionSummary.ready,
    })

    this.setData({
      documents: nextDocuments,
      selectedDocIds: nextSelectedIds,
      selectionSummary,
      sourceTipText: selectionSummary.total > 0
        ? '已选 ' + selectionSummary.total + ' 份资料，可继续进入模板步骤。'
        : '先选择至少 1 份数据源文档，再进入模板选择。',
    })
  },

  async uploadSourceFiles() {
    if (!ensureLogin() || this.data.uploading) {
      return
    }

    try {
      const pickRes = await this.chooseMessageFileAsync({
        count: 10,
        type: 'file',
        extension: SOURCE_EXTENSIONS,
      })
      const files = Array.isArray(pickRes && pickRes.tempFiles) ? pickRes.tempFiles : []
      if (files.length <= 0) {
        return
      }

      this.setData({ uploading: true })
      wx.showLoading({
        title: '正在上传资料',
        mask: true,
      })

      const uploadedDocs = []
      let successCount = 0

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index] || {}
        const fileName = String(file.name || '').trim()
        const filePath = String(file.path || '').trim()
        if (!fileName || !filePath) {
          continue
        }

        try {
          const res = await api.uploadDocument(filePath, fileName)
          const uploadedDoc = (res && res.data) || res || {}
          if (uploadedDoc && (uploadedDoc.id || uploadedDoc.id === 0)) {
            uploadedDocs.push(uploadedDoc)
            successCount += 1
          }
        } catch (err) {
          // keep uploading the rest of the files
        }
      }

      const currentDraft = loadAutofillDraft()
      const selectedDocIds = (this.data.selectedDocIds || [])
        .concat(uploadedDocs.map((item) => String(item.id)))
        .filter((item, index, list) => list.indexOf(item) === index)
      const selectedDocs = mergeSelectedDocs(
        (this.data.documents || []).concat(uploadedDocs).map((item) => buildSourceCard(item, selectedDocIds)),
        selectedDocIds,
        currentDraft.sourceDocs
      )
      const selectionSummary = summarizeSelection(selectedDocs)

      updateAutofillDraft({
        sourceDocIds: selectedDocIds,
        sourceDocs: selectedDocs,
        parsedReadyCount: selectionSummary.ready,
      })

      await this.loadSourceMode({ silent: true })

      wx.showToast({
        title: successCount > 0 ? '已上传 ' + successCount + ' 份资料' : '未成功上传资料',
        icon: successCount > 0 ? 'success' : 'none',
      })
    } catch (err) {
      const message = String((err && err.errMsg) || (err && err.message) || '')
      if (message.indexOf('cancel') !== -1) {
        return
      }

      wx.showToast({
        title: trimErrorMessage(message, '资料上传失败'),
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({ uploading: false })
    }
  },

  refreshSourceList() {
    if (!ensureLogin()) {
      return
    }

    this.loadSourceMode()
  },

  continueToTemplate() {
    const selectionSummary = this.data.selectionSummary || {}
    if (!selectionSummary.total) {
      wx.showToast({
        title: '请至少选择 1 份数据源文档',
        icon: 'none',
      })
      return
    }

    wx.redirectTo({
      url: '/pages/docai/autofill-picker/index?mode=template',
    })
  },

  goBackToSource() {
    wx.redirectTo({
      url: '/pages/docai/autofill-picker/index?mode=source',
    })
  },

  async chooseTemplateFile() {
    if (!ensureLogin()) {
      return
    }

    try {
      const pickRes = await this.chooseMessageFileAsync({
        count: 1,
        type: 'file',
        extension: TEMPLATE_EXTENSIONS,
      })
      const file = (pickRes.tempFiles || [])[0]
      if (!file || !file.path) {
        return
      }

      updateAutofillDraft({
        templateLocalPath: file.path,
        templateName: file.name || '未命名模板',
      })

      this.setData({
        templateName: file.name || '未命名模板',
        templateLocalPath: file.path,
      })
    } catch (err) {
      const message = String((err && err.errMsg) || (err && err.message) || '')
      if (message.indexOf('cancel') !== -1) {
        return
      }

      wx.showToast({
        title: trimErrorMessage(message, '模板选择失败'),
        icon: 'none',
      })
    }
  },

  clearTemplateFile() {
    updateAutofillDraft({
      templateLocalPath: '',
      templateName: '',
    })

    this.setData({
      templateLocalPath: '',
      templateName: '',
    })
  },

  continueToRun() {
    const draft = loadAutofillDraft()
    if ((draft.sourceDocIds || []).length <= 0) {
      wx.showToast({
        title: '请先返回补充数据源文档',
        icon: 'none',
      })
      return
    }

    if (!draft.templateLocalPath) {
      wx.showToast({
        title: '请先选择模板文件',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: '/pages/docai/autofill-run/index',
    })
  },
})
