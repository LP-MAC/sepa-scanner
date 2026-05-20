#!/bin/bash
# Fixes all Tier 2 critical + important bugs

# ---- data.py ----
cat > sepa_scanner/data.py << 'PYEOF'
"""
yfinance data fetcher with disk caching via parquet and exponential backoff retry.
"""
import logging
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf
from zoneinfo import ZoneInfo

from sepa_scanner.config import config

logger = logging.getLogger(__name__)

EASTERN = ZoneInfo("America/New_York")
_fetch_lock = threading.Lock()
_last_fetch_time: float = 0.0


def _rate_limit():
    """Thread-safe enforcement of minimum delay between yfinance calls."""
    global _last_fetch_time
    with _fetch_lock:
        elapsed = time.monotonic() - _last_fetch_time
        if elapsed < config.rate_limit_delay:
            time.sleep(config.rate_limit_delay - elapsed)
        _last_fetch_time = time.monotonic()


def _last_trading_close(now: datetime) -> datetime:
    """Given now, return the datetime of the most recent market close (4 PM ET)."""
    close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    # If it's before 4 PM, the last close was yesterday (or Friday if Monday)
    if now < close:
        close -= timedelta(days=1)
    # Walk back over weekends
    while close.weekday() >= 5:  # Sat=5, Sun=6
        close -= timedelta(days=1)
    return close


def _is_cache_valid(cache_path: Path) -> bool:
    """Cache is valid if written after the most recent market close."""
    if not cache_path.exists():
        return False
    now = datetime.now(EASTERN)
    last_close = _last_trading_close(now)
    mtime = datetime.fromtimestamp(cache_path.stat().st_mtime, tz=EASTERN)
    return mtime >= last_close


def _cache_path(ticker: str) -> Path:
    """Generate cache file path for a ticker."""
    safe_ticker = ticker.replace(".", "_").replace("/", "_")
    return config.cache_dir / f"{safe_ticker}.parquet"


def _save_cache(ticker: str, df: pd.DataFrame):
    """Write dataframe to parquet cache."""
    path = _cache_path(ticker)
    df.to_parquet(path, index=True)
    logger.debug(f"Cached {ticker} -> {path}")


def _load_cache(ticker: str) -> Optional[pd.DataFrame]:
    """Load from cache if valid, else return None."""
    path = _cache_path(ticker)
    if _is_cache_valid(path):
        try:
            df = pd.read_parquet(path)
            logger.debug(f"Cache hit: {ticker}")
            return df
        except Exception as e:
            logger.warning(f"Corrupt cache for {ticker}: {e}")
            path.unlink(missing_ok=True)
    return None


def fetch_ticker_data(ticker: str, no_cache: bool = False) -> Optional[pd.DataFrame]:
    """Fetch ~1 year of daily OHLCV data for a single ticker."""
    if not no_cache:
        cached = _load_cache(ticker)
        if cached is not None:
            if len(cached) >= config.lookback_days * 0.8:
                return cached
            else:
                logger.debug(f"Cache for {ticker} too short ({len(cached)} rows), re-fetching")

    _rate_limit()

    for attempt in range(config.max_retries):
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period="1y", interval="1d", auto_adjust=True)

            if df.empty or len(df) < 50:
                logger.debug(f"{ticker}: insufficient data ({len(df)} rows)")
                return None

            if df.index.tz is not None:
                df.index = df.index.tz_localize(None)

            df.columns = [c.lower() for c in df.columns]
            required_cols = {"open", "high", "low", "close", "volume"}
            if not required_cols.issubset(set(df.columns)):
                logger.debug(f"{ticker}: missing required columns, got {list(df.columns)}")
                return None

            _save_cache(ticker, df)
            return df

        except (yf.exceptions.YFRateLimitError, yf.exceptions.YFNotImplementedError):
            wait = config.retry_backoff_base ** attempt
            logger.warning(f"{ticker}: yfinance error on attempt {attempt + 1}, retrying in {wait}s")
            time.sleep(wait)
        except Exception as e:
            # Data-shape errors don't benefit from retries; fail fast
            logger.warning(f"{ticker}: non-retryable error: {e}")
            return None

    logger.warning(f"{ticker}: all {config.max_retries} fetch attempts failed")
    return None


