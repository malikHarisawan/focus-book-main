"""Extract the active Chrome/Brave tab's URL and domain via UI Automation.

Returns JSON on stdout with a stable contract consumed by the Electron preload:
  {
    "active_app": "<full url or ''>",   # used by JS as active_url
    "domain":     "<clean host or ''>", # used by JS as active_domain (preferred)
    "url":        "<full url or ''>",   # used by JS only for fallback detection
    "title":      "<window title>",     # used by JS only for fallback detection
    "app_name":   "chrome.exe"
  }

Robustness goals (the previous version failed for many tabs because it grabbed the
FIRST Edit control and relied solely on get_value()):
  * Find the address bar by NAME ("Address and search bar" + localized variants),
    then fall back to scanning every Edit descendant for a URL-looking value.
  * Read the value via the UIA ValuePattern first, then get_value(), then text.
  * If the address bar is genuinely unreadable, derive a domain from the window
    title so popular sites (Reddit, YouTube, ...) still group correctly.
  * Never crash: always print JSON and exit 0 so the Node wrapper gets a result.
"""

import json
import re
import sys
from urllib.parse import urlparse

# Names Chrome/Brave give the omnibox Edit control across locales. Matched
# case-insensitively as a substring so minor wording differences still hit.
ADDRESS_BAR_NAMES = (
    "address and search bar",
    "address bar",
    "search or type",  # "Search or type a URL" placeholder wording
    "address",
)

URL_LIKE = re.compile(r"^[a-z][a-z0-9+.-]*://", re.IGNORECASE)
# A bare host typed without scheme, e.g. "reddit.com/r/foo" or "youtube.com".
HOST_LIKE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+(/|$|:)", re.IGNORECASE)


def _normalize_domain(host):
    """Strip www. and any :port, lowercase."""
    if not host:
        return ""
    host = host.strip().lower()
    host = re.sub(r"^www\.", "", host)
    host = host.split(":")[0]
    return host


def _to_url_and_domain(raw):
    """Turn an omnibox string into (full_url, clean_domain) or ('', '')."""
    if not raw:
        return "", ""
    value = raw.strip()
    if not value:
        return "", ""

    # Chrome shows some internal pages without a scheme (e.g. chrome://newtab).
    if value.startswith(("chrome://", "edge://", "brave://", "about:")):
        return value, _normalize_domain(value.split("://")[-1].split("/")[0])

    if URL_LIKE.match(value):
        url = value
    elif HOST_LIKE.match(value):
        url = "https://" + value
    else:
        # Not a URL (could be a search term the user typed) — no domain.
        return "", ""

    netloc = urlparse(url).netloc
    domain = _normalize_domain(netloc)
    if not domain:
        return "", ""
    return url, domain


def _read_value(ctrl):
    """Read an Edit control's value via the most reliable API available."""
    # 1) UIA ValuePattern — the canonical way to read an editable control's text.
    try:
        val = ctrl.iface_value.CurrentValue
        if val:
            return val
    except Exception:
        pass
    # 2) pywinauto's get_value() wrapper.
    try:
        val = ctrl.get_value()
        if val:
            return val
    except Exception:
        pass
    # 3) Visible text as a last resort.
    try:
        val = ctrl.window_text()
        if val:
            return val
    except Exception:
        pass
    return ""


def _find_address_bar(dlg):
    """Return the omnibox value string, or '' if it can't be found/read."""
    # First choice: locate the Edit whose accessible name is the address bar.
    try:
        for edit in dlg.descendants(control_type="Edit"):
            try:
                name = (edit.element_info.name or "").lower()
            except Exception:
                name = ""
            if any(n in name for n in ADDRESS_BAR_NAMES):
                value = _read_value(edit)
                if value:
                    return value
    except Exception:
        pass

    # Fallback: scan every Edit and take the first whose value looks like a URL.
    try:
        for edit in dlg.descendants(control_type="Edit"):
            value = _read_value(edit)
            if value and (URL_LIKE.match(value) or HOST_LIKE.match(value)):
                return value
    except Exception:
        pass

    return ""


def _domain_from_title(title):
    """Best-effort domain guess from a browser window title.

    Chrome titles look like "<page> - Google Chrome". This can't recover an
    arbitrary domain, but it lets popular sites still resolve when the omnibox
    is unreadable. Only returns something for clearly host-shaped fragments.
    """
    if not title:
        return "", ""
    cleaned = re.sub(r"\s*-\s*(Google Chrome|Brave|Chromium)\s*$", "", title, flags=re.IGNORECASE).strip()
    # If a fragment already looks like a host (e.g. "reddit.com"), use it.
    for part in re.split(r"\s*[-|:]\s*", cleaned):
        part = part.strip()
        if HOST_LIKE.match(part):
            return _to_url_and_domain(part)
    return "", ""


def get_active_chrome_tab(pid):
    result = {
        "active_app": "",
        "domain": "",
        "url": "",
        "title": "",
        "app_name": "chrome.exe",
    }
    try:
        # Import here so a missing pywinauto still yields valid JSON (exit 0).
        from pywinauto.application import Application

        app = Application(backend="uia")
        app.connect(process=pid)
        dlg = app.top_window()

        try:
            result["title"] = dlg.window_text() or ""
        except Exception:
            result["title"] = ""

        raw = _find_address_bar(dlg)
        url, domain = _to_url_and_domain(raw)

        if not domain:
            # Omnibox unreadable (focused elsewhere, PWA window, etc.) — try title.
            url, domain = _domain_from_title(result["title"])

        result["active_app"] = url
        result["url"] = url
        result["domain"] = domain
        return result
    except Exception as e:
        # Keep the contract intact; surface the reason for debugging via stderr.
        print(str(e), file=sys.stderr)
        return result


if __name__ == "__main__":
    try:
        pid = int(sys.argv[1])
    except (IndexError, ValueError):
        print(json.dumps({"active_app": "", "domain": "", "url": "", "title": "", "app_name": "chrome.exe"}))
        sys.exit(0)

    print(json.dumps(get_active_chrome_tab(pid)))
    sys.exit(0)
