const fs = require('fs');
let code = fs.readFileSync('server/utils/mailer.js', 'utf8');
code = code.replace(/'Mailer error in /g, "'❌ Mailer failed in ");
fs.writeFileSync('server/utils/mailer.js', code);
console.log('Done');
