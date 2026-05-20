"""
Optional matplotlib chart generator for VCP candidates.
"""
import logging
from pathlib import Path
from typing import Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd

from sepa_scanner.config import config
from sepa_scanner.trend_template import compute_sma
from sepa_scanner.vcp import VCPResult

logger = logging.getLogger(__name__)


def plot_vcp(
    ticker: str,
    df: pd.DataFrame,
    vcp_result: VCPResult,
    output_dir: Optional[Path] = None,
) -> Optional[Path]:
    """Generate a chart for a VCP candidate."""
    if not vcp_result.vcp_detected:
        return None

    if output_dir is None:
        output_dir = config.chart_dir

    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        df_plot = df.iloc[-config.vcp_lookback_days:].copy()
        df_plot.index = pd.to_datetime(df_plot.index)

        sma_50 = compute_sma(df_plot["close"], 50)
        sma_150 = compute_sma(df_plot["close"], 150)
        sma_200 = compute_sma(df_plot["close"], 200)

        fig, ax = plt.subplots(figsize=(14, 8))

        ax.plot(df_plot.index, df_plot["close"], color="black", linewidth=1.5, label="Close")
        ax.plot(df_plot.index, sma_50, color="blue", linewidth=1, alpha=0.7, label="50 SMA")
        ax.plot(df_plot.index, sma_150, color="orange", linewidth=1, alpha=0.7, label="150 SMA")
        ax.plot(df_plot.index, sma_200, color="red", linewidth=1, alpha=0.7, label="200 SMA")

        for i, leg in enumerate(vcp_result.contraction_legs):
            color = "green" if i == len(vcp_result.contraction_legs) - 1 else "gray"
            ax.scatter(leg.high_date, leg.high_price, marker="v", s=100,
                      color=color, edgecolors="black", linewidths=0.5, zorder=5)
            ax.scatter(leg.low_date, leg.low_price, marker="^", s=100,
                      color="red" if i == len(vcp_result.contraction_legs) - 1 else "gray",
                      edgecolors="black", linewidths=0.5, zorder=5)

        if vcp_result.pivot_date and vcp_result.pivot_price:
            ax.axhline(y=vcp_result.pivot_price, color="purple", linestyle="--",
                      linewidth=1, alpha=0.8, label=f"Pivot: ${vcp_result.pivot_price:.2f}")

        ax.set_title(
            f"{ticker} — VCP Detected\n"
            f"{vcp_result.num_contractions} contractions: "
            f"{' → '.join(f'{d:.1f}%' for d in vcp_result.contractions_pct)}",
            fontsize=14
        )
        ax.set_xlabel("Date")
        ax.set_ylabel("Price ($)")
        ax.legend(loc="upper left", fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
        plt.xticks(rotation=45)

        plt.tight_layout()
        path = output_dir / f"{ticker.replace('/', '_')}.png"
        plt.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        logger.info(f"Chart saved: {path}")
        return path

    except Exception as e:
        logger.warning(f"Failed to plot {ticker}: {e}")
        plt.close("all")
        return None
