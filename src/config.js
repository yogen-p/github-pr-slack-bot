module.exports = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  slack: {
    channel: process.env.SLACK_CHANNEL_ID,
  },
  github: {
    // Parsed from GITHUB_REPOS=org/repo1,org/repo2 (preferred) or the legacy
    // GITHUB_REPO_OWNER + GITHUB_REPO_NAME pair. Each entry is { owner, repo }.
    repos: parseRepos(process.env.GITHUB_REPOS, process.env.GITHUB_REPO_OWNER, process.env.GITHUB_REPO_NAME),
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
  // Comma-separated "Name:github_username:slack_user_id" entries.
  // slack_user_id is optional but enables @-tagging PR authors in thread replies.
  // Find Slack user IDs in Slack: click profile → More → Copy member ID (starts with U).
  // Example: TEAMMATES=Aidan:adlee:U012AB3CD,Sarah:schen:U098ZY7WX
  teammates: parseTeammates(process.env.TEAMMATES),
};

function parseRepos(reposEnv, ownerEnv, repoEnv) {
  if (reposEnv) {
    return reposEnv.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(entry => {
        const [owner, repo] = entry.split('/');
        return { owner: owner.trim(), repo: repo.trim() };
      });
  }
  if (ownerEnv && repoEnv) return [{ owner: ownerEnv, repo: repoEnv }];
  return [];
}

function parseTeammates(raw) {
  if (!raw) return {};
  return Object.fromEntries(
    raw.split(',')
      .map(entry => entry.trim().split(':').map(s => s.trim()))
      .filter(([name, username]) => name && username)
      .map(([name, username, slackId]) => [name.toLowerCase(), { username, slackId: slackId || null }])
  );
}