"""Render markdown resume → HTML → PDF via Playwright (already a dep)."""

from __future__ import annotations
from pathlib import Path
import re

CSS = """
@page { size: A4; margin: 16mm 14mm; }
body { font-family: 'Inter', 'Helvetica Neue', system-ui, sans-serif; font-size: 10.5pt; color:#111; line-height:1.4; }
h1 { font-size: 20pt; margin: 0 0 4pt 0; }
h2 { font-size: 12pt; margin: 14pt 0 2pt; border-bottom:1px solid #ddd; padding-bottom:2pt; text-transform: uppercase; letter-spacing: .03em; }
h3 { font-size: 11pt; margin: 8pt 0 0; }
p, li { margin: 2pt 0; }
ul { padding-left: 16pt; margin: 2pt 0 8pt; }
strong { font-weight: 600; }
em { color:#444; }
hr { border: 0; border-top: 1px solid #eee; margin: 6pt 0; }
"""


def _md_to_html(md: str) -> str:
    """Tiny zero-dep markdown → HTML. Good enough for resumes (headings, lists, bold, italic, links)."""
    out_lines = []
    in_list = False
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            if in_list:
                out_lines.append("</ul>")
                in_list = False
            out_lines.append("")
            continue
        # headings
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            if in_list:
                out_lines.append("</ul>")
                in_list = False
            level = len(m.group(1))
            out_lines.append(f"<h{level}>{_inline(m.group(2))}</h{level}>")
            continue
        # bullets
        if re.match(r"^[\-\*]\s+", line):
            if not in_list:
                out_lines.append("<ul>")
                in_list = True
            out_lines.append(f"<li>{_inline(re.sub(r'^[\-\*]\s+', '', line))}</li>")
            continue
        # paragraph
        if in_list:
            out_lines.append("</ul>")
            in_list = False
        out_lines.append(f"<p>{_inline(line)}</p>")
    if in_list:
        out_lines.append("</ul>")
    return "\n".join(out_lines)


def _inline(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", s)
    return s


def render_pdf(md_path: Path, pdf_path: Path) -> Path:
    """Render the markdown file at md_path to PDF at pdf_path. Returns pdf_path."""
    from playwright.sync_api import sync_playwright

    md = Path(md_path).read_text()
    html = f"""<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head>
<body>{_md_to_html(md)}</body></html>"""
    pdf_path = Path(pdf_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html, wait_until="domcontentloaded")
        page.pdf(path=str(pdf_path), format="A4", print_background=True)
        browser.close()
    return pdf_path
