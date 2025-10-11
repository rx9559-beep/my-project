require('dotenv').config();
const { sendMail } = require('../utils/email');

async function run() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node tools/send_test_email.js recipient@example.com');
    process.exit(1);
  }
  try {
    const res = await sendMail(to, 'Test email from Saudi Events', 'This is a test email from your local Saudi Events server.', null);
    console.log('sendMail result:', res);
  } catch (e) {
    console.error('Failed to send test email', e);
    process.exit(1);
  }
}

run();
