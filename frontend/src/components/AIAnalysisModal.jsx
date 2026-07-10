import React, { useState, useEffect, useRef } from 'react'
import { FiX, FiDownload, FiLoader, FiCheckCircle, FiAlertCircle, FiBarChart2, FiBook, FiMessageCircle, FiEdit2, FiRefreshCw, FiTrash2, FiSend } from 'react-icons/fi'
import axios from 'axios'
import { toast } from 'react-toastify'

/**
 * Convert markdown text to React elements with proper formatting
 */
const parseMarkdown = (text) => {
  if (!text) return null

  const isTableLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed.includes('|')) return false
    // Avoid treating normal list items as table rows
    return !/^[-*•]\s*[^\s]/.test(trimmed) || trimmed.startsWith('- |') || trimmed.startsWith('* |') || trimmed.startsWith('• |')
  }

  const parseTableBlock = (lines, startIdx) => {
    const rows = []
    let idx = startIdx
    while (idx < lines.length && lines[idx].trim()) {
      const raw = lines[idx].trim()
      if (!raw.includes('|')) break
      const rowLine = raw.replace(/^[\-*•]\s*/, '')
      const cells = rowLine
        .split('|')
        .map(cell => cell.trim())
        .filter((cell, index, array) => index !== 0 || cell !== '')
      if (cells.length > 0) {
        rows.push(cells)
      }
      idx += 1
    }

    const hasHeader = rows.length > 1 && rows[1].every(cell => /^:?-+:?$/.test(cell))
    const header = hasHeader ? rows[0] : null
    const bodyRows = hasHeader ? rows.slice(2) : rows

    const table = (
      <div key={`table-${startIdx}`} className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          {header && (
            <thead>
              <tr>
                {header.map((cell, cellIdx) => (
                  <th key={cellIdx} className="border border-gray-300 px-3 py-2 bg-gray-50 text-left font-medium text-gray-800">
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {bodyRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="border border-gray-300 px-3 py-2 text-gray-700">
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

    return { element: table, nextIndex: idx }
  }

  const lines = text.split('\n')
  const elements = []
  let currentList = []
  let listType = null

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'bullet') {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 ml-2">
            {currentList}
          </ul>
        )
      } else if (listType === 'number') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 ml-2">
            {currentList}
          </ol>
        )
      }
      currentList = []
      listType = null
    }
  }

  for (let idx = 0; idx < lines.length; idx += 1) {
    let line = lines[idx]
    if (!line.trim()) {
      flushList()
      elements.push(<br key={`br-${idx}`} />)
      continue
    }

    if (isTableLine(line)) {
      flushList()
      const { element, nextIndex } = parseTableBlock(lines, idx)
      elements.push(element)
      idx = nextIndex - 1
      continue
    }

    if (line.match(/^[*\-•]\s+/)) {
      if (listType !== 'bullet') {
        flushList()
        listType = 'bullet'
      }
      const content = line.replace(/^[*\-•]\s+/, '')
      currentList.push(
        <li key={`li-${idx}`} className="text-sm text-gray-700">
          {renderInlineMarkdown(content)}
        </li>
      )
      continue
    }

    if (line.match(/^\d+\.\s+/)) {
      if (listType !== 'number') {
        flushList()
        listType = 'number'
      }
      const content = line.replace(/^\d+\.\s+/, '')
      currentList.push(
        <li key={`li-${idx}`} className="text-sm text-gray-700">
          {renderInlineMarkdown(content)}
        </li>
      )
      continue
    }

    flushList()

    if (line.startsWith('##')) {
      const content = line.replace(/^#+\s+/, '')
      elements.push(
        <h4 key={`h4-${idx}`} className="text-sm font-semibold text-gray-800 mt-3 mb-2">
          {renderInlineMarkdown(content)}
        </h4>
      )
      continue
    }

    elements.push(
      <p key={`p-${idx}`} className="text-sm text-gray-700 mb-1">
        {renderInlineMarkdown(line)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-1">{elements}</div>
}

/**
 * Render inline markdown (bold, italic, links)
 */
const renderInlineMarkdown = (text) => {
  if (!text) return text
  
  const parts = []
  let remaining = text
  let key = 0
  
  while (remaining) {
    // Match bold **text**
    const boldMatch = remaining.match(/^\*\*(.*?)\*\*/)
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>)
      remaining = remaining.substring(boldMatch[0].length)
      continue
    }
    
    // Match italic *text* (but not **)
    const italicMatch = remaining.match(/(?<!\*)\*(.*?)\*(?!\*)/)
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>)
      remaining = remaining.substring(italicMatch[0].length)
      continue
    }
    
    // Match italic _text_
    const italicUnderscoreMatch = remaining.match(/_(.*?)_/)
    if (italicUnderscoreMatch) {
      parts.push(<em key={key++}>{italicUnderscoreMatch[1]}</em>)
      remaining = remaining.substring(italicUnderscoreMatch[0].length)
      continue
    }
    
    // No match, take first character
    if (remaining[0]) {
      parts.push(remaining[0])
      remaining = remaining.substring(1)
    }
  }
  
  return parts.length > 0 ? parts : text
}

/**
 * AIAnalysisModal Component
 * Provides AI-powered analysis, insights, recommendations, and report generation
 * for chart data with customizable output formats
 */
const safeJsonStringify = (value) => {
  const seen = new WeakSet()
  return JSON.stringify(value, (key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]'
      }
      seen.add(val)
    }
    return val
  })
}

const safeJsonClone = (value) => {
  if (value === undefined) return undefined
  try {
    return JSON.parse(safeJsonStringify(value))
  } catch {
    return null
  }
}

const AIAnalysisModal = ({
  isOpen,
  onClose,
  reconciliationId,
  chartData,
  chartType,
  title = 'AI Analysis',
  targetLabel = '',
  analysisContext = {},
  action = 'modal',
  analysisType: initialAnalysisType = 'summary',
  outputFormat: initialOutputFormat = 'combined'
}) => {
  const [analysisType, setAnalysisType] = useState(initialAnalysisType)
  const [outputFormat, setOutputFormat] = useState(initialOutputFormat) // combined, bullets, text
  const [reportFormat, setReportFormat] = useState('excel') // excel, pdf, word
  const [loading, setLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [analysisResults, setAnalysisResults] = useState({})
  const [recommendations, setRecommendations] = useState('')
  const [insights, setInsights] = useState({})
  const [chatQuery, setChatQuery] = useState('')
  const [chatOutput, setChatOutput] = useState('')
  // ── Enhanced chat state ────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([])      // [{id, role, content, timestamp}]
  const [editingMsgId, setEditingMsgId] = useState(null)    // id of message being edited
  const [editingContent, setEditingContent] = useState('')
  const [chatSessions, setChatSessions] = useState(() => {  // sidebar history
    try { return JSON.parse(localStorage.getItem('aiChatSessions') || '[]') }
    catch { return [] }
  })
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [showChatSidebar, setShowChatSidebar] = useState(true)
  const chatEndRef = useRef(null)
  const [activeTab, setActiveTab] = useState('analysis') // analysis, recommendations, insights, chat
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [isStaleResults, setIsStaleResults] = useState(false)
  const chartKeyRef = useRef(null)
  const actionTrackerRef = useRef('')

  // Analysis type options
  const analysisTypes = [
    { id: 'summary', label: 'Summary & Observations', icon: '📊' },
    { id: 'trend', label: 'Trend Analysis', icon: '📈' },
    { id: 'comparative', label: 'Comparative Analysis', icon: '⚖️' },
    { id: 'anomaly', label: 'Anomaly Detection', icon: '⚠️' }
  ]

  useEffect(() => {
    if (!isOpen) {
      setIsStaleResults(false)
      chartKeyRef.current = null
      actionTrackerRef.current = ''
      setChatOutput('')
      setChatQuery('')
      return
    }

    const newChartKey = safeJsonStringify({ chartData, chartType, title, targetLabel, analysisContext })
    if (chartKeyRef.current !== null && chartKeyRef.current !== newChartKey) {
      setIsStaleResults(true)
    }
    chartKeyRef.current = newChartKey

      const actionKey = JSON.stringify({ action, analysisType: initialAnalysisType, outputFormat: initialOutputFormat, chartKey: newChartKey })
    if (actionKey !== actionTrackerRef.current) {
      actionTrackerRef.current = actionKey
      setOutputFormat(initialOutputFormat)
      if (action === 'recommendations') {
        setActiveTab('recommendations')
        handleGetRecommendations()
      } else if (action === 'insights') {
        setActiveTab('insights')
        handleGetInsights()
      } else if (action === 'analysis' || action === 'modal') {
        setAnalysisType(initialAnalysisType || 'summary')
        setActiveTab('analysis')
        if (action === 'analysis') {
          handleAnalyze(initialAnalysisType || 'summary')
        }
      } else if (action === 'chat') {
        setActiveTab('chat')
      }
    }
  }, [isOpen, chartData, chartType, title, targetLabel, analysisContext, action, initialAnalysisType, initialOutputFormat])

  // Output format options
  const outputFormats = [
    { id: 'combined', label: 'Chart + Analysis', desc: 'Visual + Text' },
    { id: 'bullets', label: 'Key Points', desc: 'Bullet Points' },
    { id: 'text', label: 'Analysis Only', desc: 'Text Only' }
  ]

  // Report format options
  const reportFormats = [
    { id: 'excel', label: 'Excel (.xlsx)' },
    { id: 'pdf', label: 'PDF (.pdf)' },
    { id: 'word', label: 'Word (.docx)' }
  ]

  /**
   * Perform single analysis
   */
  const handleAnalyze = async (typeToUse = analysisType) => {
    // Guard: if called directly from onClick, typeToUse will be a SyntheticEvent — ignore it
    const resolvedType = (typeToUse && typeof typeToUse === 'string') ? typeToUse : analysisType || 'summary'

    if (!chartData) {
      toast.warning('No chart data available for analysis')
      return
    }

    setAnalysisType(resolvedType)
    setIsStaleResults(false)
    setLoading(true)
    try {
      const response = await axios.post('/api/analysis/chart-analysis', {
        reconciliation_id: reconciliationId,
        chart_data: safeJsonClone(chartData),
        chart_type: chartType,
        analysis_type: resolvedType,
        context: safeJsonClone(analysisContext)
      })

      if (response.data.success) {
        setAnalysisResults(prev => ({
          ...prev,
          [resolvedType]: response.data.content
        }))
        toast.success(`${resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1)} analysis complete`)
      } else {
        const errorMsg = response.data.error || 'Analysis failed. Please try again.'
        toast.error(errorMsg)
        console.error('Analysis error:', response.data)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to perform analysis'
      toast.error(errorMsg)
      console.error('Analysis error:', error.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Perform all analyses at once
   */
  const handleBatchAnalyze = async () => {
    if (!chartData) {
      toast.warning('No chart data available for analysis')
      return
    }

    setIsStaleResults(false)
    setBatchLoading(true)
    try {
      const response = await axios.post('/api/analysis/batch-analysis', {
        reconciliation_id: reconciliationId,
        chart_data: safeJsonClone(chartData),
        chart_type: chartType,
        analysis_types: ['summary', 'trend', 'comparative', 'anomaly'],
        context: safeJsonClone(analysisContext)
      })

      if (response.data.success) {
        const results = {}
        Object.entries(response.data.analyses).forEach(([type, result]) => {
          if (result.success) {
            results[type] = result.content
          }
        })
        setAnalysisResults(results)
        setActiveTab('analysis')
        toast.success('All analyses completed successfully')
      } else {
        const errorMsg = response.data.error || 'Batch analysis failed'
        toast.error(errorMsg)
        console.error('Batch analysis error:', response.data)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to perform batch analysis'
      toast.error(errorMsg)
      console.error('Batch analysis error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    } finally {
      setBatchLoading(false)
    }
  }

  /**
   * Get recommendations
   */
  const handleGetRecommendations = async () => {
    if (!chartData) {
      toast.warning('No chart data available')
      return
    }

    setIsStaleResults(false)
    setLoading(true)
    try {
      const response = await axios.post('/api/analysis/recommendations', {
        reconciliation_id: reconciliationId,
        chart_data: safeJsonClone(chartData),
        context: safeJsonClone({ chart_type: chartType, ...analysisContext })
      })

      if (response.data.success) {
        setRecommendations(response.data.recommendations)
        setActiveTab('recommendations')
        toast.success('Recommendations generated')
      } else {
        const errorMsg = response.data.error || 'Failed to get recommendations'
        toast.error(errorMsg)
        console.error('Recommendations error:', response.data)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to get recommendations'
      toast.error(errorMsg)
      console.error('Recommendations error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Get insights
   */
  const handleGetInsights = async () => {
    if (!reconciliationId) {
      toast.warning('Insights are available only for a specific reconciliation.')
      return
    }

    setIsStaleResults(false)
    setLoading(true)
    try {
      const response = await axios.post('/api/analysis/insights', {
        reconciliation_id: reconciliationId
      })

      if (response.data.success) {
        setInsights(response.data)
        setActiveTab('insights')
        toast.success('Insights generated')
      } else {
        const errorMsg = response.data.error || 'Failed to get insights'
        toast.error(errorMsg)
        console.error('Insights error:', response.data)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to get insights'
      toast.error(errorMsg)
      console.error('Insights error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Enhanced chat functions ────────────────────────────────────────────────
  const saveSessions = (sessions) => {
    localStorage.setItem('aiChatSessions', JSON.stringify(sessions.slice(0, 50)))
  }

  const startNewSession = () => {
    const id = `session-${Date.now()}`
    setActiveSessionId(id)
    setChatMessages([])
    setChatQuery('')
    return id
  }

  const loadSession = (session) => {
    setActiveSessionId(session.id)
    setChatMessages(session.messages || [])
    setChatQuery('')
  }

  const deleteSession = (sessionId, e) => {
    e.stopPropagation()
    const updated = chatSessions.filter(s => s.id !== sessionId)
    setChatSessions(updated)
    saveSessions(updated)
    if (activeSessionId === sessionId) startNewSession()
  }

  const sendChatMessage = async (queryText, replaceFromId = null) => {
    if (!queryText.trim()) { toast.warning('Enter a message first'); return }

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: queryText.trim(),
      timestamp: new Date().toISOString(),
    }

    // Build message list — if replaceFromId, truncate from that point
    let baseMessages = chatMessages
    if (replaceFromId) {
      const idx = chatMessages.findIndex(m => m.id === replaceFromId)
      baseMessages = idx >= 0 ? chatMessages.slice(0, idx) : chatMessages
    }
    const nextMessages = [...baseMessages, userMsg]
    setChatMessages(nextMessages)
    setChatQuery('')
    setLoading(true)

    try {
      // Build conversation history for context
      const history = nextMessages.slice(-10).map(m => ({
        role: m.role, content: m.content
      }))

      const response = await axios.post('/api/analysis/chat', {
        reconciliation_id: reconciliationId,
        chart_data: safeJsonClone(chartData),
        chart_type: chartType,
        prompt: queryText.trim(),
        history,
        context: safeJsonClone({ ...analysisContext, target: targetLabel })
      })

      const answer = response.data.success
        ? (response.data.content || response.data.answer || '')
        : (response.data.error || 'No response')

      const aiMsg = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: answer,
        timestamp: new Date().toISOString(),
      }

      const finalMessages = [...nextMessages, aiMsg]
      setChatMessages(finalMessages)

      // Save / update session
      const sessionId = activeSessionId || `session-${Date.now()}`
      if (!activeSessionId) setActiveSessionId(sessionId)
      const sessionName = queryText.trim().slice(0, 45) + (queryText.length > 45 ? '…' : '')
      const updatedSessions = [
        { id: sessionId, name: sessionName, messages: finalMessages, updatedAt: new Date().toISOString() },
        ...chatSessions.filter(s => s.id !== sessionId)
      ]
      setChatSessions(updatedSessions)
      saveSessions(updatedSessions)

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Chat failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChatQuery = async () => sendChatMessage(chatQuery)

  /**
   * Generate and download report
   */
  const handleGenerateReport = async (selectedFormat = reportFormat) => {
    if (Object.keys(analysisResults).length === 0) {
      toast.warning('Please perform analysis first')
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(
        '/api/analysis/generate-report',
        {
          reconciliation_id: reconciliationId,
          format: selectedFormat,
          title: title,
          summary_data: {
            'Analysis Types': Object.keys(analysisResults).join(', '),
            'Generated At': new Date().toLocaleString(),
            'Chart Type': chartType
          },
          analysis_results: analysisResults,
          include_records: true
        },
        { responseType: 'blob' }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const extension = selectedFormat === 'word' ? 'docx' : selectedFormat === 'pdf' ? 'pdf' : 'xlsx'
      link.setAttribute('download', `analysis_report_${Date.now()}.${extension}`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Report downloaded successfully')
      setShowReportOptions(false)
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to generate report'
      toast.error(errorMsg)
      console.error('Report generation error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Format analysis content based on output format
   */
  const formatContent = (content) => {
    if (!content) return null
    
    if (outputFormat === 'text') {
      return parseMarkdown(content)
    }

    if (outputFormat === 'bullets') {
      // Convert to bullet points
      const lines = content.split('\n').filter(line => line.trim())
      return (
        <ul className="list-disc list-inside space-y-2">
          {lines.map((line, idx) => (
            <li key={idx} className="text-sm text-gray-700">
              {renderInlineMarkdown(line.replace(/^[-*•]\s*/, ''))}
            </li>
          ))}
        </ul>
      )
    }

    // Combined format (default) - use markdown parser
    return parseMarkdown(content)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-200 to-gray-300 text-[#8E288D] rounded-lg hover:from-gray-400 hover:to-gray-300 p-3 flex justify-between items-center">
          <div className='flex'>
            <h2 className="text-2xl font-bold flex items-center gap-2 mr-3">
              <FiBarChart2 /> AI Analysis & Insights
            </h2>
            <p className="text-[#CFB53B] font-bold text-sm mt-2.5 mr-3">{title}</p>
            {targetLabel && (
              <p className="text-gray-800 text-xs mt-3">Target: {targetLabel}</p>
            )}
            {/* <p className="text-purple-200 text-xs mt-1">Right-click a chart or table to preserve AI context when switching between tabs.</p> */}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-1 bg-gray-50">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {action === 'modal' ? (
              <>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'analysis'
                      ? 'border-[#8E288D] text-[#8E288D]'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Analysis
                </button>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'recommendations'
                      ? 'border-[#8E288D] text-[#8E288D]'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Recommendations
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'insights'
                      ? 'border-[#8E288D] text-[#8E288D]'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Insights
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'chat'
                      ? 'border-[#8E288D] text-[#8E288D]'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Chat
                </button>
              </>
            ) : (
              <button
                className="px-4 py-2 font-medium border-b-2 border-purple-600 text-purple-600"
              >
                {action === 'analysis'
                  ? 'Analysis'
                  : action === 'recommendations'
                    ? 'Recommendations'
                    : action === 'insights'
                      ? 'Insights'
                      : action === 'chat'
                        ? 'Chat'
                        : 'Analysis'}
              </button>
            )}
          </div>

          {isStaleResults && (
            <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Previous AI output is still visible for the prior chart.
              Generate a new analysis, recommendations, or insights to refresh results for the current selection.
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              {/* Analysis Type Selection — dropdown */}
              <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4'>
              <div>
                <label className="block font-semibold text-gray-800 mb-2 text-sm">Select Analysis Type</label>
                <select
                  value={analysisType}
                  onChange={e => setAnalysisType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {analysisTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Format Selection — dropdown */}
              <div>
                <label className="block font-semibold text-gray-800 mb-2 text-sm">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={e => setOutputFormat(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {outputFormats.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.icon} {format.label}
                    </option>
                  ))}
                </select>
              </div>
              </div>
              {/* Analysis Results */}
              {Object.keys(analysisResults).length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FiCheckCircle className="text-green-600" /> Analysis Results
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(analysisResults).map(([type, content]) => (
                      <div key={type} className="border-l-4 border-[#8E288D] pl-4 py-2">
                        <p className="font-medium text-sm text-[#8E288D] mb-2">
                          {type.charAt(0).toUpperCase() + type.slice(1)} Analysis
                        </p>
                        <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 space-y-2">
                          {formatContent(content)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={loading || batchLoading}
                  className="flex-1 bg-gradient-to-r from-[#CFB53B] to-[#8E288D] text-white rounded-lg hover:from-[#8E288D] hover:to-[#CFB53B] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  {loading ? (
                    <>
                      <FiLoader className="animate-spin" /> Analyzing...
                    </>
                  ) : (
                    'Analyze This Type'
                  )}
                </button>
                <button
                  onClick={handleBatchAnalyze}
                  disabled={loading || batchLoading}
                  className="flex-1 bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  {batchLoading ? (
                    <>
                      <FiLoader className="animate-spin" /> Analyzing All...
                    </>
                  ) : (
                    'Analyze All Types'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {recommendations ? (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FiBook className="text-blue-600" /> Recommendations
                  </h3>
                  <div className="text-sm text-gray-700 space-y-2">
                    {parseMarkdown(recommendations)}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No recommendations yet</p>
                </div>
              )}
              <button
                onClick={handleGetRecommendations}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <FiLoader className="animate-spin" /> Generating...
                  </>
                ) : (
                  'Generate Recommendations'
                )}
              </button>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-4">
              {Object.keys(insights).length > 0 && (
                <div className="space-y-4">
                  {insights.summary && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
                      <div className="text-sm text-gray-700 space-y-2">
                        <p><span className="font-medium">Total Records:</span> {insights.summary.total_records}</p>
                        <p><span className="font-medium">Reconciled:</span> {insights.summary.reconciled_count}</p>
                        <p><span className="font-medium">Unreconciled:</span> {insights.summary.unreconciled_count}</p>
                        <p><span className="font-medium">Rate:</span> {insights.summary.reconciliation_rate}</p>
                      </div>
                    </div>
                  )}
                  {insights.insights && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FiAlertCircle className="text-orange-600" /> Key Insights
                      </h3>
                      <div className="text-sm text-gray-700 space-y-2">
                        {parseMarkdown(insights.insights)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handleGetInsights}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <FiLoader className="animate-spin" /> Generating...
                  </>
                ) : (
                  'Generate Insights'
                )}
              </button>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex h-full gap-0 overflow-hidden" style={{ minHeight: '420px' }}>
              {/* ── Chat History Sidebar ───────────────────────────────── */}
              {showChatSidebar && (
                <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden rounded-l-lg">
                  <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">History</span>
                    <button onClick={startNewSession}
                      className="text-xs bg-[#8E288D] text-white px-2 py-0.5 rounded hover:bg-[#7A1E79]">
                      + New
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {chatSessions.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6 px-2">No chat history yet</p>
                    ) : chatSessions.map(session => (
                      <div key={session.id}
                        onClick={() => loadSession(session)}
                        className={`group flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${activeSessionId === session.id ? 'bg-purple-50 border-l-2 border-l-[#8E288D]' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 font-medium truncate">{session.name}</p>
                          <p className="text-xs text-gray-400">{new Date(session.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={e => deleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 ml-1 flex-shrink-0 transition-opacity">
                          <FiX className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Chat Main Area ─────────────────────────────────────── */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Toggle sidebar button */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-white">
                  <button onClick={() => setShowChatSidebar(s => !s)}
                    className="text-xs text-gray-500 hover:text-[#8E288D] flex items-center gap-1">
                    <FiMessageCircle className="h-3.5 w-3.5" />
                    {showChatSidebar ? 'Hide history' : 'Show history'}
                  </button>
                  {activeSessionId && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gray-50">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <FiMessageCircle className="mx-auto h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Start a conversation</p>
                      <p className="text-xs mt-1">Ask anything about this reconciliation data</p>
                    </div>
                  )}

                  {chatMessages.map((msg, idx) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        msg.role === 'user' ? 'bg-[#8E288D] text-white' : 'bg-[#CFB53B] text-white'
                      }`}>
                        {msg.role === 'user' ? 'U' : 'AI'}
                      </div>

                      {/* Bubble */}
                      <div className={`group relative max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                        {editingMsgId === msg.id ? (
                          <div className="w-full">
                            <textarea
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              className="w-full border border-[#8E288D] rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#8E288D] resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-1">
                              <button onClick={() => {
                                  setChatMessages(msgs => msgs.map(m =>
                                    m.id === msg.id ? { ...m, content: editingContent } : m
                                  ))
                                  setEditingMsgId(null)
                                }}
                                className="text-xs bg-[#8E288D] text-white px-2 py-0.5 rounded">Save</button>
                              <button onClick={() => setEditingMsgId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                            msg.role === 'user'
                              ? 'bg-[#8E288D] text-white rounded-tr-sm'
                              : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                          }`}>
                            {msg.role === 'assistant'
                              ? <div className="prose prose-xs max-w-none">{parseMarkdown(msg.content)}</div>
                              : msg.content
                            }
                          </div>
                        )}

                        {/* Action buttons */}
                        {editingMsgId !== msg.id && (
                          <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                            msg.role === 'user' ? 'flex-row-reverse' : ''
                          }`}>
                            {msg.role === 'user' && (
                              <button onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content) }}
                                className="text-xs text-gray-400 hover:text-[#8E288D] flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-purple-50">
                                <FiEdit2 className="h-3 w-3" /> Edit
                              </button>
                            )}
                            {msg.role === 'user' && (
                              <button onClick={() => sendChatMessage(msg.content, msg.id)}
                                title="Regenerate response"
                                className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-green-50">
                                <FiRefreshCw className="h-3 w-3" /> Retry
                              </button>
                            )}
                            <button onClick={() => setChatMessages(msgs => msgs.filter(m => m.id !== msg.id))}
                              className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-red-50">
                              <FiTrash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#CFB53B] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">AI</div>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                        <div className="flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-200 bg-white px-3 py-2">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={chatQuery}
                      onChange={e => setChatQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (!loading && chatQuery.trim()) handleChatQuery()
                        }
                      }}
                      rows={2}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-700 focus:border-[#8E288D] focus:outline-none focus:ring-1 focus:ring-[#8E288D] resize-none"
                      placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for newline)"
                    />
                    <button
                      onClick={handleChatQuery}
                      disabled={loading || !chatQuery.trim()}
                      className="flex-shrink-0 bg-[#8E288D] text-white rounded-xl px-3 py-2 hover:bg-[#7A1E79] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 text-xs font-medium"
                    >
                      {loading
                        ? <FiLoader className="animate-spin h-3.5 w-3.5" />
                        : <FiSend className="h-3.5 w-3.5" />
                      }
                      Send
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Shift+Enter for new line · context from last 10 messages is included</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-white flex justify-between items-center">
          <div className="flex gap-2">
            {/* <button
              onClick={() => setShowReportOptions(!showReportOptions)}
              disabled={Object.keys(analysisResults).length === 0 || loading}
              className="bg-gradient-to-r from-[#8E288D] to-[#CFB53B] hover:from-[#CFB53B] hover:to-[#8E288D] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex 
              items-center gap-2 transition "
            >
              <FiDownload /> Download Report
            </button> */}

            <button
              onClick={() => setShowReportOptions(!showReportOptions)}
              disabled={Object.keys(analysisResults).length === 0 || loading}
              className="
              flex items-center gap-2
              py-2 px-4 rounded-lg font-medium text-white
              bg-gradient-to-r from-[#8E288D] to-[#CFB53B]
              hover:from-[#CFB53B] hover:to-[#8E288D]
              disabled:from-gray-400
              disabled:to-gray-400
              disabled:cursor-not-allowed
              disabled:hover:from-gray-400
              disabled:hover:to-gray-400
              transition
              "
              >
              <FiDownload />
              Download Report
            </button>
            {showReportOptions && (
              <div className="absolute bottom-20 left-6 bg-white border border-gray-300 rounded-lg shadow-lg p-3 flex gap-2 z-10">
                {reportFormats.map(format => (
                  <button
                    key={format.id}
                    onClick={() => handleGenerateReport(format.id)}
                    disabled={loading}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition"
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIAnalysisModal
