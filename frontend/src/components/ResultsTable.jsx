import { useState, useMemo } from 'react';
import ResultsCard from './ResultsCard';
import FiltersSheet from './FiltersSheet';
import DetailPanel from './DetailPanel';

export default function ResultsTable({ results, jobId, onNewScan }) {
  const [filterTrend, setFilterTrend] = useState(false);
  const [filterVCP, setFilterVCP] = useState(false);
  const [filterSector, setFilterSector] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);
  const [expandedMobileCard, setExpandedMobileCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState('rs_rating');
  const [sortDir, setSortDir] = useState('desc');

  const sectors = useMemo(() => {
    const s = new Set(); 
    results.forEach(r => r.sector && s.add(r.sector)); 
    return [...s].sort();
  }, [results]);

  const filtered = useMemo(() => {
    let f = [...results];
    if (filterTrend) f = f.filter(r => r.trend_template_pass);
    if (filterVCP) f = f.filter(r => r.vcp_detected);
    if (filterSector) f = f.filter(r => r.sector === filterSector);
    f.sort((a, b) => {
      const aVal = a[sortKey] ?? '', bVal = b[sortKey] ?? '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return f;
  }, [results, filterTrend, filterVCP, filterSector, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = ['ticker','price','rs_rating','trend_template_pass','vcp_detected','num_contractions','pivot_price','distance_from_pivot_pct','pocket_pivot'];
    const rows = filtered.map(r => headers.map(h => r[h]).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sepa_scan_${jobId}.csv`; a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sepa_scan_${jobId}.json`; a.click();
  };

  // Try native share on mobile
  const handleExport = async () => {
    if (navigator.share) {
      try {
        const csv = ['ticker,price,rs_rating,trend_template_pass,vcp_detected',
          ...filtered.map(r => [r.ticker,r.price,r.rs_rating,r.trend_template_pass,r.vcp_detected].join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const file = new File([blob], `sepa_scan_${jobId}.csv`, { type: 'text/csv' });
        await navigator.share({ files: [file], title: 'SEPA Scan Results' });
        return;
      } catch (e) {}
    }
    // Fallback
    exportCSV();
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="text-gray-600 ml-1">⇅</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const getGrade = (r) => {
    let score = 0;
    if (r.trend_template_pass) score += 30;
    if (r.vcp_detected) score += 30;
    if (Math.abs(r.distance_from_pivot_pct || 100) < 5) score += 20;
    else if (Math.abs(r.distance_from_pivot_pct || 100) < 10) score += 10;
    if (r.volume_dryup_score > 0.6) score += 10;
    else if (r.volume_dryup_score > 0.3) score += 5;
    if (r.rs_rating > 85) score += 10;
    else if (r.rs_rating > 70) score += 5;
    return score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  };

  const activeFilterCount = (filterTrend ? 1 : 0) + (filterVCP ? 1 : 0) + (filterSector ? 1 : 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base sm:text-lg font-semibold">
          Results: <span className="text-blue-400">{filtered.length}</span> of {results.length}
        </h2>
        <div className="flex gap-1.5 sm:gap-2">
          {/* Mobile: single Filter button */}
          <button
            onClick={() => setShowFilters(true)}
            className="md:hidden px-3 py-2 bg-gray-700 rounded-lg text-xs hover:bg-gray-600 min-h-[36px] flex items-center gap-1"
          >
            Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
          {/* Mobile: single Export button */}
          <button
            onClick={handleExport}
            className="md:hidden px-3 py-2 bg-gray-700 rounded-lg text-xs hover:bg-gray-600 min-h-[36px]"
          >
            Export
          </button>
          {/* Desktop: separate buttons */}
          <button onClick={exportCSV} className="hidden md:block px-3 py-1.5 bg-gray-700 rounded text-xs hover:bg-gray-600 min-h-[36px]">CSV</button>
          <button onClick={exportJSON} className="hidden md:block px-3 py-1.5 bg-gray-700 rounded text-xs hover:bg-gray-600 min-h-[36px]">JSON</button>
          <button onClick={onNewScan} className="px-3 py-1.5 sm:py-2 bg-blue-600 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 min-h-[36px] sm:min-h-[44px]">New Scan</button>
        </div>
      </div>

      {/* Desktop filters — hidden on mobile */}
      <div className="hidden md:flex gap-3 flex-wrap items-center">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={filterTrend} onChange={e => setFilterTrend(e.target.checked)} className="rounded" />
          Trend passers
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={filterVCP} onChange={e => setFilterVCP(e.target.checked)} className="rounded" />
          VCP only
        </label>
        {sectors.length > 0 && (
          <select
            value={filterSector}
            onChange={e => setFilterSector(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
          >
            <option value="">All Sectors</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-2">
        {filtered.map(r => (
          <ResultsCard
            key={r.ticker}
            result={r}
            jobId={jobId}
            isExpanded={expandedMobileCard === r.ticker}
            onToggle={() => setExpandedMobileCard(expandedMobileCard === r.ticker ? null : r.ticker)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-3xl mb-2">🔍</div>
            <div>No results match filters</div>
            <button onClick={() => { setFilterTrend(false); setFilterVCP(false); setFilterSector(''); }} className="text-blue-400 text-sm mt-2 underline">Clear filters</button>
          </div>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="p-2 text-center w-10">#</th>
              <th onClick={() => handleSort('ticker')} className="p-2 text-left cursor-pointer hover:text-white">Ticker<SortIcon col="ticker" /></th>
              <th onClick={() => handleSort('price')} className="p-2 text-right cursor-pointer hover:text-white">Price<SortIcon col="price" /></th>
              <th onClick={() => handleSort('rs_rating')} className="p-2 text-right cursor-pointer hover:text-white">RS<SortIcon col="rs_rating" /></th>
              <th className="p-2 text-center">Trend</th>
              <th className="p-2 text-center">VCP</th>
              <th onClick={() => handleSort('num_contractions')} className="p-2 text-center cursor-pointer hover:text-white">Cont.<SortIcon col="num_contractions" /></th>
              <th onClick={() => handleSort('distance_from_pivot_pct')} className="p-2 text-right cursor-pointer hover:text-white">Dist%<SortIcon col="distance_from_pivot_pct" /></th>
              <th className="p-2 text-center">PP</th>
              <th className="p-2 text-center w-12">Grade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const grade = getGrade(r);
              const gradeBg = grade === 'A' ? 'bg-green-900/30' : grade === 'B' ? 'bg-blue-900/30' : grade === 'C' ? 'bg-yellow-900/30' : 'bg-red-900/30';
              const gradeText = grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : grade === 'C' ? 'text-yellow-400' : 'text-red-400';
              const isSelected = selectedResult?.ticker === r.ticker;
              return (
                <tr key={r.ticker} onClick={() => setSelectedResult(isSelected ? null : r)}
                  className={`border-b border-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-gray-800'}`}>
                  <td className="p-2 text-center text-gray-500 text-xs">{idx + 1}</td>
                  <td className="p-2"><span className="font-mono text-blue-400 font-semibold">{r.ticker}</span><div className="text-gray-500 text-xs">{r.name}</div></td>
                  <td className="p-2 text-right font-mono">{r.price?.toFixed(2)}</td>
                  <td className="p-2 text-right font-mono font-semibold text-blue-400">{r.rs_rating?.toFixed(1)}</td>
                  <td className="p-2 text-center">{r.trend_template_pass ? '✅' : '❌'}</td>
                  <td className="p-2 text-center">{r.vcp_detected ? '✅' : '—'}</td>
                  <td className="p-2 text-center font-mono">{r.num_contractions || '—'}</td>
                  <td className={`p-2 text-right font-mono font-semibold ${(r.distance_from_pivot_pct||0) < 0 ? 'text-green-400' : (r.distance_from_pivot_pct||0) < 5 ? 'text-yellow-400' : 'text-red-400'}`}>{r.distance_from_pivot_pct != null ? `${r.distance_from_pivot_pct.toFixed(1)}%` : '—'}</td>
                  <td className="p-2 text-center">{r.pocket_pivot ? '🔥' : '—'}</td>
                  <td className="p-2 text-center"><span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${gradeBg} ${gradeText}`}>{grade}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-gray-500 py-8">No results match filters</div>}
      </div>

      {/* Detail Panel (desktop only) */}
      {selectedResult && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 hidden md:block" onClick={() => setSelectedResult(null)} />
          <DetailPanel result={selectedResult} jobId={jobId} onClose={() => setSelectedResult(null)} />
        </>
      )}

      {/* Mobile Filters Sheet */}
      <FiltersSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filterTrend={filterTrend}
        setFilterTrend={setFilterTrend}
        filterVCP={filterVCP}
        setFilterVCP={setFilterVCP}
        filterSector={filterSector}
        setFilterSector={setFilterSector}
        sectors={sectors}
        sortKey={sortKey}
        setSortKey={setSortKey}
      />
    </div>
  );
}
