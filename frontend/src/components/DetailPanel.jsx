import { useState, useEffect } from 'react';

function getTradingViewSymbol(ticker) {
  const nyseTickers = ['DELL', 'XOM', 'JPM', 'BAC', 'WMT', 'PG', 'KO', 'MCD', 
    'CAT', 'IBM', 'GE', 'F', 'GM', 'T', 'VZ', 'DIS', 'BA', 'CVX', 
    'WFC', 'C', 'GS', 'MS', 'PFE', 'MRK', 'JNJ', 'ABBV', 'BMY',
    'HD', 'LOW', 'NKE', 'SBUX', 'MMM', 'AXP', 'UNH', 'COST',
    'SLB', 'OXY', 'COP', 'EOG', 'PSX', 'BKR', 'HAL', 'DD',
    'DOW', 'DUK', 'SO', 'NEE', 'RTX', 'LMT', 'NOC', 'GD',
    'BK', 'SCHW', 'BLK', 'MET', 'PRU', 'AIG', 'TRV',
    'GLW', 'HWM', 'DAL', 'UAL', 'AAL', 'CCL', 'RCL',
    'HPQ', 'BBY', 'TGT', 'KR', 'CL', 'KMB', 'PEP',
    'SNDK', 'STX', 'WDC', 'NTAP', 'CIEN', 'JNPR',
    'JBHT', 'CHRW', 'DVA', 'AIZ', 'WST', 'BIIB', 'APA', 'GEV'];
  
  const nasdaqTickers = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 
    'NVDA', 'TSLA', 'AVGO', 'NFLX', 'ADBE', 'CRM', 'INTC', 
    'AMD', 'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC', 'ADI',
    'MU', 'MAR', 'MCHP', 'ON', 'GFS', 'MRVL', 'COHR',
    'CSCO', 'ADP', 'TEAM', 'DDOG', 'CRWD', 'ZS', 'NET',
    'MDB', 'SNOW', 'PLTR', 'UBER', 'LYFT', 'ABNB',
    'LITE', 'VRT', 'SAT', 'SATS', 'SOUN', 'RGTI', 'QBTS'];
  
  const upper = ticker.toUpperCase();
  if (nyseTickers.includes(upper)) return `NYSE:${upper}`;
  if (nasdaqTickers.includes(upper)) return `NASDAQ:${upper}`;
  return `BATS:${upper}`;
}

