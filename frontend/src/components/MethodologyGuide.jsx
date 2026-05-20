import { useState } from 'react';

const SECTIONS = [
  {
    title: "What is SEPA?",
    content: `SEPA (Specific Entry Point Analysis) is Mark Minervini's methodology for identifying 
high-probability stock entries. It combines technical analysis, relative strength, and 
volatility contraction patterns to find stocks ready for significant price advances.

The core idea: stocks that meet ALL 8 Trend Template conditions are in strong uptrends. 
When these stocks then form a Volatility Contraction Pattern (VCP) — a series of 
progressively tighter pullbacks — they're coiling like a spring before the next leg up.`,
  },
  {
    title: "The 8 Trend Template Conditions",
    content: `Minervini's 8 conditions filter for stocks in confirmed uptrends. All must be true:

1. PRICE > 150-DAY & 200-DAY SMA
   The stock trades above both long-term moving averages, confirming the primary trend is up.

2. 150-DAY SMA > 200-DAY SMA
   The medium-term trend line sits above the long-term trend line — classic "golden cross" 
   alignment indicating the uptrend is accelerating, not decelerating.

3. 200-DAY SMA TRENDING UP (1+ month)
   Not just flat — the 200-day SMA today must be higher than 22 days ago. This confirms 
   the long-term trend has positive momentum, not just sideways drift.

4. 50-DAY SMA > 150-DAY & 200-DAY SMA
   Short-term trend above medium and long-term trends. All three SMAs stacked in proper 
   order (50 > 150 > 200) — the strongest possible alignment.

5. PRICE > 50-DAY SMA
   The stock trades above its short-term trend line. Pullbacks below the 50-day are 
   acceptable during base-building but breakout entries require reclaiming this level.

6. PRICE >= 30% ABOVE 52-WEEK LOW
   Minimum threshold to filter out stocks that have been severely damaged.

7. PRICE WITHIN 25% OF 52-WEEK HIGH
   The stock must be near its highs, not in the middle of its range. Strong stocks 
   trade near highs; weak stocks trade near lows.

8. RS RATING >= 70 (0-100 PERCENTILE)
   Relative Strength compares this stock's 12-month return to all other stocks scanned. 
   RS >= 70 means it outperformed 70% of the market.`,
  },
  {
    title: "RS Rating (Relative Strength)",
    content: `The RS Rating is a 0-100 percentile ranking of 12-month total return vs the scanned universe.

• 100 = strongest stock in the universe
• 70 = outperformed 70% of stocks (Minervini's minimum)
• 85-90+ = elite leadership territory

This is NOT the same as RSI (Relative Strength Index). RS Rating measures price 
performance vs other stocks, while RSI measures overbought/oversold conditions.

Minervini considers RS the single most important factor. His research shows stocks 
with high RS ratings significantly outperform and produce the biggest winners.`,
  },
  {
    title: "VCP (Volatility Contraction Pattern)",
    content: `A Volatility Contraction Pattern forms after an uptrend when a stock "rests" by 
going through a series of progressively smaller pullbacks. Think of it as a spring coiling:

• 2-6 CONTRACTIONS: Each pullback is shallower than the previous one
  Example: 20% drop -> 12% drop -> 6% drop
  This shows sellers are exhausting and the stock is tightening up.

• HIGHER LOWS: Each pullback's low is above the previous low
  Buyers step in at progressively higher prices — accumulation.

• VOLUME DRY-UP: Average volume during each contraction declines
  Fewer shares being sold on each pullback = supply shrinking.
  A volume dry-up score of 0.6+ means significant volume contraction.

• FINAL CONTRACTION IDEALLY < 8%
  The final contraction before breakout should be very tight — ideally under 8%. 
  This represents maximum coil and minimum risk for entry.

• PIVOT POINT: The high of the most recent consolidation
  This is the breakout trigger. When price breaks above the pivot on strong volume, 
  that's the entry signal. Being within 5% below the pivot is the "sweet spot."`,
  },
  {
    title: "SEPA Quality Score",
    content: `A composite 0-100 score combining the most important SEPA factors:

• TREND TEMPLATE PASS: 30 points
  Stock meets all 8 Minervini conditions = confirmed uptrend.

• VCP DETECTED: 30 points
  Valid contraction pattern with proper structure.

• NEAR PIVOT: up to 20 points
  < 5% below pivot = 20 pts (optimal entry zone)
  < 10% below pivot = 10 pts (acceptable)

• VOLUME DRY-UP: up to 10 points
  Score > 0.6 = 10 pts (strong volume contraction)
  Score > 0.3 = 5 pts (moderate)

• RS RATING: up to 10 points
  RS > 85 = 10 pts (elite)
  RS > 70 = 5 pts (minimum)

FINAL GRADES:
• A (80-100): High-conviction setup — all systems go
• B (60-79): Solid setup with minor imperfections
• C (40-59): Some concerns — needs human review
• D (0-39): Multiple red flags — likely skip`,
  },
  {
    title: "Pocket Pivot",
    content: `A Pocket Pivot is an accumulation signal developed by Chris Kacher and Gil Morales. 
It identifies institutional buying:

Definition: An UP day where volume exceeds the highest DOWN-day volume of the prior 
10 trading days.

What it means: When a stock is up and volume is higher than the biggest selling day 
in the past two weeks, it suggests institutions are aggressively accumulating. This 
is especially powerful when it occurs within a VCP base.

Pocket Pivots often appear days or weeks BEFORE the official pivot breakout, giving 
early confirmation that the base is completing.`,
  },
  {
    title: "Market Regime Filter",
    content: `The scanner checks whether the broad market supports long positions by analyzing SPY:

BULLISH REGIME (Green dot):
• SPY price > 200-day SMA
• SPY 50-day SMA > SPY 200-day SMA

CAUTIOUS REGIME (Red dot):
Either condition is false. The scanner still runs but results are flagged.

The regime filter is modular and can be extended with your own multi-asset model 
(GLD, TLT, QQQ, IWM) for more sophisticated regime detection.`,
  },
  {
    title: "How to Use This Scanner",
    content: `DAILY WORKFLOW:

1. CHECK REGIME (top bar)
   Green = favorable. Red = proceed with caution.

2. SELECT UNIVERSE
   S&P 500 for large-cap quality, or Custom list for your watchlist.

3. RUN SCAN
   Default RS threshold of 70 works well. Raise to 80-85 for tighter filters.

4. REVIEW RESULTS
   Sort by RS Rating or look for "A" grades. Filter "VCP only" for patterns.

5. CLICK A TICKER for deep dive:
   - Check all 8 conditions
   - Review VCP structure
   - Look at distance from pivot (< 5% is ideal)
   - Study the chart with SMAs
   - Open TradingView for deeper analysis

6. HUMAN REVIEW (critical!)
   This scanner finds candidates — YOU make the final decision.
   Minervini's risk management: cut losses at 5-7%`,
  },
  {
    title: "Key Terminology",
    content: `SMA (Simple Moving Average): Average closing price over N days. Minervini specifies SMA, not EMA.

PIVOT POINT: The highest price during the most recent consolidation. Breakout trigger.

CONTRACTION DEPTH: (Swing High - Swing Low) / Swing High. Measures pullback severity.

VOLUME DRY-UP SCORE: 0-1 measure of volume decline from first to last contraction.

DISTANCE FROM PIVOT: How far current price is from breakout level. Negative = below pivot.

52-WEEK HIGH/LOW: Rolling 252-trading-day high and low prices.

DOLLAR VOLUME: Close × Volume. Filters out illiquid stocks.`,
  },
];

