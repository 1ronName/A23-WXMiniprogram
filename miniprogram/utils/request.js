const config = require('../config')

function getBaseUrl() {
  const app = getApp()
  return (app && app.globalData && app.globalData.apiBaseUrl) || config.apiBaseUrl
}

function normalizeUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return url
  }
  const base = getBaseUrl()
  if (url.startsWith('/')) {
    return base + url
  }
  return base + '/' + url
}

function request(options) {
  const method = options.method || 'GET'
  const token = wx.getStorageSync('token') || ''
  const header = Object.assign({}, options.header || {})

  if (token) {
    header.Authorization = 'Bearer ' + token
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: normalizeUrl(options.url),
      method,
      data: options.data || {},
      header,
      timeout: options.timeout || config.requestTimeout,
      responseType: options.responseType || 'text',
      success(res) {
        const statusCode = res.statusCode
        if (statusCode >= 200 && statusCode < 300) {
          const body = res.data || {}
          if (typeof body === 'object' && body !== null && Object.prototype.hasOwnProperty.call(body, 'code')) {
            if (body.code === 200) {
              resolve(body)
              return
            }
            reject({
              statusCode,
              data: body,
              message: body.message || 'request failed',
            })
            return
          }
          resolve(body)
          return
        }

        if (statusCode === 401) {
          const app = getApp()
          if (app && app.clearAuth) {
            app.clearAuth()
          }
        }

        reject({
          statusCode,
          data: res.data,
          message: (res.data && res.data.message) || 'request failed',
        })
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

function uploadFile(options) {
  const token = wx.getStorageSync('token') || ''
  const header = Object.assign({}, options.header || {})
  if (token) {
    header.Authorization = 'Bearer ' + token
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: normalizeUrl(options.url),
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header,
      timeout: options.timeout || config.requestTimeout,
      success(res) {
        let parsed = res.data
        try {
          parsed = JSON.parse(res.data)
        } catch (e) {
          // keep raw text if backend does not return JSON
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (typeof parsed === 'object' && parsed !== null && Object.prototype.hasOwnProperty.call(parsed, 'code')) {
            if (parsed.code === 200) {
              resolve(parsed)
              return
            }
            reject({
              statusCode: res.statusCode,
              data: parsed,
              message: parsed.message || 'upload failed',
            })
            return
          }
          resolve(parsed)
          return
        }

        reject({
          statusCode: res.statusCode,
          data: parsed,
          message: (parsed && parsed.message) || 'upload failed',
        })
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

module.exports = {
  request,
  uploadFile,
}
