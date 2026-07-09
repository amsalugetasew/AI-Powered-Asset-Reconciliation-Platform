import React, { useState, useEffect, useRef } from 'react'
import { FiX, FiDownload, FiLoader, FiCheckCircle, FiAlertCircle, FiBarChart2, FiBook, FiMessageCircle } from 'react-icons/fi'
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

  const handleChatQuery = async () => {
    if (!chatQuery.trim()) {
      toast.warning('Enter a chat prompt to continue')
      return
    }

    setIsStaleResults(false)
    setLoading(true)
    try {
      const response = await axios.post('/api/analysis/chat', {
        reconciliation_id: reconciliationId,
        chart_data: safeJsonClone(chartData),
        chart_type: chartType,
        prompt: chatQuery,
        context: safeJsonClone({ ...analysisContext, target: targetLabel })
      })

      if (response.data.success) {
        setChatOutput(response.data.content || response.data.answer || '')
        setActiveTab('chat')
        toast.success('Chat response generated')
      } else {
        const errorMsg = response.data.error || 'Failed to process chat query'
        toast.error(errorMsg)
        console.error('Chat error:', response.data)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to process chat query'
      toast.error(errorMsg)
      console.error('Chat error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

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
        <div className="bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] p-3 flex justify-between items-center">
          <div className='flex'>
            <h2 className="text-2xl font-bold flex items-center gap-2 mr-3">
              <FiBarChart2 /> AI Analysis & Insights
            </h2>
            <p className="text-purple-100 text-sm mt-2.5 mr-3">{title}</p>
            {targetLabel && (
              <p className="text-purple-200 text-xs mt-3">Target: {targetLabel}</p>
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
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Analysis
                </button>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'recommendations'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Recommendations
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'insights'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Insights
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeTab === 'chat'
                      ? 'border-purple-600 text-purple-600'
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
              {/* Analysis Type Selection */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Select Analysis Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {analysisTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setAnalysisType(type.id)}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        analysisType === type.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <span className="text-xl">{type.icon}</span>
                      <p className="font-medium text-sm mt-1">{type.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Format Selection */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Output Format</h3>
                <div className="grid grid-cols-3 gap-3">
                  {outputFormats.map(format => (
                    <button
                      key={format.id}
                      onClick={() => setOutputFormat(format.id)}
                      className={`p-3 rounded-lg border-2 text-center transition ${
                        outputFormat === format.id
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{format.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{format.desc}</p>
                    </button>
                  ))}
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
                      <div key={type} className="border-l-4 border-purple-500 pl-4 py-2">
                        <p className="font-medium text-sm text-purple-600 mb-2">
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
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <FiMessageCircle className="text-teal-600" /> Chat with AI
                </h3>
                <textarea
                  value={chatQuery}
                  onChange={e => setChatQuery(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 focus:border-purple-500 focus:outline-none"
                  placeholder="Ask a question about this chart, reconciliation, or insights..."
                />
                <button
                  onClick={handleChatQuery}
                  disabled={loading}
                  className="mt-3 w-full bg-gradient-to-r from-[#8E288D] to-[#CFB53B] text-white rounded-lg hover:from-[#CFB53B] hover:to-[#8E288D] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  {loading ? (
                    <>
                      <FiLoader className="animate-spin" /> Sending...
                    </>
                  ) : (
                    'Submit Chat Query'
                  )}
                </button>
              </div>
              {chatOutput && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-3">Chat Response</h3>
                  <div className="text-sm text-gray-700 space-y-2">
                    {parseMarkdown(chatOutput)}
                  </div>
                </div>
              )}
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
