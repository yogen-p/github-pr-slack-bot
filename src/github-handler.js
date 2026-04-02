const crypto = require('crypto');
const store = require('./store');
const config = require('./config');

function verifySignature(req) {
  if (!config.github.webhookSecret) return true;
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', config.github.webhookSecret)
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

function slackMention(githubLogin) {
  const entry = Object.values(config.teammates).find(t => t.username === githubLogin);
  if (entry?.slackId) return `<@${entry.slackId}>`;
  return `@${githubLogin}`;
}

function isTeammate(githubLogin) {
  return Object.values(config.teammates).some(t => t.username === githubLogin);
}

async function postThreadReply(client, entry, text) {
  try {
    await client.chat.postMessage({
      channel: entry.channel,
      thread_ts: entry.slackTs,
      text,
    });
  } catch (err) {
    console.error('Failed to post thread reply:', err.message);
  }
}

module.exports = async function githubHandler(req, res, client) {
  if (!verifySignature(req)) return res.status(401).send('Invalid signature');
  res.status(200).send('OK');

  const event = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  if (event === 'pull_request') await handlePullRequest(payload, client);
  else if (event === 'pull_request_review') await handleReview(payload, client);
};

function storeKey(payload) {
  return `${payload.repository.full_name}#${payload.pull_request.number}`;
}

async function handlePullRequest(payload, client) {
  const { action, pull_request: pr } = payload;
  const key = storeKey(payload);
  const channel = config.slack.channel;

  if (action === 'opened' || action === 'reopened') {
    const prefix = config.mentionPrefix ? `${config.mentionPrefix} ` : '';
    const result = await client.chat.postMessage({
      channel,
      text: `${prefix}${pr.title} :point_down:\n${pr.html_url}`,
    });
    store.set(key, {
      slackTs: result.ts,
      channel,
      approvals: [],
      hasComments: false,
      authorLogin: pr.user.login,
    });
  }

  if (action === 'closed') {
    const entry = store.get(key);
    if (!entry) return;
    await client.chat.delete({ channel: entry.channel, ts: entry.slackTs });
    store.delete(key);
  }

  // New commits — clear approvals to reflect GitHub's stale review dismissal
  if (action === 'synchronize') {
    const entry = store.get(key);
    if (!entry || entry.approvals.length === 0) return;
    entry.approvals = [];
    store.set(key, entry);
    await removeReaction(client, entry, config.emoji.approved);
  }
}

async function handleReview(payload, client) {
  const { action, review, pull_request: pr } = payload;
  if (action !== 'submitted' && action !== 'dismissed') return;

  const key = storeKey(payload);
  const entry = store.get(key);
  if (!entry) return;

  const reviewer = review.user.login;

  if (action === 'submitted') {
    if (review.state === 'approved') {
      if (!entry.approvals.includes(reviewer)) entry.approvals.push(reviewer);
      entry.hasComments = false;
      store.set(key, entry);

      await addReaction(client, entry, config.emoji.approved);
      await removeReaction(client, entry, config.emoji.changesRequested);

      const author = slackMention(entry.authorLogin);
      await postThreadReply(client, entry, `${author} your PR was approved by *${reviewer}* :white_check_mark:`);
    }

    if (review.state === 'changes_requested') {
      entry.approvals = entry.approvals.filter(a => a !== reviewer);
      entry.hasComments = true;
      store.set(key, entry);

      await addReaction(client, entry, config.emoji.changesRequested);
      if (entry.approvals.length === 0) {
        await removeReaction(client, entry, config.emoji.approved);
      }

      const author = slackMention(entry.authorLogin);
      const suffix = reviewer === 'coderabbitai' ? ' :rabbit:' : '';
      await postThreadReply(client, entry, `${author} *${reviewer}* requested changes on your PR${suffix}`);
    }

    if (review.state === 'commented' && isTeammate(reviewer)) {
      const author = slackMention(entry.authorLogin);
      await postThreadReply(client, entry, `${author} *${reviewer}* left a comment on your PR`);
    }
  }

  if (action === 'dismissed') {
    entry.approvals = entry.approvals.filter(a => a !== reviewer);
    store.set(key, entry);
    if (entry.approvals.length === 0) {
      await removeReaction(client, entry, config.emoji.approved);
    }
  }
}