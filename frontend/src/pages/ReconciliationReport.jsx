import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  FiArrowLeft, FiDatabase, FiCheckCircle, FiXCircle,FiAlertTriangle,FiClock,FiTarget,FiCpu,FiCopy,FiRepeat,
  FiAlertCircle, FiLoader, FiPercent, FiLayers, FiMapPin, FiBarChart2
} from 'react-icons/fi'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n) => n == null ? '—' : Number(n).toLocaleString()
const pct  = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`

const APPROVAL_COLORS = {
  reconciled:               '#8E288D',
  unreconciled:             '#ef4444',
  surplus_assets:           '#f97316',
  exist_in_erp_not_physical:'#8b5cf6',
  pending:                  '#9ca3af',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  sub,
  textColor = "text-white",
  shadow = "shadow-lg",
  borderColor = "",
  icon: Icon,
  gradient,
}) => (
  <div
    className={`rounded-xl p-5 ${gradient} ${textColor} ${shadow} ${borderColor}
    transform hover:scale-105 transition-all duration-300`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      </div>

      {Icon && (
        <div className="bg-white/20 p-2 rounded-lg">
          <Icon className="h-6 w-6" />
        </div>
      )}
    </div>
  </div>
);

// ── Horizontal bar ────────────────────────────────────────────────────────────
const HBar = ({ name, rate, reconciled, total, color }) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm font-medium text-gray-700 truncate max-w-[55%]" title={name}>{name}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {rate}%
        <span className="text-xs text-gray-400 font-normal ml-1">({fmt(reconciled)}/{fmt(total)})</span>
      </span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className="h-3 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }} />
    </div>
  </div>
)

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="text-xs">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
const ReconciliationReport = () => {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    axios.get(`/api/reconciliation/analytics/single/${id}`)
      .then(r => setData(r.data))
      .catch(() => { toast.error('Failed to load report'); navigate('/') })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <FiLoader className="animate-spin h-12 w-12 text-[#8E288D]" />
    </div>
  )
  if (!data) return null

  const { kpis, donut, category_breakdown, department_breakdown,
          district_breakdown, dept_rec_chart, reconciliation, total_records_in_db } = data

  const recon       = reconciliation
  const completedAt = recon.completed_at ? new Date(recon.completed_at).toLocaleString() : '—'
  const createdAt   = new Date(recon.created_at).toLocaleString()

  const tabs = [
    { key: 'overview',   label: 'Overview'    },
    { key: 'category',   label: 'By Category' },
    { key: 'department', label: 'By Division' },
    { key: 'district',   label: 'By Branch'   },
    { key: 'dept_rec',   label: 'Dept. Reconcile' },
  ]

  // stacked bar data for category
  const stackedCatData = category_breakdown.map(c => ({
    name:         c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
    fullName:     c.name,
    Reconciled:   c.reconciled,
    Unreconciled: c.unreconciled,
    Pending:      c.pending,
    Surplus:      c.surplus || 0,
  }))

  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-12">
      {/* Back */}
      <div className="mb-4">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <FiArrowLeft className="mr-2" /> Back
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-4">
        <div className='flex'>
          <h1 className="text-2xl font-bold text-gray-900">
            Reconciliation <span className="text-[#8E288D]">#{id}</span>
          </h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
            {/* <span>📁 {recon.customer_file}</span>
            <span>📁 {recon.internal_file}</span> */}
            <span>🕒 Created: {createdAt}</span>
            {recon.completed_at && <span>✅ Completed: {completedAt}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/results/${id}`)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#8E288D] text-white hover:bg-[#7A1E79]">
            View Records
          </button>
          <button onClick={() => navigate(`/approval/${id}`)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#CFB53B] text-white hover:bg-[#CFB53C]">
            Approval
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="ERP Assets"         value={fmt(kpis.total_erp_assets)}  icon={FiDatabase}    
        gradient="bg-gradient-to-br from-white-500 to-white-600"
         borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        <KpiCard label="Physical Count"     value={fmt(kpis.physical_count)}    icon={FiLayers}      
        gradient="bg-gradient-to-br from-white-500 to-white-600" 
        borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-black-500" />
        
          
        <KpiCard label="Exact Match"         value={fmt(kpis.exact_matched)}  icon={FiTarget}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" 
        textColor="text-black-500" />
        <KpiCard label="AI Match"         value={fmt(kpis.ai_matched)}  icon={FiCpu}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" 
        textColor="text-black-500" />
         <KpiCard label="Near Match"         value={fmt(kpis.near_match)}  icon={FiCopy}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" 
        textColor="text-black-500" />
        <KpiCard label="Reconciled(Appro.)"         value={fmt(kpis.reconciled)}        icon={FiCheckCircle} 
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]"
        borderColor="border-l-4 border-l-gray-100"
        gradient="bg-gradient-to-br from-white-500 to-white-600" textColor="text-black-500" />   
      </div>

      {/* secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Recon. Rate"        value={pct(kpis.reconciliation_rate)} icon={FiPercent}   
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"
        gradient="bg-gradient-to-br from-white-500 to-white-600" textColor="text-black-500"/>
       
        <KpiCard label="Pending"         value={fmt(kpis.pending)}  icon={FiClock}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" 
        textColor="text-black-500" />
        <KpiCard label="Unreconciled"       value={fmt(kpis.unreconciled)}      icon={FiXCircle}  
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"  
        gradient="bg-gradient-to-br from-white-500 to-white-600" textColor='text-pink-700'/>
        <KpiCard label="Shortage Assets"         value={fmt(kpis.exist_erp_not_physical)}  icon={FiAlertTriangle}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" textColor="text-[#F87171]" />
        <KpiCard label="Surplus Assets"     value={fmt(kpis.surplus_assets)}    icon={FiAlertCircle} 
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" borderColor="border-l-4 border-l-gray-100"
        gradient="bg-gradient-to-br from-white-500 to-white-600" textColor='text-orange-600'/>
        <KpiCard label="Duplicates"         value={fmt(kpis.customer_duplicates)}  icon={FiRepeat}    
        gradient="bg-gradient-to-br from-white-500 to-white-600" borderColor="border-l-4 border-l-gray-100"
        shadow="shadow-[0_4px_15px_rgba(107,114,128,0.4)]" 
        textColor="text-pink-500" />
        {/* {[
          { label: 'Shortage Assets',   value: kpis.exist_erp_not_physical,                              border: 'border-purple-400', text: 'text-purple-600' },
          { label: 'Pending Approval',   value: kpis.pending,                                              border: 'border-gray-400',   text: 'text-gray-600'   },
          { label: 'Exact Match',        value: kpis.exact_matched,                                        border: 'border-teal-400',   text: 'text-teal-600'   },
          { label: 'AI Match',           value: kpis.ai_matched,                                           border: 'border-[#8E288D]',  text: 'text-[#8E288D]'  },
          { label: 'Near Match',         value: kpis.near_match,                                           border: 'border-blue-400',   text: 'text-blue-600'   },
          { label: 'Total Duplicates',   value: (kpis.customer_duplicates||0)+(kpis.internal_duplicates||0), border: 'border-pink-400', text: 'text-pink-600'   },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-lg shadow p-3 border-l-4 ${k.border}`}>
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{fmt(k.value)}</p>
          </div>
        ))} */}
      </div>

      {/* Pending notice */}
      {kpis.pending > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <FiAlertCircle className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{fmt(kpis.pending)}</strong> records are still <strong>pending approval</strong>.
            The charts below reflect current approved data. Approve remaining records to see full results.
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-[#8E288D] text-white shadow'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-[#8E288D]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Approval Status Donut */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Approval Status Breakdown</h3>
            {donut.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={donut} cx="50%" cy="50%"
                    innerRadius={65} outerRadius={110}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.03 ? `${(percent*100).toFixed(0)}%` : ''
                    }
                    labelLine={false}>
                    {donut.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 text-center py-12">No approval data yet</p>
            )}
          </div>

          {/* Match type progress */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Match Type Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: 'Exact Match',          value: kpis.exact_matched,                                           color: '#8E288D' },
                { label: 'AI Match',             value: kpis.ai_matched,                                              color: '#7A1E79' },
                { label: 'Near Match',           value: kpis.near_match,                                              color: '#CFB53B' },
                { label: 'Unmatched',            value: kpis.customer_unmatched,                                      color: '#ef4444' },
                { label: 'Physical Duplicates',     value: kpis.customer_duplicates || 0,                                color: '#ec4899' },
                { label: 'ERP Duplicates',   value: kpis.internal_duplicates || 0,                                color: '#f97316' },
              ].map(item => {
                const total = kpis.physical_count || 1
                const r = ((item.value / total) * 100).toFixed(1)
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>
                        {fmt(item.value)} ({r}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all duration-500"
                        style={{ width: `${r}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total records in DB including Duplicats</span>
                <span className="text-xl font-bold text-[#8E288D]">{fmt(total_records_in_db)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[gray-600]">Reconciliation Rate</span>
                <span className="text-lg font-bold text-[#8E288D]">{pct(kpis.reconciliation_rate)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── By Category ──────────────────────────────────────────────────── */}
      {activeTab === 'category' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <FiLayers className="text-[#8E288D]" /> Reconciliation by Asset Category
          </h3>
          {category_breakdown.length ? (
            <>
              <div className="mb-6">
                {category_breakdown.map(c => (
                  <HBar key={c.name} name={c.name} rate={c.rate}
                    reconciled={c.reconciled} total={c.total} color="#8E288D" />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stackedCatData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30}
                    textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Reconciled"   stackId="a" fill="#8E288D" />
                  <Bar dataKey="Unreconciled" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Surplus"      stackId="a" fill="#f97316" />
                  <Bar dataKey="Pending"      stackId="a" fill="#9ca3af" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-12">No category data — approve records first</p>}
        </div>
      )}

      {/* ── By Division/Department ────────────────────────────────────────── */}
      {activeTab === 'department' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <FiBarChart2 className="text-[#8E288D]" /> Reconciliation by Division / Department
          </h3>
          {department_breakdown.length ? (
            <>
              <div className="mb-6">
                {department_breakdown.map(d => (
                  <HBar key={d.name} name={d.name} rate={d.rate}
                    reconciled={d.reconciled} total={d.total} color="#8E288D" />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={department_breakdown.map(d => ({
                    ...d,
                    name: d.name.length > 15 ? d.name.slice(0,15)+'…' : d.name
                  }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35}
                    textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="reconciled"   name="Reconciled"   fill="#8E288D" stackId="a" />
                  <Bar dataKey="unreconciled" name="Unreconciled" fill="#ef4444" stackId="a" />
                  <Bar dataKey="pending"      name="Pending"      fill="#9ca3af" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-12">No department data — approve records first</p>}
        </div>
      )}

      {/* ── By District/Branch ───────────────────────────────────────────── */}
      {activeTab === 'district' && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <FiMapPin className="text-[#8E288D]" /> Reconciliation by Branch / District
          </h3>
          {district_breakdown.length ? (
            <>
              <div className="mb-6">
                {district_breakdown.map(d => (
                  <HBar key={d.name} name={d.name} rate={d.rate}
                    reconciled={d.reconciled} total={d.total} color="#8E288D" />
                ))}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={district_breakdown.map(d => ({
                    ...d,
                    name: d.name.length > 12 ? d.name.slice(0,12)+'…' : d.name
                  }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35}
                    textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="reconciled"   name="Reconciled"   fill="#8E288D" stackId="a" />
                  <Bar dataKey="unreconciled" name="Unreconciled" fill="#ef4444" stackId="a" />
                  <Bar dataKey="pending"      name="Pending"      fill="#9ca3af" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="text-gray-400 text-center py-12">No district/branch data — approve records first</p>}
        </div>
      )}

      {/* ── Dept. Reconcile ───────────────────────────────────────────────── */}
      {activeTab === 'dept_rec' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Department Reconciliation Summary</h3>
            {dept_rec_chart.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dept_rec_chart} cx="50%" cy="50%"
                    outerRadius={110} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.03 ? `${(percent*100).toFixed(0)}%` : ''
                    }
                    labelLine={false}>
                    {dept_rec_chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-12">No data</p>}
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Department Match Detail</h3>
            <div className="space-y-3">
              {dept_rec_chart.map(item => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <span className="text-sm font-bold" style={{ color: item.color }}>
                      {fmt(item.value)}
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        ({total_records_in_db > 0
                          ? ((item.value / total_records_in_db) * 100).toFixed(1)
                          : 0}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-700"
                      style={{
                        width: total_records_in_db > 0
                          ? `${(item.value / total_records_in_db) * 100}%` : '0%',
                        backgroundColor: item.color
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReconciliationReport
