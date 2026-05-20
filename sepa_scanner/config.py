"""
All configurable parameters for the SEPA scanner.
Sensible defaults match Minervini's published methodology.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class ScannerConfig:
    """Master configuration for the scanner."""

    # --- Trend Template (all SMAs, not EMAs — Minervini's explicit requirement) ---
    sma_50: int = 50
    sma_150: int = 150
    sma_200: int = 200
    trend_lookback_days: int = 22  # ~1 month for 200 SMA "trending up" check
    pct_above_52w_low: float = 0.30  # >= 30% above 52-week low
    pct_within_52w_high: float = 0.25  # within 25% of 52-week high (price >= 0.75 * high)
    rs_lookback_months: int = 12  # 12-month return for RS rating
    rs_threshold: float = 70.0  # Minervini's default, tunable

    # --- VCP detection ---
    vcp_lookback_days: int = 120  # trading days to scan for swing points
    vcp_swing_distance: int = 15  # minimum days between swing points (find_peaks 'distance')
    vcp_swing_prominence: float = 0.05  # minimum prominence as fraction of price (3%)
    vcp_min_contractions: int = 2  # minimum contraction legs to qualify
    vcp_max_contractions: int = 6  # maximum contractions
    vcp_shallower_margin: float = 0.25  # each contraction must be at least 20% shallower
    vcp_final_max_depth: float = 0.10  # final contraction ideally < 10% deep
    vcp_ideal_final_max_depth: float = 0.08  # ideally < 8%
    volume_dryup_threshold: float = 0.50  # average vol during contraction < 50% of 50-day avg

    # --- Universe ---
    min_dollar_volume: float = 5_000_000  # $5M/day minimum

    # --- Data fetching ---
    max_workers: int = 8
    max_retries: int = 3
    retry_backoff_base: float = 2.0  # exponential backoff multiplier
    rate_limit_delay: float = 0.5  # seconds between yfinance calls (conservative: ~2 req/sec)
    cache_dir: Path = Path("output/cache")
    lookback_days: int = 260  # ~1 year of daily data

    # --- Output ---
    output_dir: Path = Path("output")
    chart_dir: Path = Path("output/charts")
    log_file: Path = Path("output/scan.log")

    # --- Backtest ---
    backtest_start: str = ""
    backtest_end: str = ""

    def __post_init__(self):
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.chart_dir.mkdir(parents=True, exist_ok=True)


# Singleton config
config = ScannerConfig()
