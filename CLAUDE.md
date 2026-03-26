# CLAUDE.md

## Project

**github-pr-slack-bot** — a Node.js Slack bot that tracks GitHub pull request lifecycle and posts updates to a Slack channel.

- Posts a message when a PR is opened
- Reacts with emoji as reviews come in (approved ✅, changes requested 🐰)
- Removes stale reactions when new commits are pushed
- Deletes the Slack message when the PR is merged or closed
- Responds to `@mention` commands for PR status queries

Deployed on Railway. Public open source project.

## File Structure

```
index.js              — entry point, sets up Slack Bolt + GitHub webhook route
src/
  config.js           — all configuration read from env vars (single source of truth)
  github-handler.js   — handles GitHub webhook events (pull_request, pull_request_review)
  commands.js         — handles Slack @mention commands (open prs, needs review, etc.)
  store.js            — persists PR number → Slack message TS mapping to data/store.json
railway.toml          — Railway deployment config
.env.example          — all supported env vars with descriptions
```

## Key Libraries

- `@slack/bolt` — Slack app framework (HTTP mode, not Socket Mode)
- `@octokit/rest` — GitHub API client
- `dotenv` — env var loading

## Architecture

- **Single Express server** — Slack Bolt's `ExpressReceiver` handles `/slack/events`; a separate route on the same server handles `/github/webhook`
- **GitHub webhooks** drive all Slack message posting/updating/deleting
- **Slack mentions** trigger GitHub API queries via Octokit
- **store.js** maps `prNumber → { slackTs, channel, approvals[], hasComments }` and persists to `data/store.json`

## Environment Variables

All config lives in `src/config.js`. See `.env.example` for the full list. Key vars:

| Var | Purpose |
|-----|---------|
| `SLACK_BOT_TOKEN` | Bot token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Verifies Slack requests |
| `SLACK_CHANNEL_ID` | Channel to post PR messages in |
| `GITHUB_TOKEN` | GitHub API auth |
| `GITHUB_WEBHOOK_SECRET` | Verifies GitHub webhook payloads |
| `GITHUB_REPO_OWNER` | Org or username |
| `GITHUB_REPO_NAME` | Repository name |
| `EMOJI_APPROVED` | Reaction for approvals (default: `white_check_mark`) |
| `EMOJI_CHANGES_REQUESTED` | Reaction for changes requested (default: `rabbit`) |
| `MENTION_PREFIX` | Prefix on PR messages (default: `<!here>`) |

## Running Locally

```bash
npm install
cp .env.example .env   # fill in values
npm run dev
```

Use ngrok to expose locally for webhook testing:
```bash
ngrok http 3000
```

## Deployment

Deployed to Railway. `railway.toml` defines the build and start command.
A Railway Volume should be mounted at `/app/data` to persist `store.json` across redeploys.

Webhook endpoints:
- GitHub: `POST /github/webhook`
- Slack events: `POST /slack/events`

## Current State

- Bot is live and deployed at `https://lopay-slack-pr-bot.up.railway.app`
- GitHub webhook configured on `lopay-limited/lopay-merchant-android`
- Slack app installed in the Lopay workspace
- PR posting and emoji reactions are working
- Slack mention commands (`@bot oldest`, etc.) are set up but may need Event Subscriptions verified in the Slack app dashboard