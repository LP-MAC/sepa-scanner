"""
Volatility Contraction Pattern (VCP) detection.
"""
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy.signal import find_peaks

from sepa_scanner.config import config

logger = logging.getLogger(__name__)


@dataclass
class ContractionLeg:
    """A single contraction: swing high -> swing low."""
    high_date: pd.Timestamp
    high_price: float
    low_date: pd.Timestamp
    low_price: float
    depth_pct: float
    avg_volume: float
    avg_volume_ratio_to_50d: float


@dataclass
class VCPResult:
    """Result of VCP detection."""
    ticker: str
    vcp_detected: bool = False
    num_contractions: int = 0
    contractions_pct: List[float] = field(default_factory=list)
    contraction_legs: List[ContractionLeg] = field(default_factory=list)
    pivot_price: float = 0.0
    pivot_date: Optional[pd.Timestamp] = None
    distance_from_pivot_pct: float = 0.0
    volume_dryup_score: float = 0.0
    is_final_contraction_ideal: bool = False
    # pocket_pivot removed — it belongs in pocket_pivot.py output, not VCP


def _find_swings(
    df: pd.DataFrame,
    use_col: str = "close",
) -> Tuple[List[int], List[int]]:
    """Identify swing highs and swing lows using scipy.signal.find_peaks."""
    prices = df[use_col].values
    prominence = config.vcp_swing_prominence * np.mean(prices)

    high_idx, _ = find_peaks(prices, distance=config.vcp_swing_distance, prominence=prominence)
    low_idx, _ = find_peaks(-prices, distance=config.vcp_swing_distance, prominence=prominence)

    return high_idx.tolist(), low_idx.tolist()


def _compute_volume_ratio(df: pd.DataFrame) -> pd.Series:
    """Compute ratio of daily volume to 50-day average volume."""
    avg_vol_50 = df["volume"].rolling(window=50).mean()
    return df["volume"] / avg_vol_50


def _detect_vcp(ticker: str, df: pd.DataFrame) -> VCPResult:
    """Main VCP detection logic."""
    lookback = min(config.vcp_lookback_days, len(df))
    df_window = df.iloc[-lookback:].copy()
    df_window.index = pd.to_datetime(df_window.index)

    high_indices, low_indices = _find_swings(df_window)

    if len(high_indices) < 2 or len(low_indices) < 2:
        return VCPResult(ticker=ticker)

    legs: List[ContractionLeg] = []
    vol_ratio = _compute_volume_ratio(df_window)

    for hi in high_indices:
        later_lows = [li for li in low_indices if li > hi]
        if not later_lows:
            continue
        li = later_lows[0]

        high_price = df_window["high"].iloc[hi]
        low_price = df_window["low"].iloc[li]
        depth = (high_price - low_price) / high_price

        vol_slice = df_window["volume"].iloc[hi : li + 1]
        avg_vol = vol_slice.mean()
        avg_vol_ratio_val = vol_ratio.iloc[hi : li + 1].mean() if len(vol_slice) > 0 else 1.0

        legs.append(ContractionLeg(
            high_date=df_window.index[hi],
            high_price=round(high_price, 2),
            low_date=df_window.index[li],
            low_price=round(low_price, 2),
            depth_pct=round(depth * 100, 2),
            avg_volume=round(avg_vol, 0),
            avg_volume_ratio_to_50d=round(avg_vol_ratio_val, 3),
        ))

    if len(legs) < config.vcp_min_contractions:
        return VCPResult(ticker=ticker)

    legs.sort(key=lambda l: l.high_date)

    best_sequence: List[ContractionLeg] = []

    # Only consider sequences whose LAST contraction is recent (last ~40 trading days).
    # A "VCP" with old contractions is a historical pattern, not an actionable setup.
    recent_cutoff = df_window.index[-1] - pd.Timedelta(days=60)


    for start in range(len(legs) - config.vcp_min_contractions + 1):
        sequence = [legs[start]]
        for i in range(start + 1, len(legs)):
            prev = sequence[-1]
            curr = legs[i]

            # Each contraction must be shallower by at least shallower_margin
            # vcp_shallower_margin=0.25 means each contraction is ≥25% shallower than previous
            shallower_threshold = prev.depth_pct * (1 - config.vcp_shallower_margin)
            if curr.depth_pct > shallower_threshold:
                continue

            # Lows must be higher
            if curr.low_price <= prev.low_price:
                continue

            # Volume comparison: use volume RATIO to 50-day avg, not raw volume.
            # This normalizes for changing overall market volume conditions.
            if curr.avg_volume_ratio_to_50d > prev.avg_volume_ratio_to_50d * 1.2:
                continue

            sequence.append(curr)

        # Require the last contraction in the sequence to be recent
        if (len(sequence) >= config.vcp_min_contractions
                and sequence[-1].low_date >= recent_cutoff
                and len(sequence) > len(best_sequence)):
            best_sequence = sequence

    if len(best_sequence) < config.vcp_min_contractions:
        return VCPResult(ticker=ticker)

    # Limit to max contractions (keep most recent)
    if len(best_sequence) > config.vcp_max_contractions:
        best_sequence = best_sequence[-config.vcp_max_contractions:]

    # --- Pivot calculation (FIXED) ---
    # Minervini's pivot = the high of the most recent contraction (the resistance to break).
    # The last swing high in the sequence IS the breakout level the stock needs to clear.
    # Using post-breakout highs would give nonsensical distance-from-pivot values.
    last_leg = best_sequence[-1]
    pivot_price = last_leg.high_price
    pivot_date = last_leg.high_date

    current_price = df_window["close"].iloc[-1]
    distance_pct = ((current_price - pivot_price) / pivot_price) * 100 if pivot_price > 0 else 0

    # VCP is a PRE-breakout setup. If price is already >3% above pivot, it's extended, not a setup.
    if distance_pct > 3.0:
        return VCPResult(ticker=ticker)

    first_vol_ratio = best_sequence[0].avg_volume_ratio_to_50d
    last_vol_ratio = best_sequence[-1].avg_volume_ratio_to_50d
    if first_vol_ratio > 0:
        volume_score = max(0.0, min(1.0, 1.0 - (last_vol_ratio / first_vol_ratio)))
    else:
        volume_score = 0.0

    # Check if final contraction is ideal (depth < 8%)
    final_depth = best_sequence[-1].depth_pct
    is_ideal = final_depth <= config.vcp_ideal_final_max_depth * 100

    # Also enforce the "hard" max depth if configured
    if config.vcp_final_max_depth > 0 and final_depth > config.vcp_final_max_depth * 100:
        # Final contraction too deep — not a valid VCP
        return VCPResult(ticker=ticker)

    return VCPResult(
        ticker=ticker,
        vcp_detected=True,
        num_contractions=len(best_sequence),
        contractions_pct=[leg.depth_pct for leg in best_sequence],
        contraction_legs=best_sequence,
        pivot_price=round(pivot_price, 2),
        pivot_date=pivot_date,
        distance_from_pivot_pct=round(distance_pct, 2),
        volume_dryup_score=round(volume_score, 2),
        is_final_contraction_ideal=is_ideal,
    )


def detect_vcp(ticker: str, df: pd.DataFrame) -> VCPResult:
    """Public VCP detection wrapper with error handling."""
    try:
        return _detect_vcp(ticker, df)
    except Exception as e:
        logger.warning(f"VCP detection failed for {ticker}: {e}", exc_info=True)
        return VCPResult(ticker=ticker)
