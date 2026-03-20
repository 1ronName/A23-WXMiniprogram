const { request, uploadFile } = require('../utils/request')

let lastTemplateFile = null

function normalizeDocument(item) {
  if (!item) {
    return item
  }

  return Object.assign({}, item, {
    fileName: item.fileName || item.title || '',
    docSummary: item.docSummary || item.contentText || '',
  })
}

function wrapSuccess(data) {
  return Promise.resolve({
    code: 200,
    message: 'success',
    data,
  })
}

function authLogin(data) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data: {
      username: data.username,
      password: data.password,
    },
  }).then(function (res) {
    var payload = res.data || {}
    return Object.assign({}, res, {
      data: Object.assign({}, payload, {
        userName: payload.userName || payload.username || '',
        email: payload.email || '',
      }),
    })
  })
}

function authRegister(data) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data: {
      username: data.username,
      password: data.password,
      nickname: data.nickname || data.username,
    },
  })
}

function getCurrentUser() {
  return request({ url: '/auth/me' })
}

function userLogout() {
  return wrapSuccess(true)
}

function getSourceDocuments() {
  return request({
    url: '/documents',
    data: {
      page: 1,
      size: 1000,
    },
  }).then(function (res) {
    var pageData = res.data || {}
    var records = pageData.records || []
    return Object.assign({}, res, {
      data: records.map(normalizeDocument),
    })
  })
}

function getDocuments() {
  return getSourceDocuments()
}

function getDocument(id) {
  return request({ url: '/documents/' + id }).then(function (res) {
    return Object.assign({}, res, {
      data: normalizeDocument(res.data),
    })
  })
}

function getDocumentStats() {
  return request({ url: '/documents/stats' })
}

function uploadDocument(filePath, fileName) {
  return uploadFile({
    url: '/documents/upload',
    filePath: filePath,
    name: 'file',
    formData: { fileName: fileName || '' },
  }).then(function (res) {
    if (res && res.data) {
      return Object.assign({}, res, {
        data: normalizeDocument(res.data),
      })
    }
    return normalizeDocument(res)
  })
}

function deleteDocument(id) {
  return request({ url: '/documents/' + id, method: 'DELETE' })
}

function batchDeleteDocuments(docIds) {
  return request({ url: '/documents/batch', method: 'DELETE', data: docIds || [] })
}

function uploadTemplateFile(filePath, fileName) {
  lastTemplateFile = {
    id: 'local-template',
    filePath: filePath,
    fileName: fileName,
  }

  return wrapSuccess({
    id: lastTemplateFile.id,
    fileName: fileName,
  })
}

function parseTemplateSlots(templateId) {
  return wrapSuccess({
    id: templateId,
    parsed: true,
  })
}

function fillTemplate(templateId, docIds) {
  if (!lastTemplateFile || !lastTemplateFile.filePath) {
    return Promise.reject({ message: '请先选择模板文件' })
  }

  return uploadFile({
    url: '/autofill/preview',
    filePath: lastTemplateFile.filePath,
    name: 'template',
    formData: {
      sourceDocIds: (docIds || []).join(','),
    },
    timeout: 300000,
  }).then(function (res) {
    var payload = (res && res.data) || {}
    return Object.assign({}, res, {
      data: {
        filledCount: payload.sourceDocCount || 0,
        blankCount: 0,
        totalSlots: payload.sourceDocCount || 0,
        templateName: payload.templateName || lastTemplateFile.fileName || '',
        fillTimeMs: payload.fillTimeMs || 0,
        fileSize: payload.fileSize || 0,
      },
    })
  })
}

function listTemplateFiles() {
  return wrapSuccess([])
}

function getTemplateAudit(templateId) {
  return wrapSuccess({ templateId: templateId, supported: false })
}

function getTemplateDecisions(templateId) {
  return wrapSuccess({ templateId: templateId, supported: false })
}

function aiChat(data) {
  return request({
    url: '/ai/chat',
    method: 'POST',
    data: {
      message: data.message || data.userInput || '',
      documentId: data.documentId || data.fileId || null,
    },
    timeout: 300000,
  })
}

module.exports = {
  authLogin,
  authRegister,
  getCurrentUser,
  userLogout,
  getSourceDocuments,
  getDocuments,
  getDocument,
  getDocumentStats,
  uploadDocument,
  deleteDocument,
  batchDeleteDocuments,
  uploadTemplateFile,
  parseTemplateSlots,
  fillTemplate,
  listTemplateFiles,
  getTemplateAudit,
  getTemplateDecisions,
  aiChat,
}
