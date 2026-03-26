const crypto = require('crypto');
const store = require('./store');

const CHANNEL = process.env.SLACK_CHANNEL_ID;

function verifySignature(req) {
  if (!process.env.GITHUB_WEBHOOK_SECRET) return true;
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

async function addReaction(client, entry, name) {
  try {
    await client.reactions.add({ channel: entry.channel, timestamp: entry.slackTs, name });
  } catch {} // already added — ignore
}

async function removeReaction(client, entry, name) {
  try {
    await client.reactions.remove({ channel: entry.channel, timestamp: entry.slackTs, name });
  } catch {} // not present — ignore
}

module.exports = async function githubHandler(req, res, client) {
  if (!verifySignature(req)) return res.status(401).send('Invalid signature');
  res.status(200).send('OK');

  const event = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  if (event === 'pull_request') await handlePullRequest(payload, client);
  else if (event === 'pull_request_review') await handleReview(payload, client);
};

async function handlePullRequest(payload, client) {
  const { action, pull_request: pr } = payload;
  const prNumber = pr.number;

  if (action === 'opened' || action === 'reopened') {
    const result = await client.chat.postMessage({
      channel: CHANNEL,
      text: `<!here> ${pr.title} :point_down:\n${pr.html_url}`,
    });
    store.set(prNumber, {
      slackTs: result.ts,
      channel: CHANNEL,
      approvals: [],
      hasComments: false,
    });
  }

  if (action === 'closed') {
    const entry = store.get(prNumber);
    if (!entry) return;
    await client.chat.delete({ channel: entry.channel, ts: entry.slackTs });
    store.delete(prNumber);
  }

  // New commits pushed — GitHub auto-dismisses stale reviews, mirror that here
  if (action === 'synchronize') {
    const entry = store.get(prNumber);
    if (!entry || entry.approvals.length === 0) return;
    entry.approvals = [];
    store.set(prNumber, entry);
    await removeReaction(client, entry, 'white_check_mark');
  }
}

async function handleReview(payload, client) {
  const { action, review, pull_request: pr } = payload;
  if (action !== 'submitted' && action !== 'dismissed') return;

  const entry = store.get(pr.number);
  if (!entry) return;

  const reviewer = review.user.login;

  if (action === 'submitted') {
    if (review.state === 'approved') {
      if (!entry.approvals.includes(reviewer)) entry.approvals.push(reviewer);
      entry.hasComments = false;
      store.set(pr.number, entry);

      await addReaction(client, entry, 'white_check_mark');
      if (!entry.hasComments) await removeReaction(client, entry, 'rabbit');
    }

    if (review.state === 'changes_requested') {
      entry.approvals = entry.approvals.filter(a => a !== reviewer);
      entry.hasComments = true;
      store.set(pr.number, entry);

      await addReaction(client, entry, 'rabbit');
      if (entry.approvals.length === 0) await removeReaction(client, entry, 'white_check_mark');
    }
  }

  if (action === 'dismissed') {
    entry.approvals = entry.approvals.filter(a => a !== reviewer);
    store.set(pr.number, entry);
    if (entry.approvals.length === 0) await removeReaction(client, entry, 'white_check_mark');
  }
}
