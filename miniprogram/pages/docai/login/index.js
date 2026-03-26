const api = require('../../../api/docai')

function getModeMeta(isLogin) {
  if (isLogin) {
    return {
      modeTitle: '欢迎回来',
      modeDesc: '使用 DocAI 后端账号进入工作台，继续上传资料、发起问答或进行智能填表。',
      submitText: '进入工作台',
      modeTip: '默认对接 DocAI `/api/v1` 接口，登录成功后会保存 JWT 令牌。',
    }
  }

  return {
    modeTitle: '创建 DocAI 账号',
    modeDesc: '注册会调用 DocAI 的统一认证接口，成功后自动登录并进入小程序。',
    submitText: '注册并进入',
    modeTip: '用户名和密码会提交到 `POST /api/v1/users/auth`，密码至少 6 位。',
  }
}

Page({
  data: Object.assign(
    {
      isLogin: true,
      loading: false,
      username: '',
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
        nickname: data.nickname || data.userName || data.username || '',
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
        })
        const data = res.data || {}

        if (!this.applyAuth(data)) {
          throw new Error('注册成功，但未获取到登录令牌')
        }

        wx.showToast({ title: '注册成功', icon: 'success' })
        wx.switchTab({ url: '/pages/docai/dashboard/index' })
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
})
