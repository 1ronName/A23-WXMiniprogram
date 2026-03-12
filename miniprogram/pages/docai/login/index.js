const api = require('../../../api/docai')

Page({
  data: {
    isLogin: true,
    loading: false,
    username: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  },

  onShow() {
    const token = wx.getStorageSync('token') || ''
    if (token) {
      wx.switchTab({ url: '/pages/docai/dashboard/index' })
    }
  },

  switchMode(e) {
    const isLogin = String(e.currentTarget.dataset.login) === 'true'
    this.setData({ isLogin })
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value.trim() })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value.trim() })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value })
  },

  async submit() {
    if (this.data.loading) {
      return
    }

    const username = this.data.username
    const password = this.data.password

    if (!username || !password) {
      wx.showToast({ title: '请填写用户名和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      if (this.data.isLogin) {
        const res = await api.authLogin({ username, password })
        const data = res.data || {}
        const token = data.token || ''
        if (!token) {
          throw new Error('登录失败，未返回 token')
        }
        const app = getApp()
        if (app && app.setAuth) {
          app.setAuth(token, data.user || null)
        }
        wx.showToast({ title: '登录成功', icon: 'success' })
        wx.switchTab({ url: '/pages/docai/dashboard/index' })
      } else {
        if (password.length < 6) {
          wx.showToast({ title: '密码至少6位', icon: 'none' })
          return
        }
        if (password !== this.data.confirmPassword) {
          wx.showToast({ title: '两次密码不一致', icon: 'none' })
          return
        }

        await api.authRegister({
          username,
          nickname: this.data.nickname,
          password,
        })
        wx.showToast({ title: '注册成功，请登录', icon: 'success' })
        this.setData({
          isLogin: true,
          password: '',
          confirmPassword: '',
        })
      }
    } catch (err) {
      wx.showToast({
        title: (err && err.message) || '请求失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },
})
