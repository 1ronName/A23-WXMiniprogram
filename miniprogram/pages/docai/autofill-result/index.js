const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')
const {
  loadAutofillResultSession,
  clearAutofillResultSession,
  getFileTypeFromName,
} = require('../../../utils/autofill-draft')
const {
  listAutofillResults,
  updateAutofillResult,
} = require('../../../utils/autofill-result')

function normalizeText(value) {
  return String(value || '').trim()
}

function toNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function formatDateTime(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  if (!timestamp) {
    return '--'
  }

  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return month + '-' + day + ' ' + hours + ':' + minutes
}

function normalizeDecision(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const confidence = Number(item.finalConfidence || 0) || 0
  return {
    fieldName: normalizeText(item.fieldName || '未命名字段'),
    finalValue: normalizeText(item.finalValue || ''),
    confidenceText: Math.round(confidence * 100) + '%',
    decisionMode: normalizeText(item.decisionMode || 'default'),
    reason: normalizeText(item.reason || ''),
  }
}

function normalizeSourceDoc(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    id: String(item.id || ''),
    fileName: normalizeText(item.fileName || '未命名文档'),
  }
}

function normalizeResultPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const outputName = normalizeText(payload.outputName || payload.fileName)
  const templateName = normalizeText(payload.templateName)

  return {
    recordId: normalizeText(payload.recordId),
    templateId: normalizeText(payload.templateId),
    auditId: normalizeText(payload.auditId),
    templateName: templateName || '未命名模板',
    outputName: outputName || templateName || '智能填表结果',
    outputFile: normalizeText(payload.outputFile),
    fileType: normalizeText(payload.fileType).toLowerCase() || getFileTypeFromName(outputName || templateName),
    summaryText: normalizeText(payload.summaryText),
    filledCount: toNumber(payload.filledCount),
    blankCount: toNumber(payload.blankCount),
    totalSlots: toNumber(payload.totalSlots),
    fillTimeMs: toNumber(payload.fillTimeMs),
    sourceCount: toNumber(payload.sourceCount),
    fileSizeText: normalizeText(payload.fileSizeText),
    userRequirement: normalizeText(payload.userRequirement),
    createdAt: normalizeText(payload.createdAt),
    createdAtText: formatDateTime(payload.createdAt),
    decisions: (Array.isArray(payload.decisions) ? payload.decisions : []).map(normalizeDecision).filter(Boolean),
    sourceDocs: (Array.isArray(payload.sourceDocs) ? payload.sourceDocs : []).map(normalizeSourceDoc).filter(Boolean),
  }
}

function buildFallbackResult(record) {
  if (!record) {
    return null
  }

  return normalizeResultPayload({
    recordId: record.recordId,
    templateId: record.templateId,
    auditId: record.auditId,
    templateName: record.templateName,
    outputName: record.outputName || record.fileName,
    outputFile: record.outputFile,
    fileType: getFileTypeFromName(record.outputName || record.fileName || record.templateName),
    summaryText: record.summaryText,
    filledCount: record.filledCount,
    blankCount: record.blankCount,
    totalSlots: record.totalSlots,
    fillTimeMs: record.fillTimeMs,
    sourceCount: record.sourceCount,
    createdAt: record.createdAt,
    decisions: [],
    sourceDocs: [],
  })
}

