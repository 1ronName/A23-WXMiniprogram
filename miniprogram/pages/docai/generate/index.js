const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

Page({
  data: {
    generating: false,
    polishing: false,
    docTypes: ['通知', '报告', '请示', '函', '纪要', '通报', '批复', '其他'],
    docTypeIndex: 0,
    title: '',
    requirement: '',
    generatedContent: '',
  },

  onShow() {
    ensureLogin()
  },

  onDocTypeChange(e) {
    this.setData({ docTypeIndex: Number(e.detail.value) })
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onRequirementInput(e) {
    this.setData({ requirement: e.detail.value })
  },

  onContentEdit(e) {
    this.setData({ generatedContent: e.detail.value })
  },

  async generate() {
    if (!ensureLogin()) {
      return
    }
    if (!this.data.requirement.trim()) {
      wx.showToast({ title: '请填写需求描述', icon: 'none' })
      return
    }

    this.setData({ generating: true })
    try {
      const res = await api.aiGenerate({
        docType: this.data.docTypes[this.data.docTypeIndex],
        requirement: this.data.requirement,
      })
      const data = res.data || res
      this.setData({
        generatedContent: data.content || String(data),
      })
      wx.showToast({ title: '生成成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      this.setData({ generating: false })
    }
  },

  async polish() {
    if (!ensureLogin()) {
      return
    }
    if (!this.data.generatedContent.trim()) {
      wx.showToast({ title: '暂无可润色内容', icon: 'none' })
      return
    }

    this.setData({ polishing: true })
    try {
      const res = await api.aiPolish({ text: this.data.generatedContent })
      const data = res.data || res
      this.setData({
        generatedContent: data.polished || data.content || String(data),
      })
      wx.showToast({ title: '润色完成', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '润色失败', icon: 'none' })
    } finally {
      this.setData({ polishing: false })
    }
  },

  copyContent() {
    if (!this.data.generatedContent) {
      return
    }
    wx.setClipboardData({ data: this.data.generatedContent })
  },

  clearContent() {
    this.setData({ generatedContent: '' })
  },
})
