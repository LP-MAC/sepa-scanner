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
