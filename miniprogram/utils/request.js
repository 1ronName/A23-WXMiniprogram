const config = require('../config')

function getAppSafe() {
  try {
    return getApp()
  } catch (err) {
    return null
  }
}

function getRequestConfig() {
  const runtimeConfig = config && typeof config.getRuntimeConfig === 'function'
    ? config.getRuntimeConfig()
    : config

  return Object.assign({
    apiBaseUrl: '',
    apiBaseFallbackUrls: [],
    requestTimeout: 120000,
    aiRequestTimeout: 300000,
    realDeviceApiBaseUrl: '',
  }, runtimeConfig || {})
}

function detectRuntimePlatform() {
  if (config && typeof config.detectRuntimePlatform === 'function') {
    return config.detectRuntimePlatform()
  }

  if (typeof wx === 'undefined' || !wx || typeof wx.getSystemInfoSync !== 'function') {
    return 'devtools'
  }

  try {
    const systemInfo = wx.getSystemInfoSync() || {}
    return String(systemInfo.platform || '').toLowerCase() || 'devtools'
  } catch (err) {
    return 'devtools'
  }
}

function isRealDeviceRuntime() {
  return detectRuntimePlatform() !== 'devtools'
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function parseJsonSafely(data) {
  if (typeof data !== 'string') {
    return data
  }

  const text = data.trim()
  if (!text) {
    return data
  }

  try {
    return JSON.parse(text)
  } catch (err) {
    return data
  }
}

function isTokenMessage(message) {
  const normalizedMessage = String(message || '').toLowerCase()
  return normalizedMessage.indexOf('token') !== -1
    || normalizedMessage.indexOf('\u4ee4\u724c') !== -1
}

function isAuthFailure(statusCode, data) {
  if (statusCode === 401) {
    return true
  }

  if (typeof data !== 'object' || data === null) {
    return false
  }

  return data.code === 401
    || (typeof data.code === 'number' && data.code >= 400 && isTokenMessage(data.message))
}

function looksLikeHtmlResponse(data) {
  if (typeof data !== 'string') {
    return false
  }

  return /<(?:!doctype|html|head|body|script|meta|title)\b/i.test(data)
}

function uniqueUrls(list) {
  const result = []

  ;(list || []).forEach((item) => {
    const value = normalizeBaseUrl(item)
    if (!value || result.indexOf(value) !== -1) {
      return
    }
    result.push(value)
  })

  return result
}

function getConfiguredBaseUrls() {
  const runtimeConfig = getRequestConfig()
  return filterReachableBaseUrls([runtimeConfig.apiBaseUrl].concat(runtimeConfig.apiBaseFallbackUrls || []))
}

function extractHost(url) {
  const matched = normalizeBaseUrl(url).match(/^https?:\/\/([^/:?#]+)/i)
  return matched ? String(matched[1] || '').toLowerCase() : ''
}

function isLoopbackHost(host) {
  return host === '127.0.0.1'
    || host === 'localhost'
    || host === '::1'
}

function isReachableInCurrentRuntime(baseUrl) {
  if (!baseUrl) {
    return false
  }

  if (!isRealDeviceRuntime()) {
    return true
  }

  return !isLoopbackHost(extractHost(baseUrl))
}

function filterReachableBaseUrls(list) {
  return uniqueUrls(list).filter(isReachableInCurrentRuntime)
}

function buildUnavailableBaseUrlError() {
  const runtimeConfig = getRequestConfig()
  const exampleUrl = normalizeBaseUrl(runtimeConfig.realDeviceApiBaseUrl) || 'http://192.168.x.x:8080/api/v1'

  return {
    statusCode: 0,
    message: '\u5f53\u524d\u662f\u771f\u673a\u8c03\u8bd5\uff0c\u4f46\u540e\u7aef\u5730\u5740\u4ecd\u6307\u5411 127.0.0.1 / localhost\uff0c\u624b\u673a\u65e0\u6cd5\u8bbf\u95ee\u7535\u8111\u672c\u673a\u3002\u8bf7\u5728 miniprogram/config.js \u4e2d\u4f7f\u7528\u7535\u8111\u5c40\u57df\u7f51\u5730\u5740\uff0c\u4f8b\u5982 ' + exampleUrl,
  }
}

function getBaseUrlCandidates() {
  const runtimeConfig = getRequestConfig()
  const app = getAppSafe()
  const globalData = (app && app.globalData) || {}
  const cachedBaseUrl = wx.getStorageSync('docai_api_base_url') || ''

  return filterReachableBaseUrls([
    globalData.activeApiBaseUrl,
    cachedBaseUrl,
    globalData.apiBaseUrl,
    runtimeConfig.apiBaseUrl,
  ].concat(runtimeConfig.apiBaseFallbackUrls || []))
}

function getBaseUrl() {
  const runtimeConfig = getRequestConfig()
  return getBaseUrlCandidates()[0] || normalizeBaseUrl(runtimeConfig.apiBaseUrl)
}

function setActiveBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const app = getAppSafe()

  if (app && app.globalData) {
    app.globalData.activeApiBaseUrl = normalizedBaseUrl
  }

  wx.setStorageSync('docai_api_base_url', normalizedBaseUrl)
}

function normalizeUrl(url, baseUrl) {
  if (/^https?:\/\//.test(url)) {
    return normalizeBaseUrl(url)
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || getBaseUrl())
  if (url.startsWith('/')) {
    return normalizedBaseUrl + url
  }

  return normalizedBaseUrl + '/' + url
}

function clearAuth() {
  const app = getAppSafe()
  if (app && app.clearAuth) {
    app.clearAuth()
    return
  }

  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
}

function createHeader(options) {
  const method = String(options.method || 'GET').toUpperCase()
  const token = wx.getStorageSync('token') || ''
  const header = Object.assign({}, options.header || {})

  if (
    !header['Content-Type']
    && !header['content-type']
    && !options.skipJsonContentType
    && method !== 'UPLOAD'
  ) {
    header['Content-Type'] = 'application/json'
  }

  if (token) {
    header.Authorization = 'Bearer ' + token
  }

  return header
}

function buildRequestError(statusCode, data, fallbackMessage) {
  const message = (data && data.message) || fallbackMessage || 'request failed'
  return {
    statusCode,
    data,
    message,
  }
}

function buildUnexpectedApiResponseError(statusCode, data, baseUrl) {
  return {
    statusCode,
    data,
    baseUrl,
    retryable: true,
    message: looksLikeHtmlResponse(data)
      ? '\u5f53\u524d\u540e\u7aef\u5730\u5740\u8fd4\u56de\u7684\u662f HTML \u9875\u9762\uff0c\u4e0d\u662f DocAI API\uff0c\u8bf7\u68c0\u67e5 API \u5165\u53e3'
      : '\u5f53\u524d\u540e\u7aef\u5730\u5740\u672a\u8fd4\u56de DocAI JSON\uff0c\u8bf7\u68c0\u67e5 API \u5165\u53e3',
  }
}

function normalizeResponse(statusCode, data, fallbackMessage, options) {
  const normalizedOptions = Object.assign({
    expectJson: false,
    baseUrl: '',
  }, options || {})

  if (isAuthFailure(statusCode, data)) {
    clearAuth()
  }

  if (typeof data === 'object' && data !== null && Object.prototype.hasOwnProperty.call(data, 'code')) {
    if (data.code === 200) {
      return {
        ok: true,
        data,
      }
    }

    return {
      ok: false,
      error: buildRequestError(statusCode, data, fallbackMessage),
    }
  }

  if (statusCode >= 200 && statusCode < 300) {
    if (normalizedOptions.expectJson && typeof data === 'string') {
      return {
        ok: false,
        error: buildUnexpectedApiResponseError(statusCode, data, normalizedOptions.baseUrl),
      }
    }

    return {
      ok: true,
      data,
    }
  }

  return {
    ok: false,
    error: buildRequestError(statusCode, data, fallbackMessage),
  }
}

function shouldRetry(err) {
  if (!err) {
    return false
  }

  if (err.retryable) {
    return true
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

function performRequest(baseUrl, options) {
  const runtimeConfig = getRequestConfig()
  const method = String(options.method || 'GET').toUpperCase()
  const header = createHeader(options)

  return new Promise((resolve, reject) => {
    wx.request({
      url: normalizeUrl(options.url, baseUrl),
      method,
      data: options.data || {},
      header,
      timeout: options.timeout || runtimeConfig.requestTimeout,
      responseType: options.responseType || 'text',
      success(res) {
        const responseData = parseJsonSafely(res.data)
        const normalized = normalizeResponse(res.statusCode, responseData, 'request failed', {
          expectJson: true,
          baseUrl,
        })
        if (normalized.ok) {
          setActiveBaseUrl(baseUrl)
          resolve(normalized.data)
          return
        }
        reject(normalized.error)
      },
      fail(err) {
        reject({
          statusCode: 0,
          message: err.errMsg || 'network error',
        })
      },
    })
  })
}

async function request(options) {
  const candidates = getBaseUrlCandidates()
  if (!candidates.length) {
    throw buildUnavailableBaseUrlError()
  }

  let lastError = null

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index]

    try {
      return await performRequest(baseUrl, options)
    } catch (err) {
      lastError = err
      if (index === candidates.length - 1 || !shouldRetry(err)) {
        throw err
      }
    }
  }

  throw lastError || { statusCode: 0, message: 'network error' }
}

function performUpload(baseUrl, options) {
  const runtimeConfig = getRequestConfig()
  const header = createHeader(Object.assign({}, options, {
    method: 'UPLOAD',
    skipJsonContentType: true,
  }))

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: normalizeUrl(options.url, baseUrl),
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header,
      timeout: options.timeout || runtimeConfig.requestTimeout,
      success(res) {
        const responseData = parseJsonSafely(res.data)
        const normalized = normalizeResponse(res.statusCode, responseData, 'upload failed', {
          expectJson: true,
          baseUrl,
        })
        if (normalized.ok) {
          setActiveBaseUrl(baseUrl)
          resolve(normalized.data)
          return
        }
        reject(normalized.error)
      },
      fail(err) {
        reject({
          statusCode: 0,
          message: err.errMsg || 'upload error',
        })
      },
    })
  })
}

