const { request, uploadFile } = require('../utils/request')

function formatSourceDocIds(sourceDocIds) {
  if (!Array.isArray(sourceDocIds) || sourceDocIds.length === 0) {
    return ''
  }
  return sourceDocIds.map((id) => String(id)).join(',')
}

function authLogin(data) {
  return request({
    url: '/auth/login',
    method: 'POST',
    data,
  })
}

function authRegister(data) {
  return request({
    url: '/auth/register',
    method: 'POST',
    data,
  })
}

function getCurrentUser() {
  return request({ url: '/auth/me' })
}

function getDocumentStats() {
  return request({ url: '/documents/stats' })
}

function getDocuments(params) {
  return request({
    url: '/documents',
    data: params || {},
  })
}

function deleteDocument(id) {
  return request({
    url: '/documents/' + id,
    method: 'DELETE',
  })
}

function uploadDocument(filePath, fileName) {
  return uploadFile({
    url: '/documents/upload',
    filePath,
    name: 'file',
    formData: {
      fileName,
    },
  })
}

function aiChat(data) {
  return request({
    url: '/ai/chat',
    method: 'POST',
    data,
  })
}

function aiGenerate(data) {
  return request({
    url: '/ai/generate',
    method: 'POST',
    data,
  })
}

function aiPolish(data) {
  return request({
    url: '/ai/polish',
    method: 'POST',
    data,
  })
}

function autoFillSingle(filePath, sourceDocIds) {
  return uploadFile({
    url: '/autofill/single',
    filePath,
    name: 'template',
    formData: {
      sourceDocIds: formatSourceDocIds(sourceDocIds),
    },
  })
}

function autoFillPreview(filePath, sourceDocIds) {
  return uploadFile({
    url: '/autofill/preview',
    filePath,
    name: 'template',
    formData: {
      sourceDocIds: formatSourceDocIds(sourceDocIds),
    },
  })
}

module.exports = {
  authLogin,
  authRegister,
  getCurrentUser,
  getDocumentStats,
  getDocuments,
  deleteDocument,
  uploadDocument,
  aiChat,
  aiGenerate,
  aiPolish,
  autoFillSingle,
  autoFillPreview,
}
