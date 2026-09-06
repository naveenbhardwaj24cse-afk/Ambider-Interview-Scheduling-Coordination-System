const fs = require('fs');
let code = fs.readFileSync('server/utils/mailer.js', 'utf8');
code = code.replace(/transporter\.verify\([\s\S]*?\}\);/, `transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error);
  } else {
    console.log('✅ SMTP Server is ready to send emails');
  }
});`);
fs.writeFileSync('server/utils/mailer.js', code);
console.log('Done');
