const { createApp } = require('./app');
const { env, assertRuntimeSecrets } = require('./config/env');
const logger = require('./utils/logger');

assertRuntimeSecrets();

const app = createApp();

app.listen(env.port, env.host, () => {
  logger.info(`SITWallet backend listening on ${env.host}:${env.port}`);
});
