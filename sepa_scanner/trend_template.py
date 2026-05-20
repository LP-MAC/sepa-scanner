"""
Mark Minervini's 8-condition Trend Template.
All conditions must be true simultaneously for a stock to pass.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd

from sepa_scanner.config import config

logger = logging.getLogger(__name__)


@dataclass
class TrendTemplateResult:
    """Result of evaluating all 8 Trend Template conditions."""

    ticker: str
    price: float
    sma_50: float
    sma_150: float
    sma_200: float
    cond1_price_above_150_200: bool = False
    cond2_150_above_200: bool = False
    cond3_200_trending_up: bool = False
    cond4_50_above_150_200: bool = False
    cond5_price_above_50: bool = False
    cond6_above_52w_low_30pct: bool = False
    cond7_within_25pct_52w_high: bool = False
    cond8_rs_above_threshold: bool = False
    passes_all: bool = False
    rs_rating: float = 0.0
    high_52w: float = 0.0
    low_52w: float = 0.0


def compute_sma(series: pd.Series, window: int) -> pd.Series:
    """Simple Moving Average (not EMA — Minervini is explicit on this)."""
    return series.rolling(window=window).mean()


def evaluate_trend_template(
    ticker: str,
    df: pd.DataFrame,
    rs_rating: float,
) -> TrendTemplateResult:
    """Evaluate all 8 Minervini Trend Template conditions."""
    closes = df["close"]
    current_price = closes.iloc[-1]

    sma_50_val = compute_sma(closes, config.sma_50).iloc[-1]
    sma_150_val = compute_sma(closes, config.sma_150).iloc[-1]
    sma_200_val = compute_sma(closes, config.sma_200).iloc[-1]

    if pd.isna(sma_200_val):
        return TrendTemplateResult(ticker=ticker, price=current_price,
                                    sma_50=0, sma_150=0, sma_200=0)

    lookback_52w = min(252, len(df))
    high_52w = df["high"].iloc[-lookback_52w:].max()
    low_52w = df["low"].iloc[-lookback_52w:].min()

    cond1 = current_price > sma_150_val and current_price > sma_200_val
    cond2 = sma_150_val > sma_200_val

    if len(closes) >= config.sma_200 + config.trend_lookback_days:
        sma_200_series = compute_sma(closes, config.sma_200)
        sma_200_today = sma_200_series.iloc[-1]
        sma_200_22d_ago = sma_200_series.iloc[-config.trend_lookback_days - 1]
        cond3 = bool(sma_200_today > sma_200_22d_ago)
    else:
        cond3 = False

    cond4 = sma_50_val > sma_150_val and sma_50_val > sma_200_val
    cond5 = current_price > sma_50_val
    cond6 = (current_price / low_52w - 1.0) >= config.pct_above_52w_low if low_52w > 0 else False
    cond7 = current_price >= (high_52w * (1.0 - config.pct_within_52w_high)) if high_52w > 0 else False
    cond8 = rs_rating >= config.rs_threshold

    passes_all = all([cond1, cond2, cond3, cond4, cond5, cond6, cond7, cond8])

    return TrendTemplateResult(
        ticker=ticker,
        price=round(current_price, 2),
        sma_50=round(sma_50_val, 2),
        sma_150=round(sma_150_val, 2),
        sma_200=round(sma_200_val, 2),
        cond1_price_above_150_200=cond1,
        cond2_150_above_200=cond2,
        cond3_200_trending_up=cond3,
        cond4_50_above_150_200=cond4,
        cond5_price_above_50=cond5,
        cond6_above_52w_low_30pct=cond6,
        cond7_within_25pct_52w_high=cond7,
        cond8_rs_above_threshold=cond8,
        passes_all=passes_all,
        rs_rating=rs_rating,
        high_52w=round(high_52w, 2),
        low_52w=round(low_52w, 2),
    )