function TradingViewChart({ ticker }) {
  const [chartError, setChartError] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const symbol = getTradingViewSymbol(ticker);
    const containerId = `tv-chart-${ticker}`;
    
    const existingContainer = document.getElementById(containerId);
    if (existingContainer) existingContainer.innerHTML = '';
    
    // Check if TradingView library is already loaded
    if (window.TradingView) {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      script.onerror = () => setChartError(true);
      document.head.appendChild(script);
    }
    
    function initWidget() {
      try {
        new window.TradingView.widget({
          container_id: containerId,
          symbol: symbol,
          interval: 'D',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1e293b',
          enable_publishing: false,
          hide_top_toolbar: true,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          save_image: false,
          height: 450,
          width: '100%',
          studies: [
            { id: "MASimple@tv-basicstudies", inputs: { length: 50 } },
            { id: "MASimple@tv-basicstudies", inputs: { length: 150 } },
            { id: "MASimple@tv-basicstudies", inputs: { length: 200 } },
            "Volume@tv-basicstudies"
          ],
          timezone: 'America/New_York',
        });
        setLoading(false);
      } catch (e) {
        console.error('TradingView widget error:', e);
        setChartError(true);
      }
    }
    
    return () => {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    };
  }, [ticker]);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {loading && !chartError && (
        <div className="flex items-center justify-center h-[450px] text-gray-500">
          Loading chart...
        </div>
      )}
      <div id={`tv-chart-${ticker}`} style={{ height: '450px' }} />
      {!chartError && (
        <div className="text-xs text-gray-500 px-2 py-1 text-right">
          {getTradingViewSymbol(ticker)} | SMA 50 · 150 · 200 | Volume
        </div>
      )}
      {chartError && (
        <div className="bg-gray-800 rounded p-4 text-center text-gray-400">
          <p>Chart unavailable for {ticker}</p>
          <a 
            href={`https://www.tradingview.com/chart/?symbol=${getTradingViewSymbol(ticker)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline mt-2 inline-block"
          >
            Open in TradingView →
          </a>
        </div>
      )}
    </div>
  );
}

function ConditionBadge({ condition, label }) {
  const bg = condition === true ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700';
  const text = condition === true ? 'text-green-300' : 'text-red-300';
  const icon = condition === true ? '✓' : '✗';
  return (
    <div className={`flex items-center justify-between p-2 rounded text-xs ${bg} ${text}`}>
      <span className="font-medium">{icon} {label}</span>
    </div>
  );
}

function VCPDetails({ result }) {
  if (!result.vcp_detected) {
    return <div className="bg-gray-700 rounded p-3 text-sm text-gray-400">No VCP pattern detected</div>;
  }
  let contractions = [];
  try { contractions = JSON.parse(result.contractions_pct || '[]'); } catch(e) {}
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-blue-400">VCP Pattern — {result.num_contractions} Contractions</h4>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {contractions.map((pct, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="rounded px-2 py-1 font-mono bg-gray-700 text-white" style={{fontSize: `${Math.max(11, 14-i*2)}px`}}>
              {pct.toFixed(1)}%
            </div>
            {i < contractions.length - 1 && <span className="text-gray-500">→</span>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-700 rounded p-2">
          <span className="text-gray-400">Vol Dry-Up: </span>
          <span className={`font-mono ${result.volume_dryup_score > 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
            {(result.volume_dryup_score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="bg-gray-700 rounded p-2">
          <span className="text-gray-400">Final: </span>
          <span className={`font-mono ${result.is_final_contraction_ideal ? 'text-green-400' : 'text-yellow-400'}`}>
            {result.is_final_contraction_ideal ? 'Ideal <8%' : 'OK'}
          </span>
        </div>
        <div className="bg-gray-700 rounded p-2 col-span-2">
          <span className="text-gray-400">Pivot ${result.pivot_price?.toFixed(2)}: </span>
          <span className={`font-bold ${(result.distance_from_pivot_pct||0) < 0 ? 'text-green-400' : 'text-yellow-400'}`}>
            {result.distance_from_pivot_pct?.toFixed(1)}%
            {(result.distance_from_pivot_pct||0) < 0 && ' 🎯 below pivot'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SEPAScore({ result }) {
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
  const gradeColor = grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : grade === 'C' ? 'text-yellow-400' : 'text-red-400';
  const barColor = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-300">SEPA Quality Score</h4>
        <span className={`text-2xl font-bold ${gradeColor}`}>{grade}</span>
      </div>
      <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{width: `${score}%`}} />
      </div>
      <div className="text-xs text-gray-500 text-right">{score}/100</div>
    </div>
  );
}

export default function DetailPanel({ result, jobId, onClose }) {
  if (!result) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[700px] bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto z-50">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold text-white">{result.ticker} <span className="text-gray-400 text-sm font-normal ml-2">{result.name}</span></h2>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            <span>{result.sector}</span><span>·</span>
            <span className="font-mono text-white">${result.price?.toFixed(2)}</span><span>·</span>
            <span>RS: <span className="text-blue-400 font-mono">{result.rs_rating?.toFixed(1)}</span></span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">✕</button>
      </div>
      <div className="p-4 space-y-4">
        <SEPAScore result={result} />
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">
            Minervini Trend Template 
            <span className={`ml-2 text-xs ${result.trend_template_pass ? 'text-green-400' : 'text-red-400'}`}>
              ({result.trend_template_pass ? 'ALL 8 PASS' : 'FAIL'})
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-1">
            <ConditionBadge condition={result.cond1_price_above_150_200} label="1. Price > 150-day & 200-day SMA" />
            <ConditionBadge condition={result.cond2_150_above_200} label="2. 150-day SMA > 200-day SMA" />
            <ConditionBadge condition={result.cond3_200_trending_up} label="3. 200-day SMA trending up (1 month)" />
            <ConditionBadge condition={result.cond4_50_above_150_200} label="4. 50-day SMA > 150-day & 200-day SMA" />
            <ConditionBadge condition={result.cond5_price_above_50} label="5. Price > 50-day SMA" />
            <ConditionBadge condition={result.cond6_above_52w_low_30pct} label="6. Price ≥ 30% above 52-week low" />
            <ConditionBadge condition={result.cond7_within_25pct_52w_high} label="7. Price within 25% of 52-week high" />
            <ConditionBadge condition={result.cond8_rs_above_threshold} label="8. RS Rating ≥ 70" />
          </div>
        </div>
        <VCPDetails result={result} />
        <div className={`p-3 rounded text-sm ${result.pocket_pivot ? 'bg-green-900/50 border border-green-700 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
          {result.pocket_pivot ? '🔥 Pocket Pivot Detected Today' : 'No Pocket Pivot Today'}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Price Chart — SMA 50 · 150 · 200</h4>
          <TradingViewChart ticker={result.ticker} />
        </div>
        <div className="flex gap-2 text-xs">
          <a href={`https://www.tradingview.com/chart/?symbol=${getTradingViewSymbol(result.ticker)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 bg-blue-900/50 text-blue-300 rounded hover:bg-blue-800/50">📈 TradingView</a>
          <a href={`https://finance.yahoo.com/quote/${result.ticker}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2 bg-purple-900/50 text-purple-300 rounded hover:bg-purple-800/50">📊 Yahoo Finance</a>
        </div>
      </div>
    </div>
  );
}