export default function MethodologyGuide({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState(0);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-10 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 flex overflow-hidden">
        <div className="w-72 bg-gray-800 border-r border-gray-700 overflow-y-auto flex-shrink-0 hidden md:block">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold text-blue-400">SEPA Methodology</h2>
            <p className="text-xs text-gray-400 mt-1">Mark Minervini's Complete Guide</p>
          </div>
          <nav className="p-2">
            {SECTIONS.map((section, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSection(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
                  activeSection === idx
                    ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
            <div className="md:hidden">
              <select
                value={activeSection}
                onChange={e => setActiveSection(Number(e.target.value))}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
              >
                {SECTIONS.map((s, i) => (
                  <option key={i} value={i}>{s.title}</option>
                ))}
              </select>
            </div>
            <h3 className="text-lg font-semibold text-white hidden md:block">
              {SECTIONS[activeSection].title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              ✕ Close
            </button>
          </div>
          
          <div className="p-6 max-w-3xl">
            {SECTIONS[activeSection].content.split('\n\n').map((paragraph, i) => {
              if (paragraph.trim().startsWith('•')) {
                return (
                  <div key={i} className="flex gap-2 my-1">
                    <span className="text-blue-400 mt-1">•</span>
                    <span className="text-gray-300">{paragraph.trim().substring(1).trim()}</span>
                  </div>
                );
              }
              return (
                <p key={i} className="text-gray-300 my-2 leading-relaxed">
                  {paragraph}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
