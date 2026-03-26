const config = require('../config')
const {
  request,
  uploadFile,
  getBaseUrlCandidates,
  normalizeUrl,
  clearAuth,
} = require('../utils/request')

function normalizeUser(item) {
  if (!item) {
    return item
  }

  return Object.assign({}, item, {
    username: item.username || item.userName || '',
    userName: item.userName || item.username || '',
    nickname: item.nickname || item.userName || item.username || '',
    email: item.email || '',
  })
}

function normalizeDocument(item) {
  if (!item) {
    return item
  }

  return Object.assign({}, item, {
    id: item.id,
    title: item.title || item.fileName || '',
    fileName: item.fileName || item.title || '',
    fileType: String(item.fileType || '').toLowerCase(),
    uploadStatus: item.uploadStatus || '',
    docSummary: item.docSummary || item.contentText || '',
  })
}

function buildSuccess(data, message) {
  return {
    code: 200,
    message: message || 'success',
    data,
  }
}

function buildDocumentStats(list) {
  const documents = Array.isArray(list) ? list : []

  return {
    total: documents.length,
    docx: documents.filter((item) => item.fileType === 'docx').length,
    xlsx: documents.filter((item) => item.fileType === 'xlsx').length,
    txt: documents.filter((item) => item.fileType === 'txt').length,
    md: documents.filter((item) => item.fileType === 'md').length,
  }
}

function arrayBufferToText(buffer) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(buffer)
  }

  const bytes = new Uint8Array(buffer)
  let result = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    result += String.fromCharCode.apply(null, chunk)
  }

  try {
    return decodeURIComponent(escape(result))
  } catch (err) {
    return result
  }
}

function parseSseBlock(block) {
  const lines = String(block || '').split('\n')
  let eventName = ''
  let dataText = ''

  lines.forEach((line) => {
    if (line.indexOf('event:') === 0) {
      eventName = line.slice(6).trim()
      return
    }

    if (line.indexOf('data:') === 0) {
      dataText += line.slice(5).trim()
    }
  })

  if (!dataText) {
    return null
  }

  let payload = dataText
  try {
    payload = JSON.parse(dataText)
  } catch (err) {
    // keep plain text when backend does not return JSON
  }

  return {
    eventName,
    payload,
  }
}

function extractAiReply(payload) {
  if (!payload) {
    return '暂未获取到回复，请稍后重试。'
  }

  if (typeof payload === 'string') {
    return payload
  }

  const result = payload.result || {}
  const reply = result.aiResponse
    || payload.aiResponseContent
    || payload.reply
    || payload.content
    || payload.answer
    || result.result
    || payload.message

  if (reply) {
    return reply
  }

  if (Array.isArray(result.resultData) && result.resultData.length) {
    return JSON.stringify(result.resultData, null, 2)
  }

  return '请求已完成，但未收到可展示的 AI 文本结果。'
}

function shouldRetryAiRequest(err) {
  if (!err) {
    return false
  }

  if (err.statusCode === 0) {
    return true
  }

  const message = String(err.message || '').toLowerCase()
  return message.indexOf('timeout') !== -1
    || message.indexOf('network') !== -1
    || message.indexOf('fail') !== -1
    || message.indexOf('refused') !== -1
}

function doAiChatRequest(baseUrl, data) {
  const token = wx.getStorageSync('token') || ''
  const header = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }

  if (token) {
    header.Authorization = 'Bearer ' + token
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let requestTask = null
    let buffer = ''

    const finish = (handler, value) => {
      if (settled) {
        return
      }
      settled = true
      handler(value)
    }

    const fail = (error) => {
      const message = String((error && error.message) || '').toLowerCase()
      if (message.indexOf('令牌') !== -1 || message.indexOf('token') !== -1) {
        clearAuth()
      }

      finish(reject, error)
    }

    const handleEvent = (event) => {
      if (!event) {
        return
      }

      const payload = event.payload
      const errorMessage = typeof payload === 'object' && payload !== null
        ? payload.error || payload.message
        : ''

      if (event.eventName === 'error' || errorMessage) {
        fail({
          statusCode: 0,
          data: payload,
          message: errorMessage || 'AI 服务处理失败',
        })
        return
      }

      if (event.eventName === 'complete' || (payload && payload.eventType === 'complete')) {
        finish(resolve, buildSuccess({
          reply: extractAiReply(payload),
          modifiedExcelUrl: (payload.result && payload.result.modifiedExcelUrl) || payload.modifiedExcelUrl || '',
          resultData: (payload.result && payload.result.resultData) || payload.resultData || [],
          raw: payload,
        }))
      }
    }

    const consumeText = (text) => {
      buffer += String(text || '').replace(/\r\n/g, '\n')

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex).trim()
        buffer = buffer.slice(separatorIndex + 2)

        if (block) {
          handleEvent(parseSseBlock(block))
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    requestTask = wx.request({
      url: normalizeUrl('/ai/chat/stream', baseUrl),
      method: 'POST',
      data: {
        fileId: data.documentId || data.fileId || null,
        userInput: data.message || data.userInput || '',
      },
      header,
      timeout: config.aiRequestTimeout,
      responseType: 'arraybuffer',
      enableChunked: true,
      success(res) {
        if (settled) {
          return
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          finish(reject, {
            statusCode: res.statusCode,
            data: res.data,
            message: 'AI 请求失败',
          })
          return
        }

        if (res.data) {
          if (typeof res.data === 'string') {
            consumeText(res.data)
          } else {
            consumeText(arrayBufferToText(res.data))
          }
        }

        if (!settled) {
          finish(reject, {
            statusCode: 0,
            message: '未收到完整的 AI 响应，请稍后重试',
          })
        }
      },
      fail(err) {
        if (settled) {
          return
        }

        finish(reject, {
          statusCode: 0,
          message: (err && err.errMsg) || 'AI 请求失败',
        })
      },
    })

    if (requestTask && typeof requestTask.onChunkReceived === 'function') {
      requestTask.onChunkReceived((res) => {
        if (settled || !res || !res.data) {
          return
        }

        try {
          consumeText(arrayBufferToText(res.data))
        } catch (err) {
          fail({
            statusCode: 0,
            message: err.message || 'AI 响应解析失败',
          })
        }
      })
    }
  })
}

