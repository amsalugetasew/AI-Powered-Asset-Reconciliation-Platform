import React from 'react'

export const DonutCenterLabel = ({ total }) => (
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
    <span className="text-[22px] font-bold leading-tight text-gray-900">
      {Number(total || 0).toLocaleString()}
    </span>
    <span className="mt-1 text-[10px] font-medium uppercase leading-tight text-gray-500">
      TOTAL RECORDS
    </span>
  </div>
)

export const DonutChartLegend = ({ data, getColor, activeName, onSelect, singleRow = false, className = '' }) => (
  <div className={`${singleRow
    ? 'flex flex-nowrap gap-2 overflow-x-auto'
    : 'grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 xl:grid-cols-5'} border-t border-gray-100 pt-3 ${className}`}>
    {data.map(entry => (
      <button
        key={entry.name}
        type="button"
        aria-pressed={activeName === entry.name}
        title={`${activeName === entry.name ? 'Clear highlight for' : 'Highlight'} ${entry.name}`}
        onClick={() => onSelect(activeName === entry.name ? null : entry.name)}
        className={`flex ${singleRow ? 'min-w-[60px] flex-1' : 'min-w-0'} flex-col items-center justify-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8E288D] ${activeName === entry.name ? 'bg-gray-100 ring-1 ring-gray-200' : ''}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: getColor(entry) }} />
          <span className="text-xs font-bold text-gray-900">
            {Number(entry.value || 0).toLocaleString()}
          </span>
        </span>
        <span className="break-words text-center text-[10px] font-medium uppercase leading-tight text-gray-500">
          {entry.name}
        </span>
      </button>
    ))}
  </div>
)