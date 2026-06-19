const walletService = require('../services/walletService');
const { audit } = require('../utils/audit');

async function addRecipient(req, res) {
  const recipient = await walletService.addRecipient(req.user.userId, req.body);
  await audit(req, {
    action: 'recipient.add',
    resourceType: 'recipient',
    resourceId: recipient.recipient_id,
    metadata: { recipientEmail: recipient.email }
  });
  res.status(201).json({ recipient });
}

async function reviewTransfer(req, res) {
  res.json(await walletService.transferReview(req.user.userId, req.body));
}

async function confirmTransfer(req, res) {
  const transaction = await walletService.performTransfer(req.user.userId, req.body);
  await audit(req, {
    action: 'money.transfer',
    resourceType: 'transaction',
    resourceId: transaction.transaction_id,
    metadata: transaction
  });
  res.status(201).json({ transaction });
}

module.exports = { addRecipient, reviewTransfer, confirmTransfer };
