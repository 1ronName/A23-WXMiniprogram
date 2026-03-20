const api = require('../../../api/docai')
const { ensureLogin } = require('../../../utils/auth')

const HISTORY_STORAGE_KEY = 'docai_chat_sessions'
const CURRENT_SESSION_STORAGE_KEY = 'docai_chat_current_session_id'
const LINKED_DOC_STORAGE_KEY = 'docai_current_doc'
const MAX_HISTORY_SESSIONS = 20
const INPUT_MIN_HEIGHT = 44
const INPUT_MAX_HEIGHT = 108

const UI_TEXT = {
  navTitle: '\u667a\u80fd\u95ee\u7b54',
  subtitleLinked: '\u5df2\u63a5\u5165\u6587\u6863\u4e0a\u4e0b\u6587',
  subtitleFree: '\u81ea\u7531\u5bf9\u8bdd\u6a21\u5f0f',
  badgeLinked: '\u5df2\u5173\u8054',
  badgeFree: '\u666e\u901a\u95ee\u7b54',
  noDocTitle: '\u8fd8\u6ca1\u6709\u9009\u62e9\u6587\u6863',
  contextLinkedPrefix: '\u5df2\u5173\u8054\uff1a',
  contextLinkedDesc: '\u53ef\u56f4\u7ed5\u8be5\u6587\u6863\u8fdb\u884c\u603b\u7ed3\u3001\u63d0\u53d6\u3001\u6539\u5199',
  contextFreeDesc: '\u53ef\u76f4\u63a5\u63d0\u95ee\uff0c\u4e5f\u53ef\u5148\u5173\u8054\u4e00\u4efd\u6587\u6863',
  chooseDocument: '\u9009\u62e9\u6587\u6863',
  changeDocument: '\u66f4\u6362',
  cancelAction: '\u53d6\u6d88',
  welcomeLinkedTitle: '\u5df2\u4e3a\u4f60\u5173\u8054\u6587\u6863',
  welcomeFreeTitle: '\u4f60\u597d\uff0c\u6211\u968f\u65f6\u53ef\u4ee5\u5e2e\u4f60\u95ee\u7b54\u3001\u603b\u7ed3\u548c\u6574\u7406\u5185\u5bb9\u3002',
  welcomeLinkedPrefix: '\u5f53\u524d\u6587\u6863\u4e3a\u300a',
  welcomeLinkedSuffix: '\u300b\u3002\u4f60\u53ef\u4ee5\u8ba9\u6211\u603b\u7ed3\u6838\u5fc3\u5185\u5bb9\u3001\u63d0\u53d6\u8d1f\u8d23\u4eba\u548c\u65f6\u95f4\u8282\u70b9\u3001\u6574\u7406\u6c47\u62a5\u8981\u70b9\uff0c\u6216\u7ee7\u7eed\u56f4\u7ed5\u6587\u6863\u5185\u5bb9\u63d0\u95ee\u3002',
  welcomeFreeDesc: '\u4f60\u53ef\u4ee5\u76f4\u63a5\u63d0\u95ee\uff0c\u6216\u5148\u9009\u62e9\u4e00\u4efd\u6587\u6863\uff0c\u518d\u56f4\u7ed5\u6750\u6599\u8fdb\u884c\u5b9a\u5411\u5206\u6790\u3002',
  inputLinked: '\u56f4\u7ed5\u8be5\u6587\u6863\u7ee7\u7eed\u63d0\u95ee\u2026',
  inputFree: '\u8bf7\u8f93\u5165\u4f60\u7684\u95ee\u9898',
  pendingText: '\u751f\u6210\u4e2d',
  historyTitle: '\u5386\u53f2\u4f1a\u8bdd',
  newConversation: '\u65b0\u5bf9\u8bdd',
  noHistory: '\u6682\u65e0\u5386\u53f2\u4f1a\u8bdd',
  moreTitle: '\u66f4\u591a\u64cd\u4f5c',
  documentPickerTitle: '\u9009\u62e9\u6587\u6863',
  loadingDocuments: '\u6b63\u5728\u52a0\u8f7d\u6587\u6863\u5217\u8868...',
  reload: '\u91cd\u65b0\u52a0\u8f7d',
  noDocuments: '\u6682\u65e0\u53ef\u9009\u6587\u6863',
  currentLinked: '\u5f53\u524d\u5173\u8054',
  historyToday: '\u4eca\u5929',
  historyRecent: '\u8fd17\u5929',
  historyEarlier: '\u66f4\u65e9',
  untitledDoc: '\u672a\u547d\u540d\u6587\u6863',
  answerCardTitle: '\u63d0\u53d6\u7ed3\u679c',
  serviceBusy: '\u670d\u52a1\u7e41\u5fd9',
  serviceBusyDesc: 'AI \u6b63\u5728\u6392\u961f\u5904\u7406\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
  networkError: '\u7f51\u7edc\u5f02\u5e38',
  networkErrorDesc: '\u5f53\u524d\u7f51\u7edc\u4e0d\u7a33\u5b9a\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002',
  docProcessing: '\u6587\u6863\u89e3\u6790\u4e2d',
  docProcessingDesc: '\u5df2\u8fde\u63a5\u6587\u6863\uff0c\u590d\u6742\u95ee\u9898\u53ef\u80fd\u9700\u8981\u7a0d\u7b49\u3002',
  retry: '\u91cd\u8bd5',
  unknownReply: '\u6682\u672a\u83b7\u53d6\u5230\u56de\u590d\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  quickSummary: '\u603b\u7ed3\u6838\u5fc3\u5185\u5bb9',
  quickSummaryDesc: '\u4e00\u952e\u6293\u4f4f\u6750\u6599\u91cd\u70b9',
  quickOwner: '\u63d0\u53d6\u8d1f\u8d23\u4eba',
  quickOwnerDesc: '\u5b9a\u4f4d\u8d1f\u8d23\u4eba\u548c\u65f6\u95f4\u4fe1\u606f',
  quickReport: '\u6574\u7406\u6c47\u62a5\u8981\u70b9',
  quickReportDesc: '\u751f\u6210\u9002\u5408\u6c47\u62a5\u7684\u8868\u8fbe',
  quickTimeline: '\u627e\u51fa\u5173\u952e\u65f6\u95f4\u8282\u70b9',
  quickTimelineDesc: '\u68b3\u7406\u65f6\u95f4\u7ebf\u548c\u622a\u6b62\u4fe1\u606f',
  quickExplain: '\u89e3\u91ca\u8fd9\u6bb5\u5185\u5bb9',
  quickExplainDesc: '\u9002\u5408\u81ea\u7531\u95ee\u7b54\u548c\u8865\u5145\u7406\u89e3',
  quickFormal: '\u6539\u5199\u5f97\u66f4\u6b63\u5f0f',
  quickFormalDesc: '\u8c03\u6574\u8bed\u6c14\uff0c\u66f4\u9002\u5408\u6b63\u5f0f\u573a\u666f',
  quickOutline: '\u6574\u7406\u6210 3 \u6761\u8981\u70b9',
  quickOutlineDesc: '\u628a\u957f\u6bb5\u5185\u5bb9\u53d8\u5f97\u66f4\u6e05\u6670',
  actionNewLabel: '\u65b0\u5bf9\u8bdd',
  actionNewDesc: '\u5f00\u542f\u4e00\u4e2a\u5168\u65b0\u4f1a\u8bdd',
  actionClearLabel: '\u6e05\u7a7a\u5f53\u524d\u4f1a\u8bdd',
  actionClearDesc: '\u79fb\u9664\u5f53\u524d\u4f1a\u8bdd\u5185\u5bb9',
  actionHistoryLabel: '\u67e5\u770b\u5386\u53f2\u4f1a\u8bdd',
  actionHistoryDesc: '\u67e5\u770b\u6700\u8fd1\u7684\u804a\u5929\u8bb0\u5f55',
  actionChangeDocLabel: '\u66f4\u6362\u6587\u6863',
  actionChangeDocDescLinked: '\u5207\u6362\u5f53\u524d\u5173\u8054\u6587\u6863',
  actionChangeDocDescFree: '\u9009\u62e9\u4e00\u4efd\u6587\u6863\u5efa\u7acb\u4e0a\u4e0b\u6587',
  actionClearDocLabel: '\u53d6\u6d88\u5173\u8054\u6587\u6863',
  actionClearDocDesc: '\u56de\u5230\u666e\u901a\u95ee\u7b54\u6a21\u5f0f',
  toastNewConversation: '\u5df2\u5f00\u542f\u65b0\u5bf9\u8bdd',
  toastSwitchDoc: '\u5df2\u5207\u6362\u5230\u65b0\u7684\u5173\u8054\u6587\u6863',
  toastSwitchDocAndNew: '\u5df2\u5207\u6362\u6587\u6863\u5e76\u5f00\u542f\u65b0\u5bf9\u8bdd',
  toastClearDoc: '\u5df2\u53d6\u6d88\u5173\u8054\u6587\u6863',
  clearConversationTitle: '\u6e05\u7a7a\u5f53\u524d\u4f1a\u8bdd',
  clearConversationContent: '\u5f53\u524d\u4f1a\u8bdd\u5c06\u4ece\u5386\u53f2\u8bb0\u5f55\u4e2d\u79fb\u9664\uff0c\u662f\u5426\u7ee7\u7eed\uff1f',
  clearDocumentTitle: '\u53d6\u6d88\u5173\u8054\u6587\u6863',
  clearDocumentContent: '\u4e3a\u907f\u514d\u4e0d\u540c\u4e0a\u4e0b\u6587\u6df7\u5728\u4e00\u8d77\uff0c\u5c06\u4e3a\u4f60\u5f00\u542f\u4e00\u4e2a\u65b0\u7684\u666e\u901a\u95ee\u7b54\u4f1a\u8bdd\u3002\u662f\u5426\u7ee7\u7eed\uff1f',
  loadDocumentsFailed: '\u6587\u6863\u5217\u8868\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
}

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
  return { id: '', title: '' }
}

