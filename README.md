# GitHub PR Slack Bot

A lightweight Slack bot that keeps your team's pull request activity visible without leaving Slack.

When a PR is opened it posts a message to your channel. As the PR progresses, the bot reacts to that message with emoji to reflect its state. When the PR is merged or closed, the message is deleted automatically.

**Reactions**

| Emoji | Meaning |
|-------|---------|
| ✅ `white_check_mark` | PR has at least one approval |
| 🐰 `rabbit` | Changes have been requested |

Both emoji are configurable — swap them for any standard or custom Slack emoji.

**Slash commands** (mention the bot in any channel it's in)

| Command | Response |
|---------|----------|
| `@bot open prs` | All open PRs with their current status |
| `@bot needs review` | PRs with no approvals yet |
| `@bot approved` | PRs with at least one approval |
| `@bot oldest` | The oldest open PR without a review |

---

## Setup

### 1. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions → Bot Token Scopes** — add:
   - `chat:write`, `chat:delete`, `reactions:write`, `reactions:read`
   - `app_mentions:read`, `channels:history`
3. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`)
4. Copy the **Signing Secret** from **Basic Information**

### 2. Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

1. Fork this repo
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select your fork, set the root directory to `/`
4. Add all variables from `.env.example` under **Variables**
5. Add a **Volume** mounted at `/app/data` to persist PR state across deploys
6. Copy the public Railway URL — you'll need it for the next steps

### 3. Connect Slack Events

In your Slack app settings:

1. **Event Subscriptions** → enable, set Request URL to:
   ```
   https://your-railway-url.railway.app/slack/events
   ```
2. **Subscribe to bot events**: `app_mention`
3. Save changes and reinstall the app if prompted

### 4. Add a GitHub Webhook

In your GitHub repo → **Settings → Webhooks → Add webhook**:

- **Payload URL**: `https://your-railway-url.railway.app/github/webhook`
- **Content type**: `application/json`
- **Secret**: the value you set for `GITHUB_WEBHOOK_SECRET`
- **Events**: select **Pull requests** and **Pull request reviews**

### 5. Invite the bot to your channel

```
/invite @your-bot-name
```

---

## Configuration

All configuration is done through environment variables. See `.env.example` for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_BOT_TOKEN` | ✅ | — | Bot token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | ✅ | — | From Slack app Basic Information |
| `SLACK_CHANNEL_ID` | ✅ | — | Channel to post PR messages in |
| `GITHUB_TOKEN` | ✅ | — | Personal access token (`repo`, `read:org`) |
| `GITHUB_WEBHOOK_SECRET` | ✅ | — | Secret set on the GitHub webhook |
| `GITHUB_REPO_OWNER` | ✅ | — | GitHub org or username |
| `GITHUB_REPO_NAME` | ✅ | — | Repository name |
| `EMOJI_APPROVED` | — | `white_check_mark` | Reaction emoji for approvals |
| `EMOJI_CHANGES_REQUESTED` | — | `rabbit` | Reaction emoji for changes requested |
| `MENTION_PREFIX` | — | `<!here>` | Prefix on PR messages (`<!channel>`, empty to disable) |

---

## Running locally

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev
```

Use [ngrok](https://ngrok.com) to expose your local server for Slack and GitHub webhooks during development:

```bash
ngrok http 3000
```

Set both webhook URLs to your ngrok URL while testing.

---

## How it works

- **PR opened/reopened** → bot posts to Slack, stores the message timestamp
- **PR review approved** → adds ✅, removes 🐰
- **PR changes requested** → adds 🐰, removes ✅ if no other approvals remain
- **PR review dismissed** → re-evaluates and removes ✅ if no approvals remain
- **New commits pushed** → clears approvals, removes ✅ (mirrors GitHub's stale review behaviour)
- **PR merged or closed** → deletes the Slack message

State is persisted to `data/store.json`. Mount a Railway Volume at `/app/data` to survive redeploys.

---

## License

MIT
