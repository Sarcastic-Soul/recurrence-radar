# Recurrence Radar

**Did your CAPA actually work?**

Recurrence Radar is a Jira app for quality teams in pharma, medtech and manufacturing. When a new deviation is logged, it checks past events and shows:

- how many times this has happened before, and why each one matched
- whether the CAPA raised last time actually worked (closed, then the problem came back)
- the SOP involved and the people who have fixed this before
- a drafted investigation that cites the earlier tickets

Built on Atlassian Forge for Codegeist 2026. All data stays inside Atlassian (Forge SQL + Forge LLM). No outside services.

> Status: early development. Install steps and demo instructions coming soon.

## Development

Requires Node `^22.23.4 || ^24.22.1` and the Forge CLI.

```bash
npm install
cd static/hello-world && npm install && npm run build && cd ../..
forge deploy -e development
forge install -e development
```

Decision support only. Not a validated QMS of record.
