"""Drive the running ResearchVault app in headless Edge and capture the demo flow.

Requires `pnpm dev` on http://127.0.0.1:5173. Writes PNG screenshots plus the
viewport-relative box of each clicked control to video/capture/shots.json.
"""

import json
import os
import re

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "capture")
VW, VH = 1440, 900

shots = []


def box(loc):
    try:
        b = loc.bounding_box(timeout=4000)
    except Exception:
        return None
    if not b:
        return None
    return [b["x"] / VW, b["y"] / VH, b["width"] / VW, b["height"] / VH]


def snap(page, name, url_label, target=None, caption=""):
    path = os.path.join(OUT, f"{name}.png")
    page.screenshot(path=path)
    shots.append({"name": name, "url": url_label, "target": target, "caption": caption})
    print("captured", name, target is not None)


def button(page, label):
    return page.get_by_role("button", name=re.compile(re.escape(label), re.I)).first


def persona(page, label):
    button(page, "Demo controls").click()
    page.wait_for_timeout(300)
    button(page, label).click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(900)


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        page = browser.new_page(viewport={"width": VW, "height": VH}, device_scale_factor=1.5)
        page.goto(BASE + "/")
        page.wait_for_load_state("networkidle")
        page.evaluate("fetch('/api/demo/reset', {method: 'POST', credentials: 'include'})")
        page.goto(BASE + "/")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1200)

        steps = [
            ("landing", "/"),
            ("researcher", "/researcher"),
            ("denied", "/researcher"),
            ("request", "/researcher"),
            ("governance", "/governance"),
            ("steward", "/governance"),
            ("unlocked", "/researcher"),
        ]
        try:
            snap(page, "01_landing", "/", box(button(page, "Demo controls")),
                 "Open Demo controls and pick a study persona")
            persona(page, "Riley Park")
            snap(page, "02_researcher", "/researcher", box(button(page, "Attempt decrypt")),
                 "Riley, research assistant, tries a restricted record")
            button(page, "Attempt decrypt").click()
            page.wait_for_timeout(1200)
            snap(page, "03_denied", "/researcher", box(button(page, "Request access")),
                 "Denied with 403 MISSING_SCOPE, so she requests access")
            button(page, "Request access").click()
            page.wait_for_timeout(600)
            page.locator("textarea").first.fill("Thematic coding of coded interview transcripts for the wellbeing study.")
            page.wait_for_timeout(300)
            snap(page, "04_request", "/researcher", box(button(page, "Submit request")),
                 "A scoped, reasoned request: RESTRICTED · READ")
            button(page, "Submit request").click()
            page.wait_for_timeout(1200)

            persona(page, "Dr. Sam Taylor")
            snap(page, "05_governance", "/governance", box(button(page, "Propose governed change")),
                 "The head researcher proposes the governed change")
            button(page, "Propose governed change").click()
            page.wait_for_timeout(1800)
            snap(page, "06_pending", "/governance", None, "One approval: 1 of 2, still pending")

            persona(page, "Jordan Lee")
            snap(page, "07_steward", "/governance", box(button(page, "Open Tide approval console")),
                 "The data steward opens the approval console")
            button(page, "Open Tide approval console").click()
            page.wait_for_timeout(900)
            snap(page, "08_sign", "/governance", box(button(page, "Sign as")), "Independent co-signature")
            button(page, "Sign as").click()
            page.wait_for_timeout(1500)
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
            sync = button(page, "Sync provider status")
            target = box(sync)
            sync.click()
            page.wait_for_timeout(1800)
            snap(page, "09_committed", "/governance", target, "Quorum reached: 2 of 2, committed")

            persona(page, "Riley Park")
            refresh = button(page, "Refresh Authorization")
            snap(page, "10_refresh", "/researcher", box(refresh), "Riley refreshes her authorization")
            refresh.click()
            page.wait_for_timeout(2200)
            snap(page, "11_unlocked", "/researcher", None, "Restricted responses decrypt. Identities stay locked")
        except Exception as exc:
            print("stopped early:", type(exc).__name__, str(exc).splitlines()[0])
        browser.close()
    with open(os.path.join(OUT, "shots.json"), "w") as fh:
        json.dump(shots, fh, indent=1)


if __name__ == "__main__":
    main()
