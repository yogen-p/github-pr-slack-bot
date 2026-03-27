require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const githubHandler = require('./src/github-handler');
const commands = require('./src/commands');

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// GitHub webhook — needs raw body for signature verification
receiver.router.post(
  '/github/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => githubHandler(req, res, app.client),
);

// Respond to @mentions in Slack — replies posted in-thread
app.event('app_mention', async ({ event, say }) => {
  await commands.handle(event, (msg) => say(
    typeof msg === 'string' ? { text: msg, thread_ts: event.ts } : { ...msg, thread_ts: event.ts }
  ));
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('✅ PR Bot running');
})();
