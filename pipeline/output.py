"""Clean terminal summary table for new postings."""
from __future__ import annotations

from datetime import datetime, timezone

from rich.console import Console
from rich.table import Table

from models import Job

console = Console()

_EPOCH = datetime.min.replace(tzinfo=timezone.utc)


def print_jobs(jobs: list[Job], title: str = "New job postings") -> None:
    if not jobs:
        console.print("[dim]No new matching postings this run.[/dim]")
        return

    table = Table(title=f"{title} ({len(jobs)})", show_lines=False, expand=True)
    table.add_column("Company", style="bold cyan", no_wrap=True, max_width=24)
    table.add_column("Title", style="bold")
    table.add_column("Location", max_width=28)
    table.add_column("Posted", no_wrap=True)
    table.add_column("Src", no_wrap=True, style="dim")
    table.add_column("Keywords", style="green", max_width=30)

    for j in sorted(jobs, key=lambda x: x.posted_at or _EPOCH, reverse=True):
        posted = j.posted_at.date().isoformat() if j.posted_at else "—"
        table.add_row(
            j.company,
            j.title,
            j.location or "—",
            posted,
            j.source,
            ", ".join(j.keywords_matched[:3]),
        )
    console.print(table)

    console.print("\n[bold]Links:[/bold]")
    for j in jobs:
        console.print(f"  • {j.company} — {j.title}\n    [blue]{j.url}[/blue]")
