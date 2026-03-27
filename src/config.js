module.exports = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  slack: {
    channel: process.env.SLACK_CHANNEL_ID,
  },
  github: {
    owner: process.env.GITHUB_REPO_OWNER,
    repo: process.env.GITHUB_REPO_NAME,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    token: process.env.GITHUB_TOKEN,
  },
  emoji: {
    // Slack emoji names (without colons) used as reactions on PR messages.
    // Override any of these in your .env to use custom emoji from your workspace.
    approved: process.env.EMOJI_APPROVED || 'white_check_mark',
    changesRequested: process.env.EMOJI_CHANGES_REQUESTED || 'rabbit',
  },
  // Notification prefix posted before each PR title. Supports Slack mention syntax.
  // Default: <!here> notifies everyone online. Use <!channel> for everyone, or remove it.
  mentionPrefix: process.env.MENTION_PREFIX !== undefined
    ? process.env.MENTION_PREFIX
    : '<!here>',
  // Comma-separated list of "Name:github_username" pairs, e.g. "Aidan:adlee,John:jsmith"
  teammates: parseTeammates(process.env.TEAMMATES),
};

function parseTeammates(raw) {
  if (!raw) return {};
  return Object.fromEntries(
    raw.split(',')
      .map(entry => entry.trim().split(':').map(s => s.trim()))
      .filter(([name, username]) => name && username)
      .map(([name, username]) => [name.toLowerCase(), username])
  );
}