"""
FastAPI app wrapping the SEPA scanner.
Serves the React frontend and JSON API from a single process.
"""
import io
import logging
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from sepa_scanner import __version__
from sepa_scanner.config import config
from sepa_scanner.data import fetch_universe_data
from sepa_scanner.universe import build_universe, filter_by_dollar_volume
from sepa_scanner.rs_rating import compute_rs_ratings
from sepa_scanner.trend_template import evaluate_trend_template
from sepa_scanner.vcp import detect_vcp
from sepa_scanner.regime import SpyRegimeFilter
from sepa_scanner.pocket_pivot import detect_pocket_pivot
from sepa_scanner.output import _flatten_results, ScanResult
from sepa_scanner.plotting import plot_vcp
from sepa_scanner.jobs import job_store
from sepa_scanner.universe_search import universe_index

logger = logging.getLogger("sepa_scanner.web")

limiter = Limiter(key_func=get_remote_address, default_limits=["3/hour"])

app = FastAPI(
    title="SEPA Scanner",
    version=__version__,
    description="Mark Minervini Trend Template + VCP scanner API",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
_regime_cache: dict = {"timestamp": 0.0, "bullish": None, "summary": {}}


class ScanRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1, max_length=500)
    rs_threshold: float = Field(default=70.0, ge=50.0, le=95.0)
    run_vcp: bool = Field(default=True)
    run_pocket_pivot: bool = Field(default=False)
    generate_charts: bool = Field(default=False)


@app.on_event("startup")
async def startup():
    universe_index.load()


@app.get("/api/health")
async def health():
    cache_size = len(list(config.cache_dir.glob("*.parquet"))) if config.cache_dir.exists() else 0
    return {
        "status": "ok",
        "version": __version__,
        "cache_size": cache_size,
        "active_jobs": len([j for j in job_store._jobs.values() if j.status in ("pending", "running")]),
    }


@app.get("/api/universes")
async def universes():
    presets = {}
    for name in ["sp500", "nasdaq100", "russell1000"]:
        tickers = build_universe(name)
        presets[name] = {
            "count": len(tickers),
            "label": {"sp500": "S&P 500", "nasdaq100": "Nasdaq 100", "russell1000": "Russell 1000"}.get(name, name),
        }
    return {"presets": presets, "custom_available": True}


@app.get("/api/tickers/search")
async def search_tickers(q: str = "", limit: int = 20):
    results = universe_index.search(q, limit=limit)
    return {
        "results": [{"symbol": r.symbol, "name": r.name, "sector": r.sector} for r in results],
        "query": q,
    }


@app.post("/api/tickers/validate")
async def validate_tickers(tickers: list[str]):
    valid = []
    invalid = []
    for t in tickers:
        t = t.strip().upper()
        info = universe_index.validate(t)
        if info:
            valid.append({"symbol": info.symbol, "name": info.name, "sector": info.sector})
        else:
            invalid.append(t)
    return {"valid": valid, "invalid": invalid, "total": len(tickers)}


@app.get("/api/regime")
async def regime():
    global _regime_cache
    now = time.time()
    if now - _regime_cache["timestamp"] < 3600 and _regime_cache["bullish"] is not None:
        return _regime_cache["summary"]

    rf = SpyRegimeFilter()
    bullish = rf.is_bullish_regime()
    summary = rf.regime_summary()
    summary["label"] = "Bullish" if bullish else "Cautious"
    summary["dot_color"] = "green" if bullish else "red"

    _regime_cache = {"timestamp": now, "bullish": bullish, "summary": summary}
    return summary