async function uploadFile(options) {
  const candidates = getBaseUrlCandidates()
  if (!candidates.length) {
    throw buildUnavailableBaseUrlError()
  }

  let lastError = null

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index]

    try {
      return await performUpload(baseUrl, options)
    } catch (err) {
      lastError = err
      if (index === candidates.length - 1 || !shouldRetry(err)) {
        throw err
      }
    }
  }

  throw lastError || { statusCode: 0, message: 'upload error' }
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
    // Keep plain text when backend does not return JSON.
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

function shouldFlushSseTail(text) {
  return /(?:^|\n)(?:event|data):/i.test(String(text || ''))
}

function buildAiChatSuccess(payload, extra) {
  return {
    code: 200,
    message: 'success',
    data: Object.assign({
      reply: extractAiReply(payload),
      modifiedExcelUrl: (payload && payload.result && payload.result.modifiedExcelUrl) || (payload && payload.modifiedExcelUrl) || '',
      resultData: (payload && payload.result && payload.result.resultData) || (payload && payload.resultData) || [],
      raw: payload || null,
    }, extra || {}),
  }
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

function doAiChatRequest(baseUrl, data, options) {
  const runtimeConfig = getRequestConfig()
  const token = wx.getStorageSync('token') || ''
  const header = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }

  const normalizedOptions = Object.assign({
    onProgress: null,
  }, options || {})

  if (!token) {
    return Promise.reject({
      statusCode: 401,
      message: 'Login expired, please sign in again.',
    })
  }

  header.Authorization = 'Bearer ' + token

  return new Promise((resolve, reject) => {
    let settled = false
    let requestTask = null
    let buffer = ''
    let lastProgressPayload = null
    let lastProgressReply = ''

    const finish = (handler, value) => {
      if (settled) {
        return
      }
      settled = true
      handler(value)
    }

    const fail = (error) => {
      const message = String((error && error.message) || '').toLowerCase()
      if (message.indexOf('token') !== -1 || message.indexOf('令牌') !== -1) {
        clearAuth()
      }

      finish(reject, error)
    }

    const handleEvent = (event) => {
      if (!event) {
        return
      }

      const payload = event.payload
      const nextReply = extractAiReply(payload)
      const errorMessage = typeof payload === 'object' && payload !== null
        ? payload.error || payload.message
        : ''

      if (event.eventName === 'error' || errorMessage) {
        fail({
          statusCode: 0,
          data: payload,
          message: errorMessage || 'AI service failed',
        })
        return
      }

      if (event.eventName !== 'complete') {
        lastProgressPayload = payload
        if (nextReply) {
          lastProgressReply = nextReply
        }

        if (typeof normalizedOptions.onProgress === 'function') {
          normalizedOptions.onProgress({
            eventName: event.eventName || '',
            stage: payload && payload.stage ? payload.stage : '',
            progress: payload && typeof payload.progress === 'number' ? payload.progress : 0,
            message: payload && payload.message ? payload.message : '',
            detail: payload && payload.detail ? payload.detail : '',
            reply: nextReply,
            raw: payload,
          })
        }
      }

      if (event.eventName === 'complete' || (payload && payload.eventType === 'complete')) {
        finish(resolve, buildAiChatSuccess(payload))
      }
    }

    const consumeText = (text, flushTail) => {
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

      if (flushTail && buffer.trim() && shouldFlushSseTail(buffer)) {
        const tailBlock = buffer.trim()
        buffer = ''
        handleEvent(parseSseBlock(tailBlock))
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
      timeout: runtimeConfig.aiRequestTimeout,
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
            message: 'AI request failed',
          })
          return
        }

        if (res.data) {
          if (typeof res.data === 'string') {
            consumeText(res.data, true)
          } else {
            consumeText(arrayBufferToText(res.data), true)
          }
        }

        if (!settled) {
          if (lastProgressPayload || lastProgressReply) {
            finish(resolve, buildAiChatSuccess(lastProgressPayload || {
              aiResponseContent: lastProgressReply,
              eventType: 'progress',
            }, {
              incomplete: true,
            }))
            return
          }

          finish(reject, {
            statusCode: 0,
            message: 'No complete AI response was received.',
          })
        }
      },
      fail(err) {
        if (settled) {
          return
        }

        finish(reject, {
          statusCode: 0,
          message: (err && err.errMsg) || 'AI request failed',
        })
      },
    })

    if (requestTask && typeof requestTask.onChunkReceived === 'function') {
      requestTask.onChunkReceived((res) => {
        if (settled || !res || !res.data) {
          return
        }

        try {
          consumeText(arrayBufferToText(res.data), false)
        } catch (err) {
          fail({
            statusCode: 0,
            message: err.message || 'AI response parse failed',
          })
        }
      })
    }
  })
}

module.exports = {
  request,
  uploadFile,
  getBaseUrl,
  getBaseUrlCandidates,
  normalizeUrl,
  clearAuth,
  doAiChatRequest,
  getConfiguredBaseUrls,
}
