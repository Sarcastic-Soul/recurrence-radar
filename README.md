# Recurrence Radar

**Did your CAPA actually work?**

Recurrence Radar is a Jira app for quality teams in pharma, medtech and manufacturing. When a new deviation is logged, it checks past events and shows:

- how many times this has happened before, and why each one matched
- whether the CAPA raised last time actually worked (closed, then the problem came back)
- the SOP involved and the people who have fixed this before
- a drafted investigation that cites the earlier tickets, ready to post as a comment

Built on Atlassian Forge for Codegeist 2026. All data stays inside Atlassian (Forge SQL + Forge LLM). The app calls no outside services and qualifies for "Runs on Atlassian".

## Try it in two minutes

1. Install the app into a Jira Cloud site (installation link on the Marketplace listing or Devpost page).
2. Open **Jira settings > Apps > Recurrence Radar**.
3. Under **Demo data**, pick **Create a new demo project** and click **Load demo QMS**. The app creates a project called *Northwind Quality (demo)* with 6 SOPs, 40 deviations and 8 CAPAs spread over 18 months. This takes under a minute.
4. Create a new issue in that project, for example:
   - Summary: `Tablet weight out of spec on Press 4 during compression, batch B2291`
   - Description: `The 15-minute in-process weight check on press 4 failed: average tablet weight 1,037 mg against 1,000 mg target. Batch on hold. Maintenance asked to inspect the punches.`
5. Open the issue. The **Recurrence check** glance shows **High**, and the panel says the Press 4 punch CAPA closed in April and the problem has come back 3 times since. It names Ravi Patel as the person who fixed it each time and points at SOP-012.
6. Click **Draft investigation**, review the text, and post it as a comment.
7. Open the project sidebar item **Recurrence Radar** for the overview: open high-risk deviations, CAPAs that did not hold, top equipment and failure modes, and an 18-month timeline.

To remove the demo, use **Remove demo data** on the same settings page.

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

See [PRIVACY.md](PRIVACY.md). Support: open an issue on this repository.

Decision support only. Not a validated QMS of record. Always review results before acting on them.
