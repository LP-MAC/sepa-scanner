"""
Ticker list builders for standard US equity universes.
S&P 500 scraped from Wikipedia. Nasdaq 100 and Russell 1000 from static CSV snapshots.
"""
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent / "data"


def load_sp500() -> list[str]:
    """Scrape current S&P 500 constituents from Wikipedia."""
    try:
        # Wikipedia requires a User-Agent header
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        tables = pd.read_html(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            storage_options=headers
        )
        df = tables[0]
        tickers = df["Symbol"].str.replace(".", "-", regex=False).tolist()
        logger.info(f"Loaded {len(tickers)} S&P 500 tickers from Wikipedia")
        return tickers
    except Exception as e:
        logger.error(f"Failed to load S&P 500: {e}")
        fallback = _DATA_DIR / "sp500_fallback.csv"
        if fallback.exists():
            df = pd.read_csv(fallback)
            tickers = df["ticker"].tolist()
            logger.info(f"Loaded {len(tickers)} S&P 500 tickers from fallback CSV")
            return tickers
        raise


def load_nasdaq100() -> list[str]:
    """Load Nasdaq 100 from static CSV."""
    path = _DATA_DIR / "nasdaq100.csv"
    if not path.exists():
        logger.warning(f"Nasdaq 100 file not found at {path}, returning empty")
        return []
    df = pd.read_csv(path)
    return df["ticker"].tolist()


def load_russell1000() -> list[str]:
    """Load Russell 1000 from static CSV."""
    path = _DATA_DIR / "russell1000.csv"
    if not path.exists():
        logger.warning(f"Russell 1000 file not found at {path}, returning empty")
        return []
    df = pd.read_csv(path)
    return df["ticker"].tolist()


def load_tickers_from_file(filepath: str) -> list[str]:
    """Load tickers from a text file, one per line."""
    with open(filepath) as f:
        tickers = [line.strip().upper() for line in f if line.strip() and not line.startswith("#")]
    logger.info(f"Loaded {len(tickers)} tickers from {filepath}")
    return tickers


def build_universe(universe_name: str, ticker_file: Optional[str] = None) -> list[str]:
    """Build a deduplicated ticker list from named universe(s) and/or a file."""
    tickers: set[str] = set()

    names = [n.strip().lower() for n in universe_name.split(",")] if universe_name else []

    loaders = {
        "sp500": load_sp500,
        "nasdaq100": load_nasdaq100,
        "russell1000": load_russell1000,
    }

    for name in names:
        if name in loaders:
            tickers.update(loaders[name]())
        else:
            logger.warning(f"Unknown universe: {name}")

    if ticker_file:
        tickers.update(load_tickers_from_file(ticker_file))

    return sorted(tickers)


def filter_by_dollar_volume(
    data: dict[str, pd.DataFrame],
    min_dollar_volume: float = 5_000_000,
) -> list[str]:
    """Filter tickers by average daily dollar volume."""
    qualifying: list[str] = []
    for ticker, df in data.items():
        df_tail = df.tail(20)
        avg_dollar_vol = (df_tail["close"] * df_tail["volume"]).mean()
        if avg_dollar_vol >= min_dollar_volume:
            qualifying.append(ticker)
        else:
            logger.debug(f"{ticker}: insufficient dollar volume (${avg_dollar_vol:,.0f})")
    logger.info(f"Dollar volume filter: {len(qualifying)}/{len(data)} pass (min ${min_dollar_volume:,.0f})")
    return qualifying