def fetch_universe_data(
    tickers: list[str],
    no_cache: bool = False,
) -> dict[str, pd.DataFrame]:
    """Fetch data for all tickers in parallel using ThreadPoolExecutor."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results: dict[str, pd.DataFrame] = {}
    failed: list[str] = []

    with ThreadPoolExecutor(max_workers=config.max_workers) as executor:
        future_to_ticker = {
            executor.submit(fetch_ticker_data, t, no_cache): t
            for t in tickers
        }
        for future in as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            try:
                df = future.result()
                if df is not None:
                    results[ticker] = df
                else:
                    failed.append(ticker)
            except Exception as e:
                logger.warning(f"{ticker}: unexpected error in fetch: {e}")
                failed.append(ticker)

    if failed:
        logger.info(f"Failed to fetch {len(failed)} tickers: {failed[:10]}{'...' if len(failed) > 10 else ''}")
    logger.info(f"Fetched data for {len(results)}/{len(tickers)} tickers")
    return results
PYEOF

# ---- __main__.py ----
cat > sepa_scanner/__main__.py << 'PYEOF'
"""
CLI entry point for the SEPA scanner.
Usage: python -m sepa_scanner [options]
"""
import argparse
import logging
import sys
import time
from datetime import datetime

from sepa_scanner.config import config
from sepa_scanner.data import fetch_universe_data
from sepa_scanner.universe import build_universe, filter_by_dollar_volume
from sepa_scanner.rs_rating import compute_rs_ratings
from sepa_scanner.trend_template import evaluate_trend_template
from sepa_scanner.vcp import detect_vcp, VCPResult
from sepa_scanner.regime import SpyRegimeFilter
from sepa_scanner.pocket_pivot import detect_pocket_pivot
from sepa_scanner.output import _flatten_results, write_csv, write_json
from sepa_scanner.plotting import plot_vcp

logger = logging.getLogger("sepa_scanner")


def setup_logging(verbose: bool = False):
    """Configure logging to stdout and file."""
    level = logging.DEBUG if verbose else logging.INFO
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    config.ensure_dirs()
    fh = logging.FileHandler(config.log_file)
    fh.setLevel(level)
    fh.setFormatter(formatter)

    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(level)
    sh.setFormatter(formatter)

    root = logging.getLogger("sepa_scanner")
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(fh)
    root.addHandler(sh)


def parse_args():
    parser = argparse.ArgumentParser(
        description="SEPA Scanner: Minervini Trend Template + VCP detection"
    )
    parser.add_argument("--universe", type=str, default="sp500")
    parser.add_argument("--tickers", type=str, default=None)
    parser.add_argument("--rs-threshold", type=float, default=None)
    parser.add_argument("--plot", action="store_true", default=False)
    parser.add_argument("--no-cache", action="store_true", default=False)
    parser.add_argument("--verbose", action="store_true", default=False)
    parser.add_argument("--backtest", action="store_true", default=False)
    parser.add_argument("--start", type=str, default=None, help="Backtest start (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default=None, help="Backtest end (YYYY-MM-DD)")
    return parser.parse_args()


def main():
    args = parse_args()
    setup_logging(args.verbose)

    if args.backtest:
        logger.error("Backtest mode not yet implemented")
        raise NotImplementedError(
            "Backtest mode is not yet implemented. "
            "It requires storing historical snapshots of price data for each scan date."
        )

    if args.rs_threshold is not None:
        config.rs_threshold = args.rs_threshold

    logger.info("=" * 60)
    logger.info("SEPA Scanner Starting")
    logger.info(f"  Universe: {args.universe}")
    logger.info(f"  RS Threshold: {config.rs_threshold}")
    logger.info("=" * 60)

    t0 = time.time()
    tickers = build_universe(args.universe, args.tickers)
    logger.info(f"Phase 1 - Universe: {len(tickers)} tickers in {time.time() - t0:.1f}s")

    t0 = time.time()
    data = fetch_universe_data(tickers, no_cache=args.no_cache)
    logger.info(f"Phase 2 - Data Fetch: {len(data)} tickers in {time.time() - t0:.1f}s")

    if not data:
        logger.error("No data fetched — yfinance may be unavailable or all tickers failed")
        sys.exit(1)

    qualifying = filter_by_dollar_volume(data, config.min_dollar_volume)
    data = {t: data[t] for t in qualifying}

    # Pass SPY to regime filter if already in data (avoids double-fetch)
    t0 = time.time()
    regime = SpyRegimeFilter(data=data.get("SPY"))
    is_bullish = regime.is_bullish_regime()
    logger.info(f"Phase 3 - Regime: bullish={is_bullish} in {time.time() - t0:.1f}s")

    t0 = time.time()
    rs_ratings = compute_rs_ratings(data)
    logger.info(f"Phase 4 - RS Ratings: {len(rs_ratings)} in {time.time() - t0:.1f}s")

    t0 = time.time()
    trend_results = {}
    for ticker, df in data.items():
        rs = rs_ratings.get(ticker, 0.0)
        trend_results[ticker] = evaluate_trend_template(ticker, df, rs)
    trend_passes = sum(1 for r in trend_results.values() if r.passes_all)
    logger.info(f"Phase 5 - Trend Template: {trend_passes} pass in {time.time() - t0:.1f}s")

    # VCP only on Trend Template passers (Minervini spec: VCP is only meaningful in uptrends)
    t0 = time.time()
    vcp_results = {}
    vcp_passers = [t for t in data if trend_results[t].passes_all]
    for ticker in vcp_passers:
        vcp_results[ticker] = detect_vcp(ticker, data[ticker])
    # Non-passers get empty VCP result
    for ticker in data:
        if ticker not in vcp_results:
            vcp_results[ticker] = VCPResult(ticker=ticker)
    vcp_count = sum(1 for r in vcp_results.values() if r.vcp_detected)
    logger.info(f"Phase 6 - VCP: {vcp_count} detected (on {len(vcp_passers)} Trend passers) in {time.time() - t0:.1f}s")

    pocket_pivots = {}
    for ticker, df in data.items():
        pocket_pivots[ticker] = detect_pocket_pivot(df)

    results = _flatten_results(trend_results, vcp_results, pocket_pivots, is_bullish, {}, {})

    date_str = datetime.now().strftime("%Y%m%d")
    write_csv(results, f"scan_results_{date_str}.csv")
    write_json(results, f"scan_results_{date_str}.json")

    if args.plot:
        for ticker, vcp in vcp_results.items():
            if vcp.vcp_detected:
                plot_vcp(ticker, data[ticker], vcp)

    logger.info("=" * 60)
    logger.info("SCAN COMPLETE")
    logger.info(f"  Trend Template passes: {trend_passes}")
    logger.info(f"  VCP detected: {vcp_count}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
PYEOF

# ---- web.py (patch VCP-on-passers-only logic) ----
python3 << 'PYPATCH'
with open("sepa_scanner/web.py", "r") as f:
    content = f.read()

# Fix VCP to only run on Trend passers
old = '        vcp_results = {}\n        for i, ticker in enumerate(data):\n            df = data[ticker]\n            vcp_results[ticker] = detect_vcp(ticker, df)'
new = '''        vcp_results = {}
        vcp_passers = [t for t in data if trend_results.get(t, VCPResult(ticker="")).passes_all] if trend_results else []
        job_store.update(job_id, progress=55, current_ticker="Detecting VCP patterns...")
        for i, ticker in enumerate(vcp_passers):
            vcp_results[ticker] = detect_vcp(ticker, data[ticker])
            if i % 10 == 0 and len(vcp_passers) > 0:
                progress = 55 + int((i / len(vcp_passers)) * 25)
                job_store.update(job_id, progress=progress, current_ticker=ticker)
        for ticker in data:
            if ticker not in vcp_results:
                vcp_results[ticker] = VCPResult(ticker=ticker)'''
content = content.replace(old, new)

# Add VCPResult import if missing
if "from sepa_scanner.vcp import detect_vcp" in content:
    content = content.replace(
        "from sepa_scanner.vcp import detect_vcp",
        "from sepa_scanner.vcp import detect_vcp, VCPResult"
    )

with open("sepa_scanner/web.py", "w") as f:
    f.write(content)
print("web.py patched")
PYPATCH

# ---- requirements.txt (add pyarrow back) ----
cat > requirements.txt << 'PYEOF'
yfinance>=0.2.40
pandas>=2.1.0
numpy>=1.24.0
scipy>=1.10.0
pyarrow>=17.0.0
matplotlib>=3.7.0
lxml>=4.9.0
html5lib>=1.1
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
slowapi>=0.1.9
python-multipart>=0.0.6
setuptools>=69.0.0
PYEOF

# ---- config.py (ensure ensure_dirs accessible) ----
python3 << 'PYPATCH'
with open("sepa_scanner/config.py", "r") as f:
    content = f.read()
# Already has ensure_dirs from previous fix — verify
if "def ensure_dirs" not in content:
    print("WARNING: config.py missing ensure_dirs — re-applying fix")
    content += '''
    def ensure_dirs(self):
        """Create output directories. Call at app startup, not during import."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.chart_dir.mkdir(parents=True, exist_ok=True)
'''
    with open("sepa_scanner/config.py", "w") as f:
        f.write(content)
PYPATCH

echo ""
echo "========================================="
echo "All Tier 2 fixes applied"
echo "========================================="
echo ""
echo "Changes:"
echo "  data.py     — parquet, thread-safe rate limit, smart retries, zoneinfo, cache validation"
echo "  __main__.py — VCP on passers only, SPY reuse, backtest stub, empty-data guard, ensure_dirs"
echo "  web.py      — VCP on passers only"
echo "  requirements.txt — pyarrow added back, pytz removed"
echo "  config.py   — ensure_dirs verified"
echo ""
