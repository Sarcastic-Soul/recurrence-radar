# Privacy policy

Last updated: 1 November 2026

Recurrence Radar ("the app") is a Jira Cloud app built on Atlassian Forge.

## What data the app uses

- Issue fields in the Jira projects an admin chooses to watch: summary, description, labels, status, dates, reporter and assignee display names and Atlassian account IDs, and issue links.
- App settings chosen by an admin (watched projects, labels, LLM on/off and daily cap).

## Where the data goes

- All data is stored in Forge SQL inside the customer's Atlassian site installation.
- Text extraction and investigation drafts use Forge LLM, which is hosted by Atlassian. No data is sent to any service outside Atlassian.
- The app has no outside network access (no egress) and no analytics or tracking.

## What the app writes to Jira

- A `recurrence-high` label and an issue property with the latest result on analysed issues.
- Comments, only when a user clicks "Post as comment" (posted as that user).
- Demo issues and a demo project, only when an admin loads demo data. These can be removed from the settings page.

## Retention and deletion

- When an issue is deleted, the app deletes what it stored for that issue.
- Once a week the app reports the account IDs it holds through Atlassian's personal data reporting API. For any closed account, the app deletes the stored names and account IDs.
- Other data stays in the app's Forge SQL storage while the app is installed. Uninstalling the app removes its storage, as handled by the Forge platform.

## Contact

Questions or deletion requests: open an issue at https://github.com/Sarcastic-Soul/recurrence-radar/issues or email anishisbusy@gmail.com.
