const api = require('../../../api/docai')

function getModeMeta(isLogin) {
  if (isLogin) {
    return {
      modeTitle: '欢迎回来',
      modeDesc: '进入工作台，继续上传资料、发起问答或进行智能填表。',
      submitText: '进入工作台',
      modeTip: '首次本地联调建议先注册一个测试账号。',
    }
  }

  return {
    modeTitle: '创建测试账号',
    modeDesc: '注册后会直接写入本地环境，方便你继续做前后端联调。',
    submitText: '创建并进入',
    modeTip: '昵称选填，默认会使用用户名作为显示名称。',
  }
}

Page({
  data: Object.assign(
    {
      isLogin: true,
      loading: false,
      username: '',
      nickname: '',
      password: '',
      confirmPassword: '',
    },
    getModeMeta(true)
  ),

  onShow() {
    const token = wx.getStorageSync('token') || ''
    if (token) {
      wx.switchTab({ url: '/pages/docai/dashboard/index' })
    }
  },

  switchMode(e) {
    const isLogin = String(e.currentTarget.dataset.login) === 'true'
    this.setData(Object.assign({
      isLogin,
      password: '',
      confirmPassword: '',
    }, getModeMeta(isLogin)))
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

  applyAuth(data) {
    const token = data.token || ''
    if (!token) {
      return false
    }

    const app = getApp()
    if (app && app.setAuth) {
      app.setAuth(token, {
        id: data.userId,
        username: data.userName || data.username || '',
        email: data.email || '',
      })
    }
    return true
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
        if (!this.applyAuth(data)) {
          throw new Error('登录失败，未获取到登录令牌')
        }
        wx.showToast({ title: '登录成功', icon: 'success' })
        wx.switchTab({ url: '/pages/docai/dashboard/index' })
      } else {
        if (password.length < 6) {
          wx.showToast({ title: '密码至少需要 6 位', icon: 'none' })
          return
        }

        if (password !== this.data.confirmPassword) {
          wx.showToast({ title: '两次输入的密码不一致', icon: 'none' })
          return
        }

        const res = await api.authRegister({
          username,
          password,
          nickname: this.data.nickname,
        })
        const data = res.data || {}

        if (this.applyAuth(data)) {
          wx.showToast({ title: '注册成功', icon: 'success' })
          wx.switchTab({ url: '/pages/docai/dashboard/index' })
          return
        }

        wx.showToast({ title: '注册成功，请登录', icon: 'success' })
        this.setData(Object.assign({
          isLogin: true,
          password: '',
          confirmPassword: '',
        }, getModeMeta(true)))
      }
    } catch (err) {
      wx.showToast({
        title: (err && err.message) || '请求失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  devQuickEnter() {
    const app = getApp()
    const token = 'dev-local-bypass-token'
    const devUser = {
      id: 'dev-local',
      username: '开发者',
      nickname: '开发者',
      email: '',
    }

    if (app && app.setAuth) {
      app.setAuth(token, devUser)
    } else {
      wx.setStorageSync('token', token)
      wx.setStorageSync('user', devUser)
    }

    wx.showToast({ title: '已进入开发者模式', icon: 'none' })
    wx.switchTab({ url: '/pages/docai/dashboard/index' })
  },
})