function normalizeDoc(doc) {
  if (!doc || (!doc.id && doc.id !== 0)) {
    return getEmptyDoc()
  }

  return {
    id: String(doc.id),
    title: doc.title || doc.fileName || UI_TEXT.untitledDoc,
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
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
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
}

function formatMonthDayTime(value) {
  const date = new Date(value || Date.now())
  return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + formatClock(date)
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

function splitParagraphs(content) {
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return []
  }

  return text.split(/\n{1,2}/).map((item) => item.trim()).filter(Boolean)
}

function buildAiPresentation(content) {
  const text = String(content || '').trim()
  const paragraphs = splitParagraphs(text)
  const rows = []
  const plainLines = []

  text.replace(/\r\n/g, '\n').split('\n').map((item) => item.trim()).filter(Boolean).forEach((line) => {
    const match = line.match(/^([^：:]{1,18})[：:]\s*(.+)$/)
    if (match && match[2]) {
      rows.push({ label: match[1], value: match[2] })
      return
    }
    plainLines.push(line)
  })

  if (rows.length >= 2) {
    return {
      viewType: 'card',
      paragraphs,
      rows: rows.slice(0, 8),
      cardTitle: plainLines.length ? plainLines.shift() : UI_TEXT.answerCardTitle,
      cardTip: plainLines.join('\n'),
    }
  }

  return {
    viewType: 'text',
    paragraphs: paragraphs.length ? paragraphs : [text || UI_TEXT.unknownReply],
    rows: [],
    cardTitle: '',
    cardTip: '',
  }
}

function decorateMessage(item) {
  const role = item.role === 'user' ? 'user' : 'ai'
  const createdAt = Number(item.createdAt) || Date.now()
  const content = String(item.content || '').trim()
  const presentation = role === 'ai'
    ? buildAiPresentation(content)
    : { viewType: 'text', paragraphs: [content], rows: [], cardTitle: '', cardTip: '' }

  return {
    id: item.id || createMessageId(),
    role,
    content,
    createdAt,
    timeLabel: formatClock(createdAt),
    viewType: presentation.viewType,
    paragraphs: presentation.paragraphs,
    rows: presentation.rows,
    cardTitle: presentation.cardTitle,
    cardTip: presentation.cardTip,
  }
}

function buildMessage(role, content) {
  return decorateMessage({
    id: createMessageId(),
    role,
    content,
    createdAt: Date.now(),
  })
}

function hydrateMessages(list) {
  return (Array.isArray(list) ? list : []).map((item) => decorateMessage(item))
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

  return UI_TEXT.newConversation
}

function normalizeSession(session) {
  if (!session || !session.id) {
    return null
  }

  return {
    id: String(session.id),
    title: session.title || UI_TEXT.newConversation,
    updatedAt: Number(session.updatedAt) || Date.now(),
    currentDoc: normalizeDoc(session.currentDoc),
    messages: (Array.isArray(session.messages) ? session.messages : []).map((item) => ({
      id: item.id || createMessageId(),
      role: item.role === 'user' ? 'user' : 'ai',
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
  const recentItems = []
  const earlierItems = []

  ;(list || []).forEach((item) => {
    const updatedAt = Number(item.updatedAt) || now
    const dayDiff = Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000))
    const historyItem = {
      id: item.id,
      title: item.title || UI_TEXT.newConversation,
      updatedLabel: formatHistoryTime(updatedAt),
    }

    if (isSameDay(updatedAt, now)) {
      todayItems.push(historyItem)
      return
    }

    if (dayDiff < 7) {
      recentItems.push(historyItem)
      return
    }

    earlierItems.push(historyItem)
  })

  return [
    { key: 'today', label: UI_TEXT.historyToday, items: todayItems },
    { key: 'recent', label: UI_TEXT.historyRecent, items: recentItems },
    { key: 'earlier', label: UI_TEXT.historyEarlier, items: earlierItems },
  ]
}

function getQuickPrompts(currentDoc) {
  if (currentDoc && currentDoc.id) {
    return [
      { key: 'summary', label: UI_TEXT.quickSummary, desc: UI_TEXT.quickSummaryDesc, prompt: UI_TEXT.quickSummary },
      { key: 'owner', label: UI_TEXT.quickOwner, desc: UI_TEXT.quickOwnerDesc, prompt: UI_TEXT.quickOwner },
      { key: 'report', label: UI_TEXT.quickReport, desc: UI_TEXT.quickReportDesc, prompt: UI_TEXT.quickReport },
      { key: 'timeline', label: UI_TEXT.quickTimeline, desc: UI_TEXT.quickTimelineDesc, prompt: UI_TEXT.quickTimeline },
    ]
  }

  return [
    { key: 'explain', label: UI_TEXT.quickExplain, desc: UI_TEXT.quickExplainDesc, prompt: UI_TEXT.quickExplain },
    { key: 'formal', label: UI_TEXT.quickFormal, desc: UI_TEXT.quickFormalDesc, prompt: UI_TEXT.quickFormal },
    { key: 'outline', label: UI_TEXT.quickOutline, desc: UI_TEXT.quickOutlineDesc, prompt: UI_TEXT.quickOutline },
    { key: 'summary', label: UI_TEXT.quickSummary, desc: UI_TEXT.quickSummaryDesc, prompt: UI_TEXT.quickSummary },
  ]
}

function buildContextView(currentDoc) {
  if (currentDoc && currentDoc.id) {
    return {
      topSubtitle: UI_TEXT.subtitleLinked,
      contextBadge: UI_TEXT.badgeLinked,
      contextTitle: UI_TEXT.contextLinkedPrefix + currentDoc.title,
      contextDesc: UI_TEXT.contextLinkedDesc,
      primaryActionText: UI_TEXT.changeDocument,
      emptyTitle: UI_TEXT.welcomeLinkedTitle,
      emptyDesc: UI_TEXT.welcomeLinkedPrefix + currentDoc.title + UI_TEXT.welcomeLinkedSuffix,
      quickPrompts: getQuickPrompts(currentDoc),
      inputPlaceholder: UI_TEXT.inputLinked,
    }
  }

  return {
    topSubtitle: UI_TEXT.subtitleFree,
    contextBadge: UI_TEXT.badgeFree,
    contextTitle: UI_TEXT.noDocTitle,
    contextDesc: UI_TEXT.contextFreeDesc,
    primaryActionText: UI_TEXT.chooseDocument,
    emptyTitle: UI_TEXT.welcomeFreeTitle,
    emptyDesc: UI_TEXT.welcomeFreeDesc,
    quickPrompts: getQuickPrompts(getEmptyDoc()),
    inputPlaceholder: UI_TEXT.inputFree,
  }
}

function getMoreActions(currentDoc, hasMessages) {
  return [
    { key: 'new', label: UI_TEXT.actionNewLabel, desc: UI_TEXT.actionNewDesc, disabled: false, danger: false },
    { key: 'clear', label: UI_TEXT.actionClearLabel, desc: UI_TEXT.actionClearDesc, disabled: !hasMessages, danger: true },
    { key: 'history', label: UI_TEXT.actionHistoryLabel, desc: UI_TEXT.actionHistoryDesc, disabled: false, danger: false },
    {
      key: 'changeDoc',
      label: UI_TEXT.actionChangeDocLabel,
      desc: currentDoc && currentDoc.id ? UI_TEXT.actionChangeDocDescLinked : UI_TEXT.actionChangeDocDescFree,
      disabled: false,
      danger: false,
    },
    {
      key: 'clearDoc',
      label: UI_TEXT.actionClearDocLabel,
      desc: UI_TEXT.actionClearDocDesc,
      disabled: !(currentDoc && currentDoc.id),
      danger: false,
    },
  ]
}

function buildNotice(type) {
  const map = {
    'doc-processing': {
      type: 'doc-processing',
      title: UI_TEXT.docProcessing,
      desc: UI_TEXT.docProcessingDesc,
      actionText: '',
    },
    'network-error': {
      type: 'network-error',
      title: UI_TEXT.networkError,
      desc: UI_TEXT.networkErrorDesc,
      actionText: UI_TEXT.retry,
    },
    'service-busy': {
      type: 'service-busy',
      title: UI_TEXT.serviceBusy,
      desc: UI_TEXT.serviceBusyDesc,
      actionText: UI_TEXT.retry,
    },
  }

  return map[type] || map['service-busy']
}

function getReplyText(payload) {
  if (!payload) {
    return UI_TEXT.unknownReply
  }

  if (typeof payload === 'string') {
    return payload
  }

  return payload.reply
    || payload.content
    || payload.answer
    || payload.result
    || payload.message
    || UI_TEXT.unknownReply
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
    || message.indexOf('\u7f51\u7edc') !== -1
  ) {
    return 'network-error'
  }

  if (
    message.indexOf('busy') !== -1
    || message.indexOf('429') !== -1
    || message.indexOf('503') !== -1
    || message.indexOf('\u7e41\u5fd9') !== -1
  ) {
    return 'service-busy'
  }

  return 'service-busy'
}

function buildDocumentOption(item) {
  const title = item.fileName || item.title || UI_TEXT.untitledDoc
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
    meta: metaParts.join(' / '),
    modifiedAtValue: getTimeValue(modifiedAt),
  }
}

Page({
  data: {
    ui: UI_TEXT,
    statusBarHeight: 20,
    inputText: '',
    canSend: false,
    inputHeight: INPUT_MIN_HEIGHT,
    loading: false,
    pendingReply: false,
    messages: [],
    scrollIntoView: 'chat-anchor-top',
    currentDoc: getEmptyDoc(),
    currentSessionId: '',
    topSubtitle: UI_TEXT.subtitleFree,
    contextBadge: UI_TEXT.badgeFree,
    contextTitle: UI_TEXT.noDocTitle,
    contextDesc: UI_TEXT.contextFreeDesc,
    primaryActionText: UI_TEXT.chooseDocument,
    emptyTitle: UI_TEXT.welcomeFreeTitle,
    emptyDesc: UI_TEXT.welcomeFreeDesc,
    quickPrompts: getQuickPrompts(getEmptyDoc()),
    inputPlaceholder: UI_TEXT.inputFree,
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
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    this.didInit = false
    this.noticeTimer = null
    this.lastQuestion = ''

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20,
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
    return Object.assign({}, buildContextView(nextDoc), {
      moreActions: getMoreActions(nextDoc, nextMessages.length > 0),
    })
  },

  scrollToAnchor(anchorId) {
    this.setData({ scrollIntoView: '' })
    const runner = () => {
      this.setData({ scrollIntoView: anchorId })
    }

    if (wx.nextTick) {
      wx.nextTick(runner)
      return
    }

    setTimeout(runner, 0)
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
    }, viewState))

    wx.setStorageSync(CURRENT_SESSION_STORAGE_KEY, session.id)
    this.syncCurrentDocStorage(currentDoc)
    this.scrollToAnchor(messages.length ? 'msg-' + messages[messages.length - 1].id : 'chat-anchor-top')
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
    }, viewState))

    wx.setStorageSync(CURRENT_SESSION_STORAGE_KEY, nextSessionId)
    this.syncCurrentDocStorage(nextDoc)
    this.scrollToAnchor('chat-anchor-top')

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
        toast: UI_TEXT.toastSwitchDoc,
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

  handleQuickPrompt(e) {
    const prompt = String(e.currentTarget.dataset.prompt || '').trim()
    if (!prompt) {
      return
    }

    this.submitText(prompt)
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
    const disabled = e.currentTarget.dataset.disabled === true || e.currentTarget.dataset.disabled === 'true'

    if (disabled) {
      return
    }

    this.setData({ showMorePopup: false })

    if (key === 'new') {
      this.startNewConversation({
        doc: this.data.currentDoc,
        toast: UI_TEXT.toastNewConversation,
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
      title: UI_TEXT.clearConversationTitle,
      content: UI_TEXT.clearConversationContent,
      success: (res) => {
        if (!res.confirm) {
          return
        }

        if (this.data.currentSessionId) {
          this.removeSession(this.data.currentSessionId)
        }

        this.startNewConversation({
          doc: this.data.currentDoc,
          toast: UI_TEXT.toastNewConversation,
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
        title: UI_TEXT.clearDocumentTitle,
        content: UI_TEXT.clearDocumentContent,
        success: (res) => {
          if (!res.confirm) {
            return
          }

          this.startNewConversation({
            doc: getEmptyDoc(),
            toast: UI_TEXT.toastClearDoc,
          })
        },
      })
      return
    }

    this.applyCurrentDoc(getEmptyDoc())
    wx.showToast({
      title: UI_TEXT.toastClearDoc,
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
        documentError: UI_TEXT.loadDocumentsFailed,
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

    if (nextDoc.id === this.data.currentDoc.id && nextDoc.title === this.data.currentDoc.title) {
      this.applyCurrentDoc(nextDoc)
      return
    }

    if (this.data.messages.length) {
      this.startNewConversation({
        doc: nextDoc,
        noticeType: 'doc-processing',
        toast: UI_TEXT.toastSwitchDocAndNew,
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
      toast: UI_TEXT.toastNewConversation,
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
    })
    this.scrollToAnchor('msg-loading')
    this.requestAiReply(this.lastQuestion)
  },

  sendMessage() {
    this.submitText(this.data.inputText)
  },

  submitText(text) {
    const question = String(text || '').trim()
    if (!question || this.data.loading) {
      return
    }

    this.lastQuestion = question

    const userMessage = buildMessage('user', question)
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
    }))

    this.persistCurrentSession()
    this.scrollToAnchor('msg-loading')
    this.requestAiReply(question)
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
      const aiMessage = buildMessage('ai', getReplyText((res && res.data) || res))
      const messages = this.data.messages.concat([aiMessage])
      const viewState = this.buildViewState(this.data.currentDoc, messages)

      this.setData(Object.assign({
        messages,
        loading: false,
        pendingReply: false,
        stateNotice: null,
      }, viewState))

      this.persistCurrentSession()
      this.scrollToAnchor('msg-' + aiMessage.id)
    } catch (err) {
      const noticeType = resolveErrorType(err)
      const viewState = this.buildViewState(this.data.currentDoc, this.data.messages)

      this.setData(Object.assign({
        loading: false,
        pendingReply: false,
        stateNotice: buildNotice(noticeType),
      }, viewState))
    }
  },
})
