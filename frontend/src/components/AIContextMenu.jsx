import React, { useEffect, useRef, useState } from 'react'

const ANALYSIS_SUBMENU = [
  { id: 'summary', label: 'Summary & Observations' },
  { id: 'trend', label: 'Trend Analysis' },
  { id: 'comparative', label: 'Comparative Analysis' },
  { id: 'anomaly', label: 'Anomaly Detection' }
]

const OUTPUT_SUBMENU = [
  { id: 'combined', label: 'Chart + Analysis' },
  { id: 'bullets', label: 'Key Points' },
  { id: 'text', label: 'Analysis Only' }
]

const AIContextMenu = ({ isOpen, x, y, onClose, onSelect }) => {
  const ref = useRef(null)
  const [showAnalysisSubmenu, setShowAnalysisSubmenu] = useState(false)
  const [showOutputSubmenu, setShowOutputSubmenu] = useState(false)
  const [selectedOutputFormat, setSelectedOutputFormat] = useState('combined')
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [flip, setFlip] = useState({ horizontal: false, vertical: false })

  useEffect(() => {
    if (!isOpen) return

    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Positioning: place near (x,y) but flip when it would overflow viewport
  useEffect(() => {
    if (!isOpen) return
    const updatePosition = () => {
      const baseLeft = (typeof x === 'number' ? x : 0) + 8
      const baseTop = (typeof y === 'number' ? y : 0) + 8
      setPos({ left: baseLeft, top: baseTop })

      // measure after render
      requestAnimationFrame(() => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const winW = window.innerWidth
        const winH = window.innerHeight
        let newLeft = baseLeft
        let newTop = baseTop
        let horizontalFlip = false
        let verticalFlip = false

        if (rect.right > winW) {
          horizontalFlip = true
          newLeft = Math.max(8, (typeof x === 'number' ? x : 0) - rect.width - 8)
        }
        if (rect.bottom > winH) {
          verticalFlip = true
          newTop = Math.max(8, (typeof y === 'number' ? y : 0) - rect.height - 8)
        }

        setPos({ left: newLeft, top: newTop })
        setFlip({ horizontal: horizontalFlip, vertical: verticalFlip })
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [isOpen, x, y])

  if (!isOpen) return null

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-2xl"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="px-3 py-2 border-b border-gray-100 text-sm font-semibold text-gray-700">
        AI Actions
      </div>

      <button
        className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => { onSelect({ action: 'modal' }); onClose() }}
      >
        Modal format
      </button>

      <button
        className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => { onSelect({ action: 'recommendations' }); onClose() }}
      >
        Recommendations
      </button>

      <button
        className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => { onSelect({ action: 'insights' }); onClose() }}
      >
        Insights
      </button>

      <div className="relative">
        <button
          className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
          onClick={() => setShowAnalysisSubmenu(prev => !prev)}
        >
          <span>Analysis</span>
          <span className="text-gray-400">▸</span>
        </button>
        {showAnalysisSubmenu && (
          <div className={`absolute ${flip.horizontal ? 'right-full' : 'left-full'} top-0 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-2xl`}>
            <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
              Analysis Type
            </div>
            {ANALYSIS_SUBMENU.map(type => (
              <button
                key={type.id}
                className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  onSelect({ action: 'analysis', analysisType: type.id, outputFormat: selectedOutputFormat })
                  onClose()
                }}
              >
                {type.label}
              </button>
            ))}
            <button
              className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              onClick={() => setShowOutputSubmenu(prev => !prev)}
            >
              <span>Output Format</span>
              <span className="text-gray-400">▸</span>
            </button>
            {showOutputSubmenu && (
              <div className={`absolute ${flip.horizontal ? 'right-full' : 'left-full'} top-0 min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-2xl`}>
                <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                  Output Format
                </div>
                {OUTPUT_SUBMENU.map(format => (
                  <button
                    key={format.id}
                    className={`w-full text-left px-3 py-3 text-sm ${selectedOutputFormat === format.id ? 'text-purple-700 bg-purple-50' : 'text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setSelectedOutputFormat(format.id)}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        className="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50"
        onClick={() => { onSelect({ action: 'chat' }); onClose() }}
      >
        Chat
      </button>
    </div>
  )
}

export default AIContextMenu
