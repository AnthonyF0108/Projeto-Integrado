const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const pw = args[0] || 'change_me';
const rounds = parseInt(args[1]) || 10;

(async () => {
  const hash = await bcrypt.hash(pw, rounds);
  console.log('password:', pw);
  console.log('bcrypt hash:', hash);
})();