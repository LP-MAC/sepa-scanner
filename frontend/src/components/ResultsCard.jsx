import { useState } from 'react';

function TrendCondition({ label, pass }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
      pass ? 'bg-green-900/30 text-green-300 border border-green-800/50' : 'bg-red-900/20 text-red-300 border border-red-800/50'
    }`}>
      <span>{pass ? '✓' : '✗'} {label}</span>
    </div>
  );
}

export default function ResultsCard({ result, jobId, isExpanded, onToggle }) {
  // Calculate grade for badge
  let score = 0;
  if (result.trend_template_pass) score += 30;
  if (result.vcp_detected) score += 30;
  const dist = Math.abs(result.distance_from_pivot_pct || 100);
  if (result.vcp_detected && dist < 5) score += 20;
  else if (result.vcp_detected && dist < 10) score += 10;
  if (result.volume_dryup_score > 0.6) score += 10;
  else if (result.volume_dryup_score > 0.3) score += 5;
  if (result.rs_rating > 85) score += 10;
  else if (result.rs_rating > 70) score += 5;
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  const gradeColor = grade === 'A' ? 'bg-green-600' : grade === 'B' ? 'bg-blue-600' : grade === 'C' ? 'bg-yellow-600' : 'bg-red-600';

  // Parse contractions
  let contractions = [];
  try { contractions = JSON.parse(result.contractions_pct || '[]'); } catch(e) {}

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden transition-all">
      {/* Collapsed card — tappable to expand */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 min-h-[88px] active:bg-gray-750 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${result.ticker} — ${result.trend_template_pass ? 'Trend pass' : 'Trend fail'}, ${result.vcp_detected ? 'VCP detected' : 'No VCP'}`}
      >
        {/* Row 1: Ticker + Grade + RS */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-base font-bold text-blue-400">{result.ticker}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold text-white ${gradeColor}`}>
              {grade}
            </span>
          </div>
          <span className="text-lg font-bold font-mono text-white flex-shrink-0">
            {result.rs_rating?.toFixed(0)}
            <span className="text-xs text-gray-400 font-normal"> RS</span>
          </span>
        </div>

        {/* Row 2: Company name */}
        {result.name && (
          <div className="text-xs text-gray-400 truncate mb-2">{result.name}</div>
        )}

        {/* Row 3: Status pills — only show positive ones */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {result.trend_template_pass && (
            <span className="px-2 py-0.5 bg-green-900/40 text-green-300 text-xs rounded-full border border-green-700/50">Trend ✓</span>
          )}
          {result.vcp_detected && (
            <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded-full border border-blue-700/50">
              VCP {result.num_contractions}ct
            </span>
          )}
          {result.pocket_pivot && (
            <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 text-xs rounded-full border border-purple-700/50">🔥 PP</span>
          )}
          {!result.trend_template_pass && !result.vcp_detected && !result.pocket_pivot && (
            <span className="text-xs text-gray-500">No signals</span>
          )}
        </div>

        {/* Row 4: Key numbers */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-500">Price</div>
            <div className="text-sm font-mono font-medium text-white">${result.price?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Pivot</div>
            <div className="text-sm font-mono font-medium text-white">
              {result.pivot_price ? `$${result.pivot_price.toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">From Pivot</div>
            <div className={`text-sm font-mono font-bold ${
              (result.distance_from_pivot_pct || 0) < 0 ? 'text-green-400' : 
              (result.distance_from_pivot_pct || 0) < 5 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {result.distance_from_pivot_pct != null ? `${result.distance_from_pivot_pct.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Expand hint */}
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500">{isExpanded ? '▲ Tap to collapse' : '▼ Tap for details'}</span>
        </div>
      </button>

      {/* Expanded detail section */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4 bg-gray-850">
          {/* Sector & Info */}
          {(result.sector || result.name) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {result.sector && (
                <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">{result.sector}</span>
              )}
            </div>
          )}

          {/* Trend Template conditions */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
              Trend Template {result.trend_template_pass ? '✅ Pass' : '❌ Fail'}
            </h4>
            <div className="grid grid-cols-1 gap-1">
              <TrendCondition label="1. Price > 150 & 200 SMA" pass={result.cond1_price_above_150_200} />
              <TrendCondition label="2. 150 SMA > 200 SMA" pass={result.cond2_150_above_200} />
              <TrendCondition label="3. 200 SMA trending up" pass={result.cond3_200_trending_up} />
              <TrendCondition label="4. 50 SMA > 150 & 200" pass={result.cond4_50_above_150_200} />
              <TrendCondition label="5. Price > 50 SMA" pass={result.cond5_price_above_50} />
              <TrendCondition label="6. ≥30% above 52w low" pass={result.cond6_above_52w_low_30pct} />
              <TrendCondition label="7. Within 25% of 52w high" pass={result.cond7_within_25pct_52w_high} />
              <TrendCondition label="8. RS Rating ≥ 70" pass={result.cond8_rs_above_threshold} />
            </div>
          </div>

          {/* VCP details */}
          {result.vcp_detected && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                VCP — {result.num_contractions} Contractions
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {contractions.map((pct, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs font-mono text-white">
                    {pct.toFixed(1)}%
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-700/50 rounded p-2">
                  <span className="text-gray-400">Vol Dry-Up: </span>
                  <span className="font-mono text-white">{((result.volume_dryup_score || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <span className="text-gray-400">Final: </span>
                  <span className="font-mono text-white">{result.is_final_contraction_ideal ? 'Ideal <8%' : 'OK'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pocket Pivot */}
          {result.pocket_pivot && (
            <div className="bg-purple-900/30 border border-purple-800/50 rounded-lg p-3 text-sm text-purple-200">
              🔥 Pocket Pivot detected — institutional accumulation signal
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2 text-xs">
            <a
              href={`https://www.tradingview.com/chart/?symbol=NYSE:${result.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 bg-blue-900/40 text-blue-300 rounded-lg hover:bg-blue-800/40 active:bg-blue-800 min-h-[44px] flex items-center justify-center"
            >
              📈 TradingView
            </a>
            <a
              href={`https://finance.yahoo.com/quote/${result.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 bg-purple-900/40 text-purple-300 rounded-lg hover:bg-purple-800/40 active:bg-purple-800 min-h-[44px] flex items-center justify-center"
            >
              📊 Yahoo Finance
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
