"""
Quality dashboard — the single pane of glass over every gate.

Turns the platform from "a set of test suites" into "a QA operations system":
one view of E2E pass rate, flakiness, data-quality violations, accessibility, and
load p95/p99. It reads the machine-readable artifacts each gate emits, so it works
in CI (point it at downloaded artifacts) or locally after a run.

Run:  streamlit run dashboard/app.py
Reads (all optional — missing gates render as "no data"):
  reports/json/results.json           Playwright JSON reporter
  reports/data_quality/results.json   python -m tests.data_quality output
  reports/load/summary.json           k6 --summary-export output
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st  # type: ignore[reportMissingImports]

REPORTS = Path("reports")


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


# ---------- Playwright ----------
def parse_playwright(report: dict | None):
    """Walk the Playwright JSON report and tally outcomes + flakiness."""
    if not report:
        return None
    passed = failed = flaky = skipped = 0

    def walk(suites):
        nonlocal passed, failed, flaky, skipped
        for suite in suites:
            for spec in suite.get("specs", []):
                for t in spec.get("tests", []):
                    results = t.get("results", [])
                    statuses = [r.get("status") for r in results]
                    final = t.get("status") or (statuses[-1] if statuses else "unknown")
                    # Retried-then-passed == flaky
                    if final == "expected" and len(results) > 1 and "unexpected" in statuses[:-1]:
                        flaky += 1
                    elif final in ("expected", "passed"):
                        passed += 1
                    elif final in ("skipped",):
                        skipped += 1
                    else:
                        failed += 1
            walk(suite.get("suites", []))

    walk(report.get("suites", []))
    total = passed + failed + flaky + skipped
    return {
        "passed": passed,
        "failed": failed,
        "flaky": flaky,
        "skipped": skipped,
        "total": total,
        "pass_rate": (passed + flaky) / total * 100 if total else 0.0,
    }


# ---------- k6 ----------
def parse_k6(summary: dict | None):
    if not summary:
        return None
    metrics = summary.get("metrics", {})

    def pct(name, stat):
        return metrics.get(name, {}).get("values", {}).get(stat)

    return {
        "p95_ms": pct("http_req_duration", "p(95)"),
        "p99_ms": pct("http_req_duration", "p(99)"),
        "checkout_p95_ms": pct("checkout_latency", "p(95)"),
        "error_rate": metrics.get("funnel_errors", {}).get("values", {}).get("rate"),
        "orders": metrics.get("orders_placed", {}).get("values", {}).get("count"),
    }


def main():
    st.set_page_config(page_title="Storefront Quality Gate", layout="wide")
    st.title("Storefront Quality Gate — Operations Dashboard")
    st.caption("Aggregated results across E2E, data quality, and load. One view, every gate.")

    pw = parse_playwright(load_json(REPORTS / "json" / "results.json"))
    dq = load_json(REPORTS / "data_quality" / "results.json")
    load = parse_k6(load_json(REPORTS / "load" / "summary.json"))

    # ---- Top-line KPIs ----
    c1, c2, c3, c4 = st.columns(4)
    if pw:
        c1.metric("E2E pass rate", f"{pw['pass_rate']:.1f}%", f"{pw['failed']} failed")
        c2.metric("Flaky tests", pw["flaky"], help="Passed only after a retry")
    else:
        c1.metric("E2E pass rate", "—")
        c2.metric("Flaky tests", "—")

    if dq:
        dq_rate = dq["passed"] / dq["total"] * 100 if dq["total"] else 0
        c3.metric("Data-quality checks", f"{dq['passed']}/{dq['total']}", f"{dq_rate:.0f}% clean")
    else:
        c3.metric("Data-quality checks", "—")

    if load and load["p95_ms"] is not None:
        c4.metric("Load p95", f"{load['p95_ms']:.0f} ms", help="Full funnel under flash-sale load")
    else:
        c4.metric("Load p95", "—")

    st.divider()

    # ---- Data-quality detail ----
    st.subheader("Data quality — pricing, catalog & order integrity")
    if dq:
        for check in dq["checks"]:
            status = "PASS" if check["passed"] else "FAIL"
            with st.expander(f"[{status}] {check['file']}: {check['description']}", expanded=not check["passed"]):
                if check["passed"]:
                    st.success("0 violating rows")
                else:
                    st.error(f"{check['violation_count']} violating row(s)")
                    if check.get("sample"):
                        st.dataframe(check["sample"], use_container_width=True)
    else:
        st.info("No data-quality results found. Run: python -m tests.data_quality")

    st.divider()

    # ---- Load detail ----
    st.subheader("Load — flash-sale funnel")
    if load and load["p95_ms"] is not None:
        l1, l2, l3, l4 = st.columns(4)
        l1.metric("p95 (all)", f"{load['p95_ms']:.0f} ms")
        l2.metric("p99 (all)", f"{load['p99_ms']:.0f} ms" if load["p99_ms"] else "—")
        l3.metric("Checkout p95", f"{load['checkout_p95_ms']:.0f} ms" if load["checkout_p95_ms"] else "—")
        err = load["error_rate"]
        l4.metric("Funnel error rate", f"{err * 100:.2f}%" if err is not None else "—")
    else:
        st.info("No load results found. Run: k6 run --summary-export=reports/load/summary.json tests/load/flash-sale.js")


if __name__ == "__main__":
    main()