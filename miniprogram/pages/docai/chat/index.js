const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

const HISTORY_STORAGE_KEY = 'docai_chat_sessions'
const CURRENT_SESSION_STORAGE_KEY = 'docai_chat_current_session_id'
const LINKED_DOC_STORAGE_KEY = 'docai_current_doc'
const MAX_HISTORY_SESSIONS = 20
const INPUT_MIN_HEIGHT = 44
const INPUT_MAX_HEIGHT = 108

let messageSeed = 0
let sessionSeed = 0

function createMessageId() {
  messageSeed += 1
  return 'm_' + Date.now() + '_' + messageSeed
}

function createSessionId() {
  sessionSeed += 1
  return 's_' + Date.now() + '_' + sessionSeed
}

function getEmptyDoc() {
  return {
    id: '',
    title: '',
  }
}

function normalizeDoc(doc) {
  if (!doc || (!doc.id && doc.id !== 0)) {
    return getEmptyDoc()
  }

  return {
    id: String(doc.id),
    title: doc.title || doc.fileName || '未命名文档',
  }
}

function getTimeValue(value) {
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function isSameDay(leftValue, rightValue) {
  const left = new Date(leftValue)
  const right = new Date(rightValue)
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function formatClock(value) {
  const date = new Date(value || Date.now())
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return hours + ':' + minutes
}

function formatMonthDayTime(value) {
  const date = new Date(value || Date.now())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return month + '-' + day + ' ' + formatClock(date)
}

function formatHistoryTime(value) {
  if (!value) {
    return '--'
  }

  if (isSameDay(value, Date.now())) {
    return formatClock(value)
  }

  return formatMonthDayTime(value)
}

function formatSize(size) {
  if (!size && size !== 0) {
    return '-'
  }

  const kb = 1024
  const mb = kb * 1024

  if (size < kb) {
    return size + ' B'
  }

  if (size < mb) {
    return (size / kb).toFixed(1) + ' KB'
  }

  return (size / mb).toFixed(1) + ' MB'
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function splitParagraphs(content) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return []
  }

  return text
    .split(/\n{1,2}/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildAiSections(content) {
  const paragraphs = splitParagraphs(content)
  if (!paragraphs.length) {
    return []
  }

  if (paragraphs.length === 1) {
    return [
      {
        label: '回答内容',
        content: paragraphs[0],
      },
    ]
  }

  const labels = ['原内容', '改写后', '补充说明']
  const sections = paragraphs.slice(0, 3).map((item, index) => ({
    label: labels[index] || '补充说明',
    content: item,
  }))

  if (paragraphs.length > 3) {
    sections[sections.length - 1].content += '\n' + paragraphs.slice(3).join('\n')
  }

  return sections
}

function buildMessage(role, content, options) {
  const now = Date.now()
  const text = String(content || '').trim()
  const title = options && options.title
    ? options.title
    : (role === 'user' ? '我' : '智能问答')

  return {
    id: createMessageId(),
    role: role === 'user' ? 'user' : 'ai',
    title,
    content: text,
    paragraphs: splitParagraphs(text),
    sections: role === 'ai' ? buildAiSections(text) : [],
    createdAt: now,
    timeLabel: formatClock(now),
  }
}

function hydrateMessages(list) {
  return (Array.isArray(list) ? list : []).map((item) => {
    const createdAt = Number(item.createdAt) || Date.now()
    const content = String(item.content || '')
    return {
      id: item.id || createMessageId(),
      role: item.role === 'user' ? 'user' : 'ai',
      title: item.title || (item.role === 'user' ? '我' : '智能问答'),
      content,
      paragraphs: splitParagraphs(content),
      sections: item.role === 'user' ? [] : buildAiSections(content),
      createdAt,
      timeLabel: formatClock(createdAt),
    }
  })
}

function buildSessionTitle(messages, currentDoc) {
  const firstUserMessage = (messages || []).find((item) => item.role === 'user' && item.content)
  if (firstUserMessage) {
    const title = firstUserMessage.content.trim()
    return title.length > 22 ? title.slice(0, 22) + '...' : title
  }

  if (currentDoc && currentDoc.id) {
    return currentDoc.title
  }

  return '新对话'
}

function normalizeSession(session) {
  if (!session || !session.id) {
    return null
  }

  return {
    id: String(session.id),
    title: session.title || '新对话',
    updatedAt: Number(session.updatedAt) || Date.now(),
    currentDoc: normalizeDoc(session.currentDoc),
    messages: (Array.isArray(session.messages) ? session.messages : []).map((item) => ({
      id: item.id || createMessageId(),
      role: item.role === 'user' ? 'user' : 'ai',
      title: item.title || (item.role === 'user' ? '我' : '智能问答'),
      content: String(item.content || ''),
      createdAt: Number(item.createdAt) || Date.now(),
    })),
  }
}

function readSessionList() {
  const sessions = wx.getStorageSync(HISTORY_STORAGE_KEY) || []
  if (!Array.isArray(sessions)) {
    return []
  }

  return sessions
    .map(normalizeSession)
    .filter(Boolean)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

function writeSessionList(list) {
  wx.setStorageSync(HISTORY_STORAGE_KEY, list || [])
}

function buildHistorySections(list) {
  const now = Date.now()
  const todayItems = []
  const lastSevenItems = []
  const earlierItems = []

  ;(list || []).forEach((item) => {
    const updatedAt = Number(item.updatedAt) || now
    const dayDiff = Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000))
    const historyItem = {
      id: item.id,
      title: item.title || '新对话',
      updatedLabel: formatHistoryTime(updatedAt),
    }

    if (isSameDay(updatedAt, now)) {
      todayItems.push(historyItem)
      return
    }

    if (dayDiff < 7) {
      lastSevenItems.push(historyItem)
      return
    }

    earlierItems.push(historyItem)
  })

  return [
    { key: 'today', label: '今天', items: todayItems },
    { key: 'sevenDays', label: '近7天', items: lastSevenItems },
    { key: 'earlier', label: '更早', items: earlierItems },
  ]
}

function getContextCopy(currentDoc) {
  if (currentDoc && currentDoc.id) {
    return {
      modeLabel: '文档问答',
      title: '已关联：' + currentDoc.title,
      desc: '支持总结 / 提取 / 汇报生成 / 改写',
      emptyTitle: '围绕当前文档开始提问',
      emptyDesc: '你可以直接提问，也可以让 AI 总结、提取关键信息，或生成汇报内容。',
    }
  }

  return {
    modeLabel: '普通问答',
    title: '未关联文档｜当前为普通问答',
    desc: '可选择文档后进行定向分析',
    emptyTitle: '开始一次普通问答',
    emptyDesc: '未关联文档时可直接自由提问，关联文档后可围绕材料进行定向分析。',
  }
}

function getMoreActions(currentDoc, hasMessages) {
  return [
    {
      key: 'new',
      label: '新对话',
      desc: '开启一个新的聊天工作台',
      disabled: false,
      danger: false,
    },
    {
      key: 'clear',
      label: '清空当前会话',
      desc: '移除当前会话内容',
      disabled: !hasMessages,
      danger: true,
    },
    {
      key: 'history',
      label: '查看历史会话',
      desc: '查看最近的聊天记录',
      disabled: false,
      danger: false,
    },
    {
      key: 'changeDoc',
      label: '更换文档',
      desc: currentDoc && currentDoc.id ? '切换当前关联文档' : '选择一份文档建立上下文',
      disabled: false,
      danger: false,
    },
    {
      key: 'clearDoc',
      label: '取消关联文档',
      desc: '回到普通问答模式',
      disabled: !(currentDoc && currentDoc.id),
      danger: false,
    },
  ]
}

function buildNotice(type) {
  const map = {
    'doc-processing': {
      type: 'doc-processing',
      title: '文档解析中',
      desc: '已关联文档，复杂分析问题可能需要稍等片刻。',
      actionText: '',
    },
    'network-error': {
      type: 'network-error',
      title: '网络异常',
      desc: '当前网络不稳定，请检查网络后重试。',
      actionText: '重试',
    },
    'service-busy': {
      type: 'service-busy',
      title: '服务繁忙',
      desc: 'AI 服务正在排队处理中，请稍后重新发送。',
      actionText: '重试',
    },
  }

  return map[type] || map['service-busy']
}

function getReplyText(payload) {
  if (!payload) {
    return '暂未获取到回复内容，请稍后重试。'
  }

  if (typeof payload === 'string') {
    return payload
  }

  return payload.reply
    || payload.content
    || payload.answer
    || payload.result
    || payload.message
    || JSON.stringify(payload)
}

function resolveErrorType(err) {
  const message = String(
    (err && (err.message || err.errMsg || err.msg))
      || (err && err.data && err.data.message)
      || ''
  ).toLowerCase()

  if (
    message.indexOf('network') !== -1
    || message.indexOf('timeout') !== -1
    || message.indexOf('fail') !== -1
    || message.indexOf('连接') !== -1
  ) {
    return 'network-error'
  }

  if (
    message.indexOf('busy') !== -1
    || message.indexOf('繁忙') !== -1
    || message.indexOf('429') !== -1
    || message.indexOf('503') !== -1
  ) {
    return 'service-busy'
  }

  return 'service-busy'
}

function buildDocumentOption(item) {
  const title = item.fileName || item.title || '未命名文档'
  const fileType = String(item.fileType || '').toUpperCase()
  const modifiedAt = item.updatedAt || item.createdAt || ''
  const metaParts = []

  if (fileType) {
    metaParts.push(fileType)
  }

  metaParts.push(formatSize(Number(item.fileSize) || 0))

  if (modifiedAt) {
    metaParts.push(formatMonthDayTime(modifiedAt))
  }

  return {
    id: String(item.id),
    title,
    meta: metaParts.join(' · '),
    modifiedAtValue: getTimeValue(modifiedAt),
  }
}

Page({
  data: {
    statusBarHeight: 20,
    inputText: '',
    canSend: false,
    inputHeight: INPUT_MIN_HEIGHT,
    loading: false,
    pendingReply: false,
    messages: [],
    scrollIntoView: 'chat-anchor-top',
    currentDoc: getEmptyDoc(),
    contextTitle: '未关联文档｜当前为普通问答',
    contextDesc: '可选择文档后进行定向分析',
    emptyTitle: '开始一次普通问答',
    emptyDesc: '未关联文档时可直接自由提问，关联文档后可围绕材料进行定向分析。',
    emptyModeLabel: '普通问答',
    currentSessionId: '',
    showHistoryPopup: false,
    historySections: buildHistorySections([]),
    showMorePopup: false,
    moreActions: getMoreActions(getEmptyDoc(), false),
    showDocumentPopup: false,
    documentOptions: [],
    documentLoading: false,
    documentError: '',
    stateNotice: null,
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.didInit = false
    this.noticeTimer = null
    this.lastQuestion = ''

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 20,
    })
  },

  onShow() {
    if (!ensureLogin()) {
      return
    }

    if (!this.didInit) {
      this.didInit = true
      this.bootstrapPage()
      return
    }

    this.syncLinkedDocument()
    this.refreshHistorySections()
  },

  onUnload() {
    this.clearNoticeTimer()
  },

  buildViewState(currentDoc, messages) {
    const nextDoc = normalizeDoc(currentDoc)
    const nextMessages = Array.isArray(messages) ? messages : []
    const contextCopy = getContextCopy(nextDoc)

    return {
      contextTitle: contextCopy.title,
      contextDesc: contextCopy.desc,
      emptyTitle: contextCopy.emptyTitle,
      emptyDesc: contextCopy.emptyDesc,
      emptyModeLabel: contextCopy.modeLabel,
      moreActions: getMoreActions(nextDoc, nextMessages.length > 0),
    }
  },

  bootstrapPage() {
    const sessions = readSessionList()
    const currentSessionId = String(wx.getStorageSync(CURRENT_SESSION_STORAGE_KEY) || '')
    const activeSession = sessions.find((item) => item.id === currentSessionId) || null

    if (activeSession) {
      this.applySession(activeSession)
    } else {
      this.startNewConversation({
        doc: getEmptyDoc(),
      })
    }

    this.syncLinkedDocument()
    this.refreshHistorySections()
  },

  applySession(session) {
    const currentDoc = normalizeDoc(session.currentDoc)
    const messages = hydrateMessages(session.messages)
    const viewState = this.buildViewState(currentDoc, messages)
    const scrollIntoView = messages.length
      ? 'msg-' + messages[messages.length - 1].id
      : 'chat-anchor-top'

    this.setData(Object.assign({
      currentSessionId: session.id,
      currentDoc,
      messages,
      inputText: '',
      canSend: false,
      inputHeight: INPUT_MIN_HEIGHT,
      loading: false,
      pendingReply: false,
      stateNotice: null,
      showHistoryPopup: false,
      showMorePopup: false,
      showDocumentPopup: false,
      scrollIntoView,
    }, viewState))

    wx.setStorageSync(CURRENT_SESSION_STORAGE_KEY, session.id)
    this.syncCurrentDocStorage(currentDoc)
  },

  startNewConversation(options) {
    const nextDoc = normalizeDoc((options && options.doc) || this.data.currentDoc || getEmptyDoc())
    const nextSessionId = createSessionId()
    const viewState = this.buildViewState(nextDoc, [])

    this.clearNoticeTimer()
    this.setData(Object.assign({
      currentSessionId: nextSessionId,
      currentDoc: nextDoc,
      messages: [],
      inputText: '',
      canSend: false,
      inputHeight: INPUT_MIN_HEIGHT,
      loading: false,
      pendingReply: false,
      stateNotice: null,
      showHistoryPopup: false,
      showMorePopup: false,
      showDocumentPopup: false,
      scrollIntoView: 'chat-anchor-top',
    }, viewState))

    wx.setStorageSync(CURRENT_SESSION_STORAGE_KEY, nextSessionId)
    this.syncCurrentDocStorage(nextDoc)

    if (options && options.noticeType) {
      this.showStateNotice(options.noticeType)
    }

    if (options && options.toast) {
      wx.showToast({
        title: options.toast,
        icon: 'none',
      })
    }

    this.refreshHistorySections()
  },

  syncCurrentDocStorage(currentDoc) {
    const nextDoc = normalizeDoc(currentDoc)
    if (nextDoc.id) {
      wx.setStorageSync(LINKED_DOC_STORAGE_KEY, nextDoc)
      return
    }

    wx.removeStorageSync(LINKED_DOC_STORAGE_KEY)
  },

  syncLinkedDocument() {
    const linkedDoc = normalizeDoc(wx.getStorageSync(LINKED_DOC_STORAGE_KEY))
    const currentDoc = normalizeDoc(this.data.currentDoc)
    const hasMessages = this.data.messages.length > 0
    const changed = linkedDoc.id !== currentDoc.id || linkedDoc.title !== currentDoc.title

    if (!linkedDoc.id) {
      if (!hasMessages && currentDoc.id) {
        this.applyCurrentDoc(getEmptyDoc())
      }
      return
    }

    if (!changed) {
      return
    }

    if (hasMessages) {
      this.startNewConversation({
        doc: linkedDoc,
        noticeType: 'doc-processing',
        toast: '已切换到新的关联文档',
      })
      return
    }

    this.applyCurrentDoc(linkedDoc, {
      noticeType: 'doc-processing',
    })
  },

  applyCurrentDoc(currentDoc, options) {
    const nextDoc = normalizeDoc(currentDoc)
    const viewState = this.buildViewState(nextDoc, this.data.messages)

    this.setData(Object.assign({
      currentDoc: nextDoc,
    }, viewState))

    this.syncCurrentDocStorage(nextDoc)

    if (options && options.noticeType) {
      this.showStateNotice(options.noticeType)
    }

    this.persistCurrentSession()
  },

  refreshHistorySections() {
    this.setData({
      historySections: buildHistorySections(readSessionList()),
    })
  },

  persistCurrentSession() {
    const sessionId = this.data.currentSessionId || createSessionId()
    wx.setStorageSync(CURRENT_SESSION_STORAGE_KEY, sessionId)

    if (!this.data.messages.length) {
      this.refreshHistorySections()
      return
    }

    const history = readSessionList().filter((item) => item.id !== sessionId)
    history.unshift({
      id: sessionId,
      title: buildSessionTitle(this.data.messages, this.data.currentDoc),
      updatedAt: Date.now(),
      currentDoc: normalizeDoc(this.data.currentDoc),
      messages: this.data.messages.map((item) => ({
        id: item.id,
        role: item.role,
        title: item.title,
        content: item.content,
        createdAt: item.createdAt,
      })),
    })

    writeSessionList(history.slice(0, MAX_HISTORY_SESSIONS))
    this.refreshHistorySections()
  },

  removeSession(sessionId) {
    writeSessionList(readSessionList().filter((item) => item.id !== sessionId))
    this.refreshHistorySections()
  },

  clearNoticeTimer() {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer)
      this.noticeTimer = null
    }
  },

  showStateNotice(type) {
    this.clearNoticeTimer()
    this.setData({
      stateNotice: buildNotice(type),
    })

    if (type === 'doc-processing') {
      this.noticeTimer = setTimeout(() => {
        this.setData({ stateNotice: null })
      }, 2400)
    }
  },

  clearStateNotice() {
    this.clearNoticeTimer()
    this.setData({ stateNotice: null })
  },

  onInput(e) {
    const inputText = e.detail.value || ''
    this.setData({
      inputText,
      canSend: String(inputText).trim().length > 0,
    })
  },

  onInputLineChange(e) {
    const nextHeight = clamp(
      Math.round((e && e.detail && e.detail.height) || INPUT_MIN_HEIGHT),
      INPUT_MIN_HEIGHT,
      INPUT_MAX_HEIGHT
    )

    if (nextHeight !== this.data.inputHeight) {
      this.setData({ inputHeight: nextHeight })
    }
  },

  openHistory() {
    this.refreshHistorySections()
    this.setData({
      showHistoryPopup: true,
      showMorePopup: false,
      showDocumentPopup: false,
    })
  },

  openMore() {
    this.setData({
      showMorePopup: true,
      showHistoryPopup: false,
      showDocumentPopup: false,
      moreActions: getMoreActions(this.data.currentDoc, this.data.messages.length > 0),
    })
  },

  closeMask() {
    this.setData({
      showHistoryPopup: false,
      showMorePopup: false,
      showDocumentPopup: false,
    })
  },

  noop() {},

  handleMoreAction(e) {
    const key = e.currentTarget.dataset.key
    const disabled = e.currentTarget.dataset.disabled

    if (disabled) {
      return
    }

    this.setData({ showMorePopup: false })

    if (key === 'new') {
      this.startNewConversation({
        doc: this.data.currentDoc,
        toast: '已开启新对话',
      })
      return
    }

    if (key === 'clear') {
      this.handleClearConversation()
      return
    }

    if (key === 'history') {
      this.openHistory()
      return
    }

    if (key === 'changeDoc') {
      this.openDocumentPicker()
      return
    }

    if (key === 'clearDoc') {
      this.handleClearDocument()
    }
  },

  handleClearConversation() {
    if (!this.data.messages.length) {
      this.startNewConversation({
        doc: this.data.currentDoc,
      })
      return
    }

    wx.showModal({
      title: '清空当前会话',
      content: '当前会话将从历史记录中移除，是否继续？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        if (this.data.currentSessionId) {
          this.removeSession(this.data.currentSessionId)
        }

        this.startNewConversation({
          doc: this.data.currentDoc,
          toast: '已开启新对话',
        })
      },
    })
  },

  handleClearDocument() {
    if (!this.data.currentDoc.id) {
      return
    }

    if (this.data.messages.length) {
      wx.showModal({
        title: '取消关联文档',
        content: '为避免不同上下文混在一起，将为你开启一个新的普通问答会话。是否继续？',
        success: (res) => {
          if (!res.confirm) {
            return
          }

          this.startNewConversation({
            doc: getEmptyDoc(),
            toast: '已取消关联文档',
          })
        },
      })
      return
    }

    this.applyCurrentDoc(getEmptyDoc())
    wx.showToast({
      title: '已取消关联文档',
      icon: 'none',
    })
  },

  async openDocumentPicker() {
    this.setData({
      showDocumentPopup: true,
      showHistoryPopup: false,
      showMorePopup: false,
    })

    await this.ensureDocumentsLoaded()
  },

  async ensureDocumentsLoaded(force) {
    if (this.data.documentLoading) {
      return
    }

    if (this.data.documentOptions.length && !force) {
      return
    }

    this.setData({
      documentLoading: true,
      documentError: '',
    })

    try {
      const res = await api.getSourceDocuments()
      const documentOptions = (res.data || [])
        .map(buildDocumentOption)
        .sort((left, right) => right.modifiedAtValue - left.modifiedAtValue)
        .slice(0, 40)

      this.setData({
        documentOptions,
        documentError: '',
      })
    } catch (err) {
      this.setData({
        documentError: '文档列表加载失败，请稍后重试',
      })
    } finally {
      this.setData({
        documentLoading: false,
      })
    }
  },

  retryLoadDocuments() {
    this.ensureDocumentsLoaded(true)
  },

  chooseDocument(e) {
    const targetId = String(e.currentTarget.dataset.id || '')
    const targetDoc = this.data.documentOptions.find((item) => item.id === targetId)

    if (!targetDoc) {
      return
    }

    this.setData({ showDocumentPopup: false })

    const nextDoc = {
      id: targetDoc.id,
      title: targetDoc.title,
    }

    if (nextDoc.id === this.data.currentDoc.id) {
      this.applyCurrentDoc(nextDoc)
      return
    }

    if (this.data.messages.length) {
      this.startNewConversation({
        doc: nextDoc,
        noticeType: 'doc-processing',
        toast: '已切换文档并开启新对话',
      })
      return
    }

    this.applyCurrentDoc(nextDoc, {
      noticeType: 'doc-processing',
    })
  },

  createNewConversation() {
    this.setData({ showHistoryPopup: false })
    this.startNewConversation({
      doc: this.data.currentDoc,
      toast: '已开启新对话',
    })
  },

  selectHistorySession(e) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const targetSession = readSessionList().find((item) => item.id === sessionId)

    if (!targetSession) {
      return
    }

    this.setData({ showHistoryPopup: false })
    this.applySession(targetSession)
  },

  retryLastRequest() {
    if (!this.lastQuestion || this.data.loading) {
      return
    }

    this.clearStateNotice()
    this.setData({
      loading: true,
      pendingReply: true,
      scrollIntoView: 'msg-loading',
    })
    this.requestAiReply(this.lastQuestion)
  },

  async sendMessage() {
    const text = String(this.data.inputText || '').trim()
    if (!text || !this.data.canSend || this.data.loading) {
      return
    }

    this.lastQuestion = text

    const userMessage = buildMessage('user', text, { title: '我' })
    const messages = this.data.messages.concat([userMessage])
    const viewState = this.buildViewState(this.data.currentDoc, messages)

    this.clearStateNotice()
    this.setData(Object.assign({}, viewState, {
      messages,
      inputText: '',
      canSend: false,
      inputHeight: INPUT_MIN_HEIGHT,
      loading: true,
      pendingReply: true,
      scrollIntoView: 'msg-loading',
    }))

    this.persistCurrentSession()
    await this.requestAiReply(text)
  },

  async requestAiReply(question) {
    try {
      const payload = {
        message: question,
      }

      if (this.data.currentDoc.id) {
        payload.documentId = this.data.currentDoc.id
      }

      const res = await api.aiChat(payload)
      const aiMessage = buildMessage(
        'ai',
        getReplyText((res && res.data) || res),
        { title: this.data.currentDoc.id ? '文档助理' : '智能问答' }
      )
      const messages = this.data.messages.concat([aiMessage])
      const viewState = this.buildViewState(this.data.currentDoc, messages)

      this.setData(Object.assign({
        messages,
        loading: false,
        pendingReply: false,
        stateNotice: null,
        scrollIntoView: 'msg-' + aiMessage.id,
      }, viewState))

      this.persistCurrentSession()
    } catch (err) {
      const noticeType = resolveErrorType(err)
      const viewState = this.buildViewState(this.data.currentDoc, this.data.messages)

      this.setData(Object.assign({
        loading: false,
        pendingReply: false,
        stateNotice: buildNotice(noticeType),
      }, viewState))

      this.persistCurrentSession()
    }
  },
})
