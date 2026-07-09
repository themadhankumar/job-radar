# Local LinkedIn pipeline (launchd)

GitHub Actions runs the pipeline twice a day but with `--no-linkedin`, because
LinkedIn blocks datacenter IPs. To pull LinkedIn's broad keyword feed, run the
**full** pipeline locally on your Mac (residential IP) on a schedule. It writes
to the same Neon database, so the dashboard sees LinkedIn jobs automatically.

## One-time setup

```bash
cd ~/Documents/GitHub/job-radar/pipeline

# 1) Python environment with the pipeline deps
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2) Secrets — copy the template and fill in real values
cp .env.example .env
#   edit .env → DATABASE_URL, ENCRYPTION_KEY, ANTHROPIC_API_KEY
#   (same values as your GitHub Actions secrets)

# 3) Smoke-test by hand before scheduling it
.venv/bin/python main.py --no-notion
#   watch for "LinkedIn '<query>': N fetched" lines and a clean finish
```

## Install the scheduled job

```bash
# Copy the plist into LaunchAgents
cp ~/Documents/GitHub/job-radar/ops/com.madhankumar.jobradar.plist ~/Library/LaunchAgents/

# Load it (modern launchctl)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.madhankumar.jobradar.plist

# Run it once now to verify (doesn't wait for the schedule)
launchctl kickstart -k gui/$(id -u)/com.madhankumar.jobradar

# Watch the log
tail -f /tmp/jobradar.log
```

It runs at **07:00 and 19:00 local** each day. Adjust the two
`StartCalendarInterval` entries in the plist to taste (fewer/more runs, other
times). After editing the plist, reload it:

```bash
launchctl bootout gui/$(id -u)/com.madhankumar.jobradar
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.madhankumar.jobradar.plist
```

## Notes

- The Mac must be **awake** at the scheduled time (or the run is skipped;
  launchd doesn't wake the machine). If you want missed runs to fire on wake,
  we can switch to a `StartInterval` cadence instead.
- LinkedIn jobs have no `company_id` (they aren't tied to a tracked company),
  so they surface in **Suggested / Global**, never **Tracked**.
- Logs: stdout/stderr also go to `/tmp/jobradar.out` and `/tmp/jobradar.err`.
- To stop it: `launchctl bootout gui/$(id -u)/com.madhankumar.jobradar`.
