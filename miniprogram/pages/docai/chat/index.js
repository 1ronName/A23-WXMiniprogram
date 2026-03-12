const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

let messageId = 0

Page({
  data: {
    loading: false,
    inputText: '',
    messages: [
      { id: 0, role: 'ai', content: '你好，我是 DocAI 助手。你可以让我总结文档、提取信息或改写内容。' },
    ],
    scrollIntoView: 'msg-0',
    currentDoc: {
      id: null,
      title: '',
    },
  },

  onShow() {
    if (!ensureLogin()) {
      return
    }
    const linkedDoc = wx.getStorageSync('docai_current_doc')
    if (linkedDoc && linkedDoc.id) {
      this.setData({ currentDoc: linkedDoc })
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  clearDoc() {
    wx.removeStorageSync('docai_current_doc')
    this.setData({ currentDoc: { id: null, title: '' } })
  },

  async sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.loading) {
      return
    }

    messageId += 1
    const userMessage = { id: messageId, role: 'user', content: text }
    const messages = this.data.messages.concat([userMessage])

    this.setData({
      inputText: '',
      loading: true,
      messages,
      scrollIntoView: 'msg-' + userMessage.id,
    })

    try {
      const payload = {
        message: text,
      }
      if (this.data.currentDoc.id) {
        payload.documentId = this.data.currentDoc.id
      }

      const res = await api.aiChat(payload)
      const data = res.data || res
      const aiText = data.reply || data.content || JSON.stringify(data)

      messageId += 1
      const aiMessage = {
        id: messageId,
        role: 'ai',
        content: aiText,
      }

      this.setData({
        messages: this.data.messages.concat([aiMessage]),
        scrollIntoView: 'msg-' + aiMessage.id,
      })
    } catch (err) {
      wx.showToast({ title: '对话失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