Page({
  data: {
    missingResult: false,
    result: null,
    decisionPreview: [],
    downloading: false,
    sharing: false,
  },

  onLoad(options) {
    if (!ensureLogin()) {
      return
    }

    this.loadResult(options && options.recordId)
  },

  loadResult(recordId) {
    const sessionResult = normalizeResultPayload(loadAutofillResultSession())
    let result = sessionResult

    if (!result || (recordId && result.recordId !== String(recordId))) {
      const record = listAutofillResults().find((item) => item.recordId === String(recordId || ''))
      result = buildFallbackResult(record)
    }

    if (!result) {
      this.setData({
        missingResult: true,
        result: null,
        decisionPreview: [],
      })
      return
    }

    this.pendingRecordId = result.recordId
    this.setData({
      missingResult: false,
      result,
      decisionPreview: (result.decisions || []).slice(0, 8),
    })
  },

  chooseDownloadAction() {
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: ['下载并打开', '仅下载到本地'],
        success: (res) => {
          resolve(res.tapIndex === 0 ? 'open' : 'save')
        },
        fail: () => resolve(''),
      })
    })
  },

  downloadFileAsync(options) {
    return new Promise((resolve, reject) => {
      wx.downloadFile(Object.assign({}, options, {
        success: resolve,
        fail: reject,
      }))
    })
  },

  saveFileAsync(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.saveFile({
        tempFilePath,
        success: resolve,
        fail: reject,
      })
    })
  },

  openDocumentAsync(filePath, fileType) {
    return new Promise((resolve, reject) => {
      wx.openDocument({
        filePath,
        fileType: fileType || undefined,
        showMenu: true,
        success: resolve,
        fail: reject,
      })
    })
  },

  shareFileMessageAsync(filePath, fileName) {
    return new Promise((resolve, reject) => {
      if (typeof wx.shareFileMessage !== 'function') {
        reject(new Error('当前微信环境不支持直接转发文件'))
        return
      }

      wx.shareFileMessage({
        filePath,
        fileName: fileName || '智能填表结果',
        success: resolve,
        fail: reject,
      })
    })
  },

  applyResultPatch(patch) {
    const currentResult = this.data.result
    if (!currentResult) {
      return
    }

    this.setData({
      result: Object.assign({}, currentResult, patch || {}),
    })
  },

  async downloadResult(action) {
    const result = this.data.result
    if (!result || !result.templateId || this.data.downloading) {
      return
    }

    const token = wx.getStorageSync('token') || ''
    if (!token) {
      wx.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none',
      })
      return
    }

    const downloadUrl = api.buildTemplateResultDownloadUrl(result.templateId)
    if (!downloadUrl) {
      wx.showToast({
        title: '结果下载地址无效',
        icon: 'none',
      })
      return
    }

    this.setData({ downloading: true })
    wx.showLoading({
      title: '正在下载结果',
      mask: true,
    })

    try {
      const downloadRes = await this.downloadFileAsync({
        url: downloadUrl,
        header: {
          Authorization: 'Bearer ' + token,
        },
        timeout: 120000,
      })

      if (!downloadRes || Number(downloadRes.statusCode) !== 200 || !downloadRes.tempFilePath) {
        if (Number(downloadRes && downloadRes.statusCode) === 401) {
          throw new Error('登录已过期，请重新登录')
        }
        throw new Error('结果文件下载失败')
      }

      if (action === 'save') {
        const saveRes = await this.saveFileAsync(downloadRes.tempFilePath)
        updateAutofillResult(result.recordId, {
          savedFilePath: saveRes.savedFilePath || '',
          lastDownloadedAt: new Date().toISOString(),
        })
        this.applyResultPatch({
          createdAtText: this.data.result.createdAtText,
        })
        wx.showToast({
          title: '已下载到本地',
          icon: 'success',
        })
        return
      }

      updateAutofillResult(result.recordId, {
        lastDownloadedAt: new Date().toISOString(),
      })

      try {
        await this.openDocumentAsync(downloadRes.tempFilePath, result.fileType)
        wx.showToast({
          title: '已下载并打开',
          icon: 'success',
        })
      } catch (openErr) {
        wx.showToast({
          title: '已下载，可稍后打开',
          icon: 'none',
        })
      }
    } catch (err) {
      wx.showToast({
        title: normalizeText(err && err.message) || '结果下载失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({ downloading: false })
    }
  },

  async shareResult() {
    const result = this.data.result
    if (!result || !result.templateId || this.data.sharing) {
      return
    }

    const token = wx.getStorageSync('token') || ''
    if (!token) {
      wx.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none',
      })
      return
    }

    const downloadUrl = api.buildTemplateResultDownloadUrl(result.templateId)
    if (!downloadUrl) {
      wx.showToast({
        title: '结果下载地址无效',
        icon: 'none',
      })
      return
    }

    this.setData({ sharing: true })
    wx.showLoading({
      title: '正在准备转发',
      mask: true,
    })

    try {
      const downloadRes = await this.downloadFileAsync({
        url: downloadUrl,
        header: {
          Authorization: 'Bearer ' + token,
        },
        timeout: 120000,
      })

      if (!downloadRes || Number(downloadRes.statusCode) !== 200 || !downloadRes.tempFilePath) {
        if (Number(downloadRes && downloadRes.statusCode) === 401) {
          throw new Error('登录已过期，请重新登录')
        }
        throw new Error('结果文件下载失败')
      }

      try {
        await this.shareFileMessageAsync(downloadRes.tempFilePath, result.outputName)
        updateAutofillResult(result.recordId, {
          lastDownloadedAt: new Date().toISOString(),
        })
        wx.showToast({
          title: '已打开转发面板',
          icon: 'success',
        })
        return
      } catch (shareErr) {
        const errorMessage = String((shareErr && shareErr.errMsg) || (shareErr && shareErr.message) || '')
        if (errorMessage.indexOf('cancel') !== -1) {
          return
        }
      }

      await this.openDocumentAsync(downloadRes.tempFilePath, result.fileType)
      wx.showToast({
        title: '当前环境不支持直接转发，请在文档菜单中继续转发',
        icon: 'none',
      })
    } catch (err) {
      wx.showToast({
        title: normalizeText(err && err.message) || '转发准备失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({ sharing: false })
    }
  },

  handleDownloadOpen() {
    this.downloadResult('open')
  },

  handleDownloadSave() {
    this.downloadResult('save')
  },

  handleShare() {
    this.shareResult()
  },

  goDocuments() {
    clearAutofillResultSession()
    wx.switchTab({
      url: '/pages/docai/documents/index',
    })
  },

  restartAutofill() {
    clearAutofillResultSession()
    wx.redirectTo({
      url: '/pages/docai/autofill/index',
    })
  },
})
