# Recurrence Radar

**Did your CAPA actually work?**

Recurrence Radar is a Jira app for quality teams in pharma, medtech and manufacturing. When a new deviation is logged, it checks past events and shows:

- how many times this has happened before, and why each one matched
- whether the CAPA raised last time actually worked (closed, then the problem came back)
- the SOP involved and the people who have fixed this before
- a drafted investigation that cites the earlier tickets, ready to post as a comment

Built on Atlassian Forge for Codegeist 2026. All data stays inside Atlassian (Forge SQL + Forge LLM). The app calls no outside services and qualifies for "Runs on Atlassian".

## Try it in two minutes

1. Install the app into a Jira Cloud site using the [installation link](https://developer.atlassian.com/console/install/8ed0b7f6-9b89-454e-8a68-85e9c99daf0b?signature=AYABeJujHPoafTX6XDGDK7HepVgAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBFBOKhtAipl5F9lKUf8nUDQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDLsMrgjDKFpH95DVUgIBEIA7PXrh%2B2r7Y2Deut3KS%2FtZsaAOENbT%2FJt%2BtRqWw6F%2FjTmDt%2BjujV9sK3RNavSeAYpK%2BY4h%2B1kAZEJkvvUAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgF7c4YExuOQqkkjoWnI5mwrAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQM8FC2vrMctUTwADcpAgEQgDsdhWK8OBaF6tFdkNB7PNhn%2B3BewfT%2Bqpz2vT6m%2FdjmFjBvgQLJYDkF2oJnsTApP3t9jfn%2BCd4P79Gw%2BAAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAd6F3aC1aHKFqHLjcHQBjhkAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwqNuPyRIO%2BxG3GB0wCARCAO0iZd5GqS7LQoqHwp%2F%2FvPdxHROEoAP8E2Ne%2FwhhUt8EhBxFIhhgl%2Fcul%2BRxo3DsHkAyG%2Bov36n5V7bLsAgAAAAAMAAAQAAAAAAAAAAAAAAAAAI4JaqxE2IiXbPtGDj2M9VP%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJOyCfVC7S2OqBX5oTpNBPlB20BVtDClwseHQicNIWEYWMJI9oR6Sw5aVLglgbjPxj3pQ5EEOYTZlBpNOykmxplaw4%3D&product=jira).
2. Open **Jira settings > Apps > Recurrence Radar**.
3. Under **Demo data**, pick **Create a new demo project** and click **Load demo QMS**. The app creates a project called *Northwind Quality (demo)* with 6 SOPs, 40 deviations and 8 CAPAs spread over 18 months. This takes under a minute.
4. Create a new issue in that project, for example:
   - Summary: `Tablet weight out of spec on Press 4 during compression, batch B2291`
   - Description: `The 15-minute in-process weight check on press 4 failed: average tablet weight 1,037 mg against 1,000 mg target. Batch on hold. Maintenance asked to inspect the punches.`
5. Open the issue. The **Recurrence check** glance shows **High**, and the panel says the Press 4 punch CAPA was closed months ago and the problem has come back 3 times since. It names Ravi Patel as the person who fixed it each time and points at SOP-012.
6. Click **Draft investigation**, review the text, and post it as a comment.
7. Open the project sidebar item **Recurrence Radar** for the overview: open high-risk deviations, CAPAs that did not hold, top equipment and failure modes, and an 18-month timeline.

To remove the demo, use **Remove demo data** on the same settings page. In the app-created demo project this also deletes issues you created while trying it out.

## Using it on real data

- In the settings page, pick the projects to watch.
- Issues labelled `capa` are treated as CAPAs, `sop` as SOPs, everything else in a watched project as a deviation. The labels can be changed.
- Link a CAPA to the deviations it addresses with any Jira issue link. A CAPA counts as "likely ineffective" when similar deviations happen after it was closed.
- Forge LLM is used to pull equipment, product, failure mode and root cause out of free text. If it is turned off or the daily cap is reached, a rules-based extractor is used instead.

## How it works

```
issue created/updated ─► trigger ─► queue ─► consumer
                                              │
                         Forge LLM (extract) ◄┤
                                              ▼
                      Forge SQL: events, links, analysis
                                              │
         panel / glance / overview ◄── resolvers (invoke)
```

- `src/core/` scoring logic (pure functions, unit tested): similarity, recurrence stats, CAPA effectiveness, expert ranking, SOP pick, headline, investigation draft.
- `src/services/` analysis pipeline, demo loader, settings, LLM wrapper with a daily cap.
- `src/db/` Forge SQL schema migrations and queries.
- `static/ui/` Custom UI (React 18 + Vite), one build per module, Atlassian design tokens, light and dark themes.

## Development

Requires Node `^22.23.4 || ^24.22.1` and the Forge CLI.

```bash
npm install
cd static/ui && npm install && cd ../..
npm run build:ui
npm test
forge deploy -e development
forge install -e development
```

## Privacy

See [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md). Support: open an issue on this repository.

Decision support only. Not a validated QMS of record. Always review results before acting on them.
