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
from sepa_scanner.vcp import detect_vcp
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

    config.output_dir.mkdir(parents=True, exist_ok=True)
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
    return parser.parse_args()


def main():
    args = parse_args()
    setup_logging(args.verbose)

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

    qualifying = filter_by_dollar_volume(data, config.min_dollar_volume)
    data = {t: data[t] for t in qualifying}

    t0 = time.time()
    regime = SpyRegimeFilter()
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

    t0 = time.time()
    vcp_results = {}
    for ticker in data:
        vcp_results[ticker] = detect_vcp(ticker, data[ticker])
    vcp_count = sum(1 for r in vcp_results.values() if r.vcp_detected)
    logger.info(f"Phase 6 - VCP: {vcp_count} detected in {time.time() - t0:.1f}s")

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
