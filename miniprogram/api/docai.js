const { request, uploadFile } = require('../utils/request')

// ==================== 用户认证 ====================

/**
 * 统一认证（登录/注册）。后端自动识别：username+password 模式下若用户不存在则注册。
 */
function authLogin(data) {
  return request({
    url: '/users/auth',
    method: 'POST',
    data,
  })
}

/**
 * 注册（与 authLogin 调用同一个统一认证接口）
 */
function authRegister(data) {
  return request({
    url: '/users/auth',
    method: 'POST',
    // 仅传 username / password，后端不支持 nickname 字段
    data: { username: data.username, password: data.password },
  })
}

function getCurrentUser() {
  return request({ url: '/users/info' })
}

function userLogout() {
  return request({ url: '/users/logout', method: 'POST' })
}

// ==================== 源文档 ====================

function getSourceDocuments() {
  return request({ url: '/source/documents' })
}

/** 保持向后兼容，忽略 params（服务端不支持过滤，统一返回全部列表） */
function getDocuments() {
  return getSourceDocuments()
}

function getDocument(id) {
  return request({ url: '/source/' + id })
}

/**
 * 统计各类型文档数量（客户端计算）
 */
function getDocumentStats() {
  return getSourceDocuments().then(function (res) {
    var docs = res.data || []
    return Object.assign({}, res, {
      data: {
        total: docs.length,
        docx: docs.filter(function (d) { return d.fileType === 'docx' }).length,
        xlsx: docs.filter(function (d) { return d.fileType === 'xlsx' }).length,
        txt: docs.filter(function (d) { return d.fileType === 'txt' }).length,
        md: docs.filter(function (d) { return d.fileType === 'md' }).length,
      },
    })
  })
}

function uploadDocument(filePath, fileName) {
  return uploadFile({
    url: '/source/upload',
    filePath: filePath,
    name: 'file',
    formData: { fileName: fileName },
  })
}

function deleteDocument(id) {
  return request({ url: '/source/' + id, method: 'DELETE' })
}

function batchDeleteDocuments(docIds) {
  return request({ url: '/source/batch', method: 'DELETE', data: { docIds: docIds } })
}

// ==================== 模板自动填表 ====================

function uploadTemplateFile(filePath, fileName) {
  return uploadFile({
    url: '/template/upload',
    filePath: filePath,
    name: 'file',
    formData: { fileName: fileName },
  })
}

function parseTemplateSlots(templateId) {
  return request({ url: '/template/' + templateId + '/parse', method: 'POST' })
}

function fillTemplate(templateId, docIds) {
  return request({
    url: '/template/' + templateId + '/fill',
    method: 'POST',
    data: { docIds: docIds || [] },
  })
}

function listTemplateFiles() {
  return request({ url: '/template/list' })
}

function getTemplateAudit(templateId) {
  return request({ url: '/template/' + templateId + '/audit' })
}

function getTemplateDecisions(templateId) {
  return request({ url: '/template/' + templateId + '/decisions' })
}

// ==================== AI 对话 ====================

/**
 * 调用 /ai/chat/stream（SSE 接口）。
 * 小程序不支持 SSE 流式接收，使用 wx.request 等待全部响应后解析 complete 事件。
 * 参数兼容旧格式 { message, documentId } 与新格式 { userInput, fileId }。
 */
function aiChat(data) {
  return new Promise(function (resolve, reject) {
    var config = require('../config')
    var app = typeof getApp === 'function' ? getApp() : null
    var baseUrl = (app && app.globalData && app.globalData.apiBaseUrl) || config.apiBaseUrl
    var token = wx.getStorageSync('token') || ''

    wx.request({
      url: baseUrl + '/ai/chat/stream',
      method: 'POST',
      data: {
        userInput: data.message || data.userInput || '',
        fileId: data.documentId || data.fileId || null,
      },
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      timeout: 300000,
      responseType: 'text',
      success: function (res) {
        var text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '')
        var finalText = _parseSseComplete(text)
        resolve({ data: { reply: finalText } })
      },
      fail: function (err) {
        reject({ message: err.errMsg || 'AI 请求失败' })
      },
    })
  })
}

/**
 * 从 SSE 文本中提取 complete 事件携带的 aiResponse 内容
 */
function _parseSseComplete(sseText) {
  var finalText = ''
  var blocks = sseText.split('\n\n')
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i]
    var lines = block.split('\n')
    var eventName = ''
    var dataLine = ''
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j]
      if (line.indexOf('event:') === 0) {
        eventName = line.slice(6).trim()
      } else if (line.indexOf('data:') === 0) {
        dataLine += line.slice(5).trim()
      }
    }
    if (!dataLine) continue
    try {
      var payload = JSON.parse(dataLine)
      if (payload.error) return payload.error
      if (eventName === 'complete' || payload.eventType === 'complete') {
        var result = payload.result || {}
        finalText = result.aiResponse || payload.aiResponseContent || ''
        if (!finalText && Array.isArray(result.resultData) && result.resultData.length > 0) {
          finalText = JSON.stringify(result.resultData, null, 2)
        }
      }
      if (!finalText && payload.aiResponseContent) {
        finalText = payload.aiResponseContent
      }
    } catch (e) {
      // 忽略解析异常
    }
  }
  return finalText || 'AI 已完成处理，但未返回可展示文本。'
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
