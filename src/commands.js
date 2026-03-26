const { Octokit } = require('@octokit/rest');
const config = require('./config');

const octokit = new Octokit({ auth: config.github.token });

module.exports = {
  async handle(event, say) {
    const text = event.text.replace(/<@[^>]+>/g, '').trim().toLowerCase();

    if (text.includes('needs review') || text.includes('no review')) {
      await handleNeedsReview(say);
    } else if (text.includes('approved')) {
      await handleApproved(say);
    } else if (text.includes('oldest')) {
      await handleOldest(say);
    } else if (text.includes('open') || text.includes('prs')) {
      await handleOpen(say);
    } else {
      await say(
        '*Commands:*\n' +
        '• `open prs` — all open PRs with their current status\n' +
        '• `needs review` — PRs with no approvals yet\n' +
        '• `approved` — PRs with at least one approval\n' +
        '• `oldest` — oldest open PR without a review'
      );
    }
  },
};

async function getPRsWithReviews() {
  const { data: prs } = await octokit.pulls.list({
    owner: config.github.owner,
    repo: config.github.repo,
    state: 'open',
    per_page: 50,
  });

  return Promise.all(prs.map(async (pr) => {
    const { data: reviews } = await octokit.pulls.listReviews({
      owner: config.github.owner,
      repo: config.github.repo,
      pull_number: pr.number,
    });

    // Only count the latest review state per reviewer
    const latestByReviewer = {};
    for (const r of reviews) {
      latestByReviewer[r.user.login] = r.state;
    }

    const approvals = Object.entries(latestByReviewer)
      .filter(([, state]) => state === 'APPROVED')
      .map(([login]) => login);

    const hasChangesRequested = Object.values(latestByReviewer)
      .some(state => state === 'CHANGES_REQUESTED');

    const ageDays = Math.floor(
      (Date.now() - new Date(pr.created_at)) / (1000 * 60 * 60 * 24)
    );

    return { ...pr, approvals, hasChangesRequested, ageDays };
  }));
}

function prLine(pr) {
  const status = pr.approvals.length > 0
    ? '✅'
    : pr.hasChangesRequested
      ? '🐰'
      : '👀';
  return `${status} *#${pr.number}* ${pr.title} _(${pr.ageDays}d old)_ — <${pr.html_url}|view>`;
}

async function handleOpen(say) {
  const prs = await getPRsWithReviews();
  if (!prs.length) return say('No open PRs.');
  await say(`*Open PRs (${prs.length}):*\n${prs.map(prLine).join('\n')}`);
}

async function handleNeedsReview(say) {
  const prs = await getPRsWithReviews();
  const pending = prs.filter(pr => pr.approvals.length === 0 && !pr.hasChangesRequested);
  if (!pending.length) return say('No PRs waiting for a first review. 🎉');
  await say(`*Needs review (${pending.length}):*\n${pending.map(prLine).join('\n')}`);
}

async function handleApproved(say) {
  const prs = await getPRsWithReviews();
  const approved = prs.filter(pr => pr.approvals.length > 0);
  if (!approved.length) return say('No approved PRs.');
  const lines = approved.map(
    pr => `✅ *#${pr.number}* ${pr.title} — approved by ${pr.approvals.join(', ')} — <${pr.html_url}|view>`
  );
  await say(`*Approved PRs (${approved.length}):*\n${lines.join('\n')}`);
}

async function handleOldest(say) {
  const prs = await getPRsWithReviews();
  const unreviewed = prs
    .filter(pr => pr.approvals.length === 0)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!unreviewed.length) return say('No unreviewed PRs. 🎉');
  const pr = unreviewed[0];
  await say(`👴 Oldest unreviewed: *#${pr.number}* ${pr.title} — ${pr.ageDays} days old — <${pr.html_url}|view>`);
}