function authLogin(data) {
  return request({
    url: '/users/auth',
    method: 'POST',
    data: {
      username: data.username,
      password: data.password,
      isRegister: false,
    },
  }).then(function (res) {
    var payload = normalizeUser(res.data || {})
    return Object.assign({}, res, {
      data: payload,
    })
  })
}

function authRegister(data) {
  return request({
    url: '/users/auth',
    method: 'POST',
    data: {
      username: data.username,
      password: data.password,
      isRegister: true,
    },
  }).then(function (res) {
    return Object.assign({}, res, {
      data: normalizeUser(res.data || {}),
    })
  })
}

function getCurrentUser() {
  return request({ url: '/users/info' }).then(function (res) {
    return Object.assign({}, res, {
      data: normalizeUser(res.data || {}),
    })
  })
}

function userLogout() {
  return request({
    url: '/users/logout',
    method: 'POST',
    data: {},
  })
}

function getSourceDocuments() {
  return request({
    url: '/source/documents',
  }).then(function (res) {
    return Object.assign({}, res, {
      data: (res.data || []).map(normalizeDocument),
    })
  })
}

function getDocuments() {
  return getSourceDocuments()
}

function getDocument(id) {
  return request({ url: '/source/' + id }).then(function (res) {
    return Object.assign({}, res, {
      data: normalizeDocument(res.data),
    })
  })
}

function getDocumentStatuses() {
  return request({ url: '/source/documents/status' })
}

function getDocumentFields(id) {
  return request({ url: '/source/' + id + '/fields' })
}

function getDocumentStats() {
  return getSourceDocuments().then(function (res) {
    return buildSuccess(buildDocumentStats(res.data || []))
  })
}

function uploadDocument(filePath, fileName) {
  return uploadFile({
    url: '/source/upload',
    filePath: filePath,
    name: 'file',
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
  return request({ url: '/source/' + id, method: 'DELETE' })
}

function batchDeleteDocuments(docIds) {
  return request({
    url: '/source/batch-delete',
    method: 'POST',
    data: {
      docIds: docIds || [],
    },
  })
}

function uploadTemplateFile(filePath) {
  return uploadFile({
    url: '/template/upload',
    filePath: filePath,
    name: 'file',
    timeout: config.aiRequestTimeout,
  })
}

function parseTemplateSlots(templateId) {
  return request({
    url: '/template/' + templateId + '/parse',
    method: 'POST',
    data: {},
    timeout: config.aiRequestTimeout,
  })
}

function fillTemplate(templateId, docIds, userRequirement) {
  return request({
    url: '/template/' + templateId + '/fill',
    method: 'POST',
    data: {
      docIds: docIds || [],
      userRequirement: userRequirement || '',
    },
    timeout: config.aiRequestTimeout,
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

async function aiChat(data) {
  const candidates = getBaseUrlCandidates()
  let lastError = null

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index]

    try {
      return await doAiChatRequest(baseUrl, data || {})
    } catch (err) {
      lastError = err
      if (index === candidates.length - 1 || !shouldRetryAiRequest(err)) {
        throw err
      }
    }
  }

  throw lastError || { statusCode: 0, message: 'AI 请求失败' }
}

function listConversations() {
  return request({
    url: '/ai/conversations',
  })
}

function createConversation(data) {
  return request({
    url: '/ai/conversations',
    method: 'POST',
    data: data || {},
  })
}

function updateConversation(id, data) {
  return request({
    url: '/ai/conversations/' + id,
    method: 'PUT',
    data: data || {},
  })
}

function deleteConversationApi(id) {
  return request({
    url: '/ai/conversations/' + id,
    method: 'DELETE',
  })
}

function getConversationMessages(id) {
  return request({
    url: '/ai/conversations/' + id + '/messages',
  })
}

function addConversationMessage(id, data) {
  return request({
    url: '/ai/conversations/' + id + '/messages',
    method: 'POST',
    data: data || {},
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
  getDocumentStatuses,
  getDocumentFields,
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
  listConversations,
  createConversation,
  updateConversation,
  deleteConversationApi,
  getConversationMessages,
  addConversationMessage,
}