def _run_scan(job_id: str, req: ScanRequest):
    try:
        config.rs_threshold = req.rs_threshold

        job_store.update(job_id, status="running", progress=5, current_ticker="Fetching data...")
        data = fetch_universe_data(req.tickers)

        if not data:
            job_store.fail(job_id, "No data fetched. Check ticker symbols or network.")
            return

        qualifying = filter_by_dollar_volume(data, config.min_dollar_volume)
        data = {t: data[t] for t in qualifying}

        job_store.update(job_id, progress=10, current_ticker="Checking regime...")
        rf = SpyRegimeFilter()
        is_bullish = rf.is_bullish_regime()

        job_store.update(job_id, progress=15, current_ticker="Computing RS ratings...")
        rs_ratings = compute_rs_ratings(data)

        job_store.update(job_id, progress=25, current_ticker="Evaluating Trend Template...")
        trend_results = {}
        total = len(data)
        for i, (ticker, df) in enumerate(data.items()):
            rs = rs_ratings.get(ticker, 0.0)
            trend_results[ticker] = evaluate_trend_template(ticker, df, rs)
            progress = 25 + int((i / total) * 25)
            job_store.update(job_id, progress=progress, current_ticker=ticker, tickers_processed=i + 1)

        job_store.update(job_id, progress=55, current_ticker="Detecting VCP patterns...")
        vcp_results = {}
        for i, ticker in enumerate(data):
            df = data[ticker]
            vcp_results[ticker] = detect_vcp(ticker, df)
            if i % 10 == 0 and total > 0:
                progress = 55 + int((i / max(len(data), 1)) * 25)
                job_store.update(job_id, progress=progress, current_ticker=ticker)

        pocket_pivots = {}
        if req.run_pocket_pivot:
            job_store.update(job_id, progress=85, current_ticker="Detecting pocket pivots...")
            for ticker, df in data.items():
                pocket_pivots[ticker] = detect_pocket_pivot(df)

        charts = {}
        if req.generate_charts:
            job_store.update(job_id, progress=90, current_ticker="Generating charts...")
            vcp_tickers = [t for t, r in vcp_results.items() if r.vcp_detected]
            for i, ticker in enumerate(vcp_tickers[:20]):
                try:
                    plot_vcp(ticker, data[ticker], vcp_results[ticker])
                    chart_path = config.chart_dir / f"{ticker.replace('/', '_')}.png"
                    if chart_path.exists():
                        with open(chart_path, "rb") as f:
                            charts[ticker] = f.read()
                except Exception as e:
                    logger.warning(f"Chart generation failed for {ticker}: {e}")

        results = _flatten_results(trend_results, vcp_results, pocket_pivots, is_bullish, {}, {})
        job_store.complete(job_id, results, charts)

    except Exception as e:
        logger.exception(f"Job {job_id}: scan failed")
        job_store.fail(job_id, str(e))


@app.post("/api/scan")
@limiter.limit("3/hour")
async def start_scan(req: ScanRequest, request: Request, background_tasks: BackgroundTasks):
    if len(req.tickers) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 tickers per scan")

    tickers = list(dict.fromkeys([t.strip().upper() for t in req.tickers if t.strip()]))
    req.tickers = tickers

    job = job_store.create()
    job.tickers_total = len(tickers)
    job_store._jobs[job.job_id].tickers_total = len(tickers)

    background_tasks.add_task(_run_scan, job.job_id, req)
    return {"job_id": job.job_id, "tickers_count": len(tickers)}


@app.get("/api/scan/{job_id}")
async def get_scan(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found. Jobs expire after 1 hour.")

    response = {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "tickers_total": job.tickers_total,
        "tickers_processed": job.tickers_processed,
        "current_ticker": job.current_ticker,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error": job.error,
        "result_count": len(job.results),
    }

    if job.status == "complete":
        response["results"] = [r.to_dict() for r in job.results]

    return response


@app.get("/api/scan/{job_id}/chart/{ticker}.png")
async def get_chart(job_id: str, ticker: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    png_data = job.charts.get(ticker)
    if png_data:
        return Response(content=png_data, media_type="image/png")

    chart_path = config.chart_dir / f"{ticker.replace('/', '_')}.png"
    if chart_path.exists():
        with open(chart_path, "rb") as f:
            return Response(content=f.read(), media_type="image/png")

    raise HTTPException(status_code=404, detail="Chart not found")


@app.delete("/api/scan/{job_id}")
async def cancel_scan(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job_store.cancel(job_id)
    return {"status": "cancelled" if job.status == "running" else "deleted"}


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
