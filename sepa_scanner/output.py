"""
Output writers for scan results: CSV and JSON.
"""
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import List

import pandas as pd

from sepa_scanner.config import config
from sepa_scanner.trend_template import TrendTemplateResult
from sepa_scanner.vcp import VCPResult

logger = logging.getLogger(__name__)


@dataclass
class ScanResult:
    """Aggregated result for a single ticker after full scan."""
    ticker: str
    name: str
    sector: str
    price: float
    rs_rating: float
    trend_template_pass: bool
    vcp_detected: bool
    num_contractions: int
    contractions_pct: str
    pivot_price: float
    distance_from_pivot_pct: float
    volume_dryup_score: float
    is_final_contraction_ideal: bool
    pocket_pivot: bool
    regime_bullish: bool
    scan_timestamp: str
    cond1_price_above_150_200: bool = False
    cond2_150_above_200: bool = False
    cond3_200_trending_up: bool = False
    cond4_50_above_150_200: bool = False
    cond5_price_above_50: bool = False
    cond6_above_52w_low_30pct: bool = False
    cond7_within_25pct_52w_high: bool = False
    cond8_rs_above_threshold: bool = False

    def to_dict(self) -> dict:
        """Convert to dict with native Python types (no numpy)."""
        return {
            "ticker": str(self.ticker),
            "name": str(self.name),
            "sector": str(self.sector),
            "price": float(self.price) if self.price else 0.0,
            "rs_rating": float(self.rs_rating) if self.rs_rating else 0.0,
            "trend_template_pass": bool(self.trend_template_pass),
            "vcp_detected": bool(self.vcp_detected),
            "num_contractions": int(self.num_contractions),
            "contractions_pct": str(self.contractions_pct),
            "pivot_price": float(self.pivot_price) if self.pivot_price else 0.0,
            "distance_from_pivot_pct": float(self.distance_from_pivot_pct) if self.distance_from_pivot_pct else 0.0,
            "volume_dryup_score": float(self.volume_dryup_score) if self.volume_dryup_score else 0.0,
            "is_final_contraction_ideal": bool(self.is_final_contraction_ideal),
            "pocket_pivot": bool(self.pocket_pivot),
            "regime_bullish": bool(self.regime_bullish),
            "scan_timestamp": str(self.scan_timestamp),
            "cond1_price_above_150_200": bool(self.cond1_price_above_150_200),
            "cond2_150_above_200": bool(self.cond2_150_above_200),
            "cond3_200_trending_up": bool(self.cond3_200_trending_up),
            "cond4_50_above_150_200": bool(self.cond4_50_above_150_200),
            "cond5_price_above_50": bool(self.cond5_price_above_50),
            "cond6_above_52w_low_30pct": bool(self.cond6_above_52w_low_30pct),
            "cond7_within_25pct_52w_high": bool(self.cond7_within_25pct_52w_high),
            "cond8_rs_above_threshold": bool(self.cond8_rs_above_threshold),
        }


def _flatten_results(
    trend_results: dict[str, TrendTemplateResult],
    vcp_results: dict[str, VCPResult],
    pocket_pivot_results: dict[str, bool],
    regime_bullish: bool,
    ticker_names: dict[str, str],
    ticker_sectors: dict[str, str],
) -> List[ScanResult]:
    """Combine all results into a flat list of ScanResult dataclasses."""
    timestamp = datetime.now().isoformat()
    results: List[ScanResult] = []

    for ticker, trend in trend_results.items():
        vcp = vcp_results.get(ticker, VCPResult(ticker=ticker))
        pp = pocket_pivot_results.get(ticker, False)

        contractions_json = json.dumps(vcp.contractions_pct)

        results.append(ScanResult(
            ticker=ticker,
            name=ticker_names.get(ticker, ""),
            sector=ticker_sectors.get(ticker, ""),
            price=float(trend.price),
            rs_rating=float(trend.rs_rating),
            trend_template_pass=bool(trend.passes_all),
            vcp_detected=bool(vcp.vcp_detected),
            num_contractions=int(vcp.num_contractions),
            contractions_pct=contractions_json,
            pivot_price=float(vcp.pivot_price),
            distance_from_pivot_pct=float(vcp.distance_from_pivot_pct),
            volume_dryup_score=float(vcp.volume_dryup_score),
            is_final_contraction_ideal=bool(vcp.is_final_contraction_ideal),
            pocket_pivot=bool(pp),
            regime_bullish=bool(regime_bullish),
            scan_timestamp=timestamp,
            cond1_price_above_150_200=bool(trend.cond1_price_above_150_200),
            cond2_150_above_200=bool(trend.cond2_150_above_200),
            cond3_200_trending_up=bool(trend.cond3_200_trending_up),
            cond4_50_above_150_200=bool(trend.cond4_50_above_150_200),
            cond5_price_above_50=bool(trend.cond5_price_above_50),
            cond6_above_52w_low_30pct=bool(trend.cond6_above_52w_low_30pct),
            cond7_within_25pct_52w_high=bool(trend.cond7_within_25pct_52w_high),
            cond8_rs_above_threshold=bool(trend.cond8_rs_above_threshold),
        ))

    return results


def write_csv(results: List[ScanResult], filename: str):
    """Write scan results to CSV."""
    df = pd.DataFrame([r.to_dict() for r in results])
    df = df.sort_values(["vcp_detected", "trend_template_pass", "rs_rating"],
                        ascending=[False, False, False])
    path = config.output_dir / filename
    df.to_csv(path, index=False)
    logger.info(f"Wrote {len(df)} results to {path}")


def write_json(results: List[ScanResult], filename: str):
    """Write scan results to JSON."""
    data = [r.to_dict() for r in results]
    path = config.output_dir / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info(f"Wrote {len(data)} results to {path}")
