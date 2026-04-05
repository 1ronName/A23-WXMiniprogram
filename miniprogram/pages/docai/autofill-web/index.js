const config = require('../../../config')

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function buildAutofillWebUrl() {
  if (config && typeof config.buildRemoteWebUrl === 'function') {
    return config.buildRemoteWebUrl('/autofill', {
      from: 'miniapp',
      scene: 'form',
      entry: 'wx-autofill',
    })
  }

  const baseUrl = normalizeBaseUrl(config && config.remoteWebBaseUrl)
  if (!/^https:\/\//i.test(baseUrl)) {
    return ''
  }

  return baseUrl + '/autofill?from=miniapp&scene=form&entry=wx-autofill'
}

Page({
  data: {
    webviewUrl: '',
    errorText: '',
  },

  onLoad() {
    this.reloadWebView()
  },

  reloadWebView() {
    const webviewUrl = buildAutofillWebUrl()
    if (!webviewUrl) {
      this.setData({
        webviewUrl: '',
        errorText: '当前未配置可用的 HTTPS 网页入口，请先检查 miniprogram/config.js 中的 remoteWebBaseUrl。',
      })
      return
    }

    this.setData({
      webviewUrl,
      errorText: '',
    })
  },

  handleWebError() {
    this.setData({
      errorText: [
        '网页智能填表打开失败。',
        '请确认微信小程序后台已将 https://docai.sa1.tunnelfrp.com 同时配置为业务域名、request、uploadFile 和 downloadFile。',
        '如果网页端还未登录，首次进入可能会先跳到网站登录页。',
      ].join('\n'),
    })
  },

  handleRetry() {
    this.reloadWebView()
  },
})
