const DRAFT_STORAGE_KEY = 'docai_autofill_draft'
const RESULT_SESSION_STORAGE_KEY = 'docai_autofill_result_session'

function normalizeText(value) {
  return String(value || '').trim()
}

function toNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function normalizeId(value) {
  if (value || value === 0) {
    return String(value)
  }

  return ''
}

function uniqueIds(list) {
  const result = []

  ;(Array.isArray(list) ? list : []).forEach((item) => {
    const value = normalizeId(item)
    if (!value || result.indexOf(value) !== -1) {
      return
    }

    result.push(value)
  })

  return result
}

function getFileTypeFromName(fileName) {
  const normalizedName = normalizeText(fileName)
  const match = normalizedName.match(/\.([^.]+)$/)
  return match ? String(match[1] || '').toLowerCase() : ''
}

function normalizeSourceDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return null
  }

  const id = normalizeId(doc.id || doc.docId)
  if (!id) {
    return null
  }

  const fileName = normalizeText(doc.fileName || doc.title || doc.name)

  return {
    id,
    fileName: fileName || '未命名文档',
    title: fileName || '未命名文档',
    fileType: normalizeText(doc.fileType).toLowerCase(),
    uploadStatus: normalizeText(doc.uploadStatus).toLowerCase(),
    questionStageKey: normalizeText(doc.questionStageKey).toLowerCase(),
    questionStageText: normalizeText(doc.questionStageText),
    questionStageDesc: normalizeText(doc.questionStageDesc),
    questionStageTone: normalizeText(doc.questionStageTone).toLowerCase(),
    canChat: doc.canChat === true,
    docSummary: normalizeText(doc.docSummary),
  }
}

function normalizeDecision(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    fieldName: normalizeText(item.fieldName || item.slotName || item.placeholder || item.key),
    finalValue: normalizeText(item.finalValue || item.value || item.outputValue),
    finalConfidence: Number(item.finalConfidence || item.confidence || 0) || 0,
    decisionMode: normalizeText(item.decisionMode),
    reason: normalizeText(item.reason),
  }
}

function normalizeDraft(draft) {
  const sourceDocs = (Array.isArray(draft && draft.sourceDocs) ? draft.sourceDocs : [])
    .map(normalizeSourceDoc)
    .filter(Boolean)

  const sourceDocIds = uniqueIds(
    (draft && draft.sourceDocIds) || sourceDocs.map((item) => item.id)
  )

  const dedupedSourceDocs = sourceDocs.filter((item, index, list) => (
    list.findIndex((entry) => entry.id === item.id) === index
  ))

  const parsedReadyCount = dedupedSourceDocs.filter((item) => item.canChat === true).length

  return {
    sourceDocs: dedupedSourceDocs.filter((item) => sourceDocIds.indexOf(item.id) !== -1),
    sourceDocIds,
    templateLocalPath: normalizeText(draft && draft.templateLocalPath),
    templateName: normalizeText(draft && draft.templateName),
    parsedReadyCount: toNumber(draft && draft.parsedReadyCount) || parsedReadyCount,
    userRequirement: normalizeText(draft && draft.userRequirement),
    updatedAt: normalizeText(draft && draft.updatedAt) || new Date().toISOString(),
  }
}

function normalizeResultSession(result) {
  const templateName = normalizeText(result && result.templateName)
  const outputName = normalizeText(result && (result.outputName || result.fileName))
  const sourceDocs = (Array.isArray(result && result.sourceDocs) ? result.sourceDocs : [])
    .map(normalizeSourceDoc)
    .filter(Boolean)
  const decisions = (Array.isArray(result && result.decisions) ? result.decisions : [])
    .map(normalizeDecision)
    .filter(Boolean)

  return {
    recordId: normalizeText(result && result.recordId),
    templateId: normalizeText(result && result.templateId),
    auditId: normalizeText(result && result.auditId),
    templateName: templateName || '未命名模板',
    outputName: outputName || templateName || '智能填表结果',
    outputFile: normalizeText(result && result.outputFile),
    fileType: normalizeText(result && result.fileType).toLowerCase() || getFileTypeFromName(outputName),
    summaryText: normalizeText(result && result.summaryText),
    filledCount: toNumber(result && result.filledCount),
    blankCount: toNumber(result && result.blankCount),
    totalSlots: toNumber(result && result.totalSlots),
    fillTimeMs: toNumber(result && result.fillTimeMs),
    slotCount: toNumber(result && result.slotCount),
    sourceCount: toNumber(result && result.sourceCount) || sourceDocs.length,
    userRequirement: normalizeText(result && result.userRequirement),
    fileSizeText: normalizeText(result && result.fileSizeText),
    createdAt: normalizeText(result && result.createdAt) || new Date().toISOString(),
    decisions,
    sourceDocs,
  }
}

function saveDraft(draft) {
  const normalizedDraft = normalizeDraft(draft)
  wx.setStorageSync(DRAFT_STORAGE_KEY, normalizedDraft)
  return normalizedDraft
}

function loadAutofillDraft() {
  const rawValue = wx.getStorageSync(DRAFT_STORAGE_KEY)
  if (!rawValue || typeof rawValue !== 'object') {
    return normalizeDraft({})
  }

  return normalizeDraft(rawValue)
}

function updateAutofillDraft(patch) {
  const currentDraft = loadAutofillDraft()
  return saveDraft(Object.assign({}, currentDraft, patch || {}, {
    updatedAt: new Date().toISOString(),
  }))
}

function clearAutofillDraft() {
  wx.removeStorageSync(DRAFT_STORAGE_KEY)
}

function saveAutofillResultSession(result) {
  const normalizedResult = normalizeResultSession(result)
  wx.setStorageSync(RESULT_SESSION_STORAGE_KEY, normalizedResult)
  return normalizedResult
}

function loadAutofillResultSession() {
  const rawValue = wx.getStorageSync(RESULT_SESSION_STORAGE_KEY)
  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  return normalizeResultSession(rawValue)
}

function clearAutofillResultSession() {
  wx.removeStorageSync(RESULT_SESSION_STORAGE_KEY)
}

module.exports = {
  getFileTypeFromName,
  loadAutofillDraft,
  updateAutofillDraft,
  clearAutofillDraft,
  saveAutofillResultSession,
  loadAutofillResultSession,
  clearAutofillResultSession,
}
