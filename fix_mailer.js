const fs = require('fs');

let code = fs.readFileSync('server/utils/mailer.js', 'utf8');

// Replace standard catch blocks
const regex = /async function\s+([a-zA-Z0-9_]+)\s*\([\s\S]*?catch\s*\([^)]+\)\s*\{[^}]*?\}/g;
code = code.replace(regex, (match, funcName) => {
  return match.replace(/catch\s*\([^)]+\)\s*\{[^}]*?\}/, `catch (err) { console.error('Mailer error in ${funcName}:', err); }`);
});

// Fix attachments
code = code.replace(/if\s*\([^)]*cvFile\.data\)\s*\{\s*attachments\.push\(\{\s*filename:.*?\s*content:.*?,\s*contentType:.*?\s*\}\);\s*\}/g, (match) => {
  let isCandidateProfile = match.includes('candidateProfile');
  let objName = isCandidateProfile ? 'candidateProfile' : 'profile';
  return `if (${objName}?.cvFile?.data) {
      attachments.push({
        filename: ${objName}.cvFile.filename || 'CV.pdf',
        content: Buffer.isBuffer(${objName}.cvFile.data) ? ${objName}.cvFile.data : Buffer.from(${objName}.cvFile.data),
        contentType: ${objName}.cvFile.contentType || 'application/pdf'
      });
    }`;
});

fs.writeFileSync('server/utils/mailer.js', code);
console.log('Done');
