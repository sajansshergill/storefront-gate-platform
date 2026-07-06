"""
AI test-gen — turn a business user story into a Playwright test skeleton.

This is the bridge between product intent and coverage. A PM writes an
acceptance criterion in plain English; this tool generates a Playwright spec
that uses THIS framework's fixtures and page objects (not generic boilerplate),
so the output drops into tests/e2e/generated/ and runs.

It satisfies two things at once:
  * "AI-assisted test generation" — the generation itself.
  * "Translate business features into automated testing strategies" — it forces
    a clean hand-off from acceptance criteria to executable coverage.

The generated test is a STARTING POINT for a human to review and refine — not a
replacement for judgement. It gets the scaffolding, selectors, and assertions
80% of the way so the engineer spends time on edge cases, not plumbing.

Usage:
  export ANTHROPIC_API_KEY=...
  python tools/ai-testgen/generate.py --story "As a shopper, I can apply a promo code at checkout and see the discount reflected in my order total."
  python tools/ai-testgen/generate.py --story-file tools/ai-testgen/sample_story.md
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "tests" / "e2e" / "generated"

# The framework's public API, given to the model so generated tests fit the
# codebase conventions instead of inventing their own.
FRAMEWORK_CONTEXT = """
This project has a Playwright framework with these conventions:

- Import test primitives from the custom fixtures, NOT from @playwright/test directly:
    import { test, expect } from '../../../src/framework/fixtures/test-fixtures.js';

- Available fixtures (destructure from the test callback argument):
    productPage(handle: string) -> ProductPage   // .goto(), .getTitle(), .getDisplayedPrice(), .selectVariant(label), .addToCart()
    cartPage: CartPage                            // .goto(), .getLineItemPrice(title), .getQuantity(title), .getSubtotal(), .proceedToCheckout()
    checkoutPage: CheckoutPage                    // .fillContact(customer), .fillShipping(address, customer), .selectShippingMethod(), .payWithTestCard(), .getReviewLineItemPrice(title), .placeOrder(), .getConfirmationOrderNumber()
    accountPage: AccountPage                      // .register(customer), .login(customer), .isLoggedIn(), .getMostRecentOrderNumber()
    db: DbClient                                  // .getLatestOrderIdByEmail(email), .getOrderLineItems(orderId), .getOrderTotals(orderId)

- Test data helpers:
    import { newCustomer, defaultShipping } from '../../../src/framework/utils/data-factory.js';
    import { priceToCents } from '../../../src/framework/utils/db-client.js';

- All money comparisons use priceToCents() to compare integer cents.
- Prefer asserting against the DATABASE (via db) as the source of truth when the
  story involves prices, totals, or persisted order state — that is this
  framework's signature strength.
- Tag smoke-critical tests with @smoke in the describe or test title.
- Seeded product handle available in the demo store: 'medusa-sweatpants'.
""".strip()

SYSTEM_PROMPT = f"""You are a senior SDET generating Playwright end-to-end tests for an eCommerce storefront.
{FRAMEWORK_CONTEXT}

Given a user story, produce ONE TypeScript Playwright spec file that:
1. Uses only the fixtures and helpers described above.
2. Covers the happy path plus at least one meaningful edge/negative case.
3. Asserts against the database as source of truth when prices or orders are involved.
4. Is realistic and runnable — no invented fixtures or page methods.

Respond with ONLY the TypeScript file contents. No markdown fences, no prose."""


def build_client():
    try:
        import anthropic  # imported lazily so the file compiles without the SDK
    except ImportError:
        print("Missing dependency: pip install anthropic", file=sys.stderr)
        sys.exit(2)
    return anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


def generate(story: str) -> str:
    client = build_client()
    message = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"User story:\n{story}"}],
    )
    # Concatenate text blocks; strip stray code fences defensively.
    text = "".join(block.text for block in message.content if block.type == "text")
    return re.sub(r"^```[a-zA-Z]*\n?|```$", "", text.strip(), flags=re.MULTILINE).strip()


def slug(story: str) -> str:
    words = re.sub(r"[^a-z0-9\s]", "", story.lower()).split()[:5]
    return "_".join(words) or "generated_test"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a Playwright spec from a user story.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--story", help="User story / acceptance criterion text")
    group.add_argument("--story-file", help="Path to a file containing the story")
    parser.add_argument("--dry-run", action="store_true", help="Print instead of writing a file")
    args = parser.parse_args()

    story = args.story or Path(args.story_file).read_text().strip()
    spec = generate(story)

    if args.dry_run:
        print(spec)
        return 0

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{slug(story)}.spec.ts"
    out_path.write_text(spec + "\n")
    print(f"Generated: {out_path}")
    print("Review and refine before committing — this is a scaffold, not a final test.")
    return 0


if __name__ == "__main__":
    sys.exit(main())