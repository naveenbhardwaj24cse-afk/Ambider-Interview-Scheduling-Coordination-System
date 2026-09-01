const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, 'server/utils/mailer.js'), 'utf8');

const helpers = `
const { generateICS } = require('./calendarHelper');

async function attachCV(candidateId) {
  try {
    const CandidateProfile = require('../models/CandidateProfile');
    const profile = await CandidateProfile.findOne({ userId: candidateId });
    if (profile?.cvFile?.data) {
      return {
        filename: profile.cvFile.filename || 'Candidate_CV.pdf',
        content: Buffer.isBuffer(profile.cvFile.data) ? profile.cvFile.data : Buffer.from(profile.cvFile.data),
        contentType: profile.cvFile.contentType || 'application/pdf'
      };
    }
  } catch(e) { console.error('Error fetching CV attachment:', e); }
  return null;
}
`;

// Insert helpers if not exists
if (!code.includes('async function attachCV')) {
  code = code.replace(/const fs = require\('fs'\);/, "const fs = require('fs');\n" + helpers);
}

// 1. sendInterviewerAssignmentNotification
code = code.replace(/async function sendInterviewerAssignmentNotification\([\s\S]*?\} catch \(err\) \{[^}]*\}\s*\n\}/, `async function sendInterviewerAssignmentNotification(interviewer, booking, round) {
  try {
    const Position = require('../models/Position');
    const User = require('../models/User');
    const position = await Position.findById(booking.positionId);
    const candidate = await User.findById(booking.candidateId);
    const recruiter = await User.findById(booking.recruiterId);

    const attachments = [];
    const cv = await attachCV(booking.candidateId);
    if (cv) attachments.push(cv);
    
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }
    
    const htmlBody = \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Interview Assignment</h2>
        <p>Hello <strong>\${interviewer.name}</strong>,</p>
        <p>You have been assigned as the interviewer for an upcoming round.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Candidate:</strong> \${candidate.name}</p>
          <p style="margin: 5px 0;"><strong>Position:</strong> \${position.title}</p>
          <p style="margin: 5px 0;"><strong>Round:</strong> \${round} of \${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> \${booking.slotStart ? new Date(booking.slotStart).toLocaleString() : 'TBD'}</p>
        </div>
        \${booking.meetLink ? \`<p><strong>Google Meet Link:</strong> <br/><a href="\${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting Now</a></p>\` : ''}
        <p>The candidate's CV is attached below to help you prepare.</p>
        <br/>
        <p>Best regards,<br/>The Ambider Team</p>
      </div>
    \`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: interviewer.email,
      subject: \`📅 Interview Assignment: \${candidate.name} for \${position.title} (Round \${round})\`,
      html: htmlBody,
      attachments
    });
    console.log(\`Interviewer assignment email sent to \${interviewer.email}\`);
  } catch (err) { console.error('Mailer error in sendInterviewerAssignmentNotification:', err); }
}`);


// 2. sendSlotBookingConfirmationCandidate
code = code.replace(/async function sendSlotBookingConfirmationCandidate\([\s\S]*?\} catch \(err\) \{[^}]*\}\s*\n\}/, `async function sendSlotBookingConfirmationCandidate(candidate, booking, position) {
  try {
    const User = require('../models/User');
    const recruiter = await User.findById(booking.recruiterId);
    
    const attachments = [];
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }

    const htmlBody = \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">Interview Scheduled Successfully!</h2>
        <p>Hello <strong>\${candidate.name}</strong>,</p>
        <p>Your interview for the <strong>\${position.title}</strong> position at \${position.companyName || 'the company'} has been confirmed.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Round:</strong> \${booking.currentRound} of \${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> \${new Date(booking.slotStart).toLocaleString()}</p>
        </div>
        \${booking.meetLink ? \`<p><strong>Google Meet Link:</strong> <br/><a href="\${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting</a></p>\` : ''}
        <p>Please find the calendar invite attached.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer Recruiting</p>
      </div>
    \`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: \`✅ Interview Confirmed - \${position.title}\`,
      html: htmlBody,
      attachments
    });
    console.log(\`Slot confirmation sent to candidate \${candidate.email}\`);
  } catch (err) { console.error('Mailer error in sendSlotBookingConfirmationCandidate:', err); }
}`);


// 3. sendSlotBookingConfirmationRecruiter
code = code.replace(/async function sendSlotBookingConfirmationRecruiter\([\s\S]*?\} catch \(err\) \{[^}]*\}\s*\n\}/, `async function sendSlotBookingConfirmationRecruiter(recruiter, candidate, booking, position) {
  try {
    const attachments = [];
    const cv = await attachCV(booking.candidateId);
    if (cv) attachments.push(cv);
    
    if (booking.slotStart && booking.slotEnd) {
      const icsContent = generateICS(booking, candidate, position, recruiter);
      if (icsContent) {
        attachments.push({
          filename: 'interview-invite.ics',
          content: Buffer.from(icsContent, 'utf-8'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST'
        });
      }
    }

    const htmlBody = \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Interview Scheduled</h2>
        <p>Hello <strong>\${recruiter.name}</strong>,</p>
        <p>An interview has just been booked by a candidate.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Candidate:</strong> \${candidate.name}</p>
          <p style="margin: 5px 0;"><strong>Position:</strong> \${position.title} (\${position.companyName || 'the company'})</p>
          <p style="margin: 5px 0;"><strong>Round:</strong> \${booking.currentRound} of \${booking.totalRounds}</p>
          <p style="margin: 5px 0;"><strong>Date/Time:</strong> \${new Date(booking.slotStart).toLocaleString()}</p>
        </div>
        \${booking.meetLink ? \`<p><strong>Google Meet Link:</strong> <br/><a href="\${booking.meetLink}" style="color: #059669; text-decoration: none; font-weight: bold; background: #ecfdf5; padding: 10px 15px; border-radius: 5px; display: inline-block; margin-top: 10px;">Join Meeting</a></p>\` : ''}
        <p>The candidate's CV and the calendar invite are attached.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer System</p>
      </div>
    \`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: \`📅 Interview Booked: \${candidate.name} for \${position.title}\`,
      html: htmlBody,
      attachments
    });
    console.log(\`Slot booking confirmation sent to recruiter \${recruiter.email}\`);
  } catch (err) { console.error('Mailer error in sendSlotBookingConfirmationRecruiter:', err); }
}`);

// 4. sendShortlistNotification (add CV for HR/Recruiters if they get copied, but it goes to candidate. Wait, let's just make it HTML)
code = code.replace(/async function sendShortlistNotification\([\s\S]*?\} catch \(err\) \{[^}]*\}\s*\n\}/, `async function sendShortlistNotification(candidate, booking, position) {
  try {
    const htmlBody = \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">You've Been Shortlisted!</h2>
        <p>Congratulations <strong>\${candidate.name}</strong>,</p>
        <p>You have been shortlisted for the <strong>\${position.title}</strong> position at \${position.companyName || 'the company'}.</p>
        <p>Please log in to your Candidate Dashboard to book your interview slot.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer Recruiting</p>
      </div>
    \`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: candidate.email,
      subject: \`🎉 You've been shortlisted for \${position.title} at \${position.companyName || 'the company'}\`,
      html: htmlBody
    });
    console.log(\`Shortlist email sent to \${candidate.email}\`);
  } catch (err) { console.error('Mailer error in sendShortlistNotification:', err); }
}`);

// 5. sendNewApplicationNotification (add CV + HTML)
code = code.replace(/async function sendNewApplicationNotification\([\s\S]*?\} catch \(err\) \{[^}]*\}\s*\n\}/, `async function sendNewApplicationNotification(recruiter, candidate, booking, position, candidateProfile) {
  try {
    const attachments = [];
    if (candidateProfile?.cvFile?.data) {
      attachments.push({
        filename: candidateProfile.cvFile.filename || 'CV.pdf',
        content: Buffer.isBuffer(candidateProfile.cvFile.data) ? candidateProfile.cvFile.data : Buffer.from(candidateProfile.cvFile.data),
        contentType: candidateProfile.cvFile.contentType || 'application/pdf'
      });
    } else {
      const cv = await attachCV(booking.candidateId);
      if (cv) attachments.push(cv);
    }
    
    const htmlBody = \`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2563eb;">New Application Received</h2>
        <p>Hello <strong>\${recruiter.name}</strong>,</p>
        <p><strong>\${candidate.name}</strong> has just applied for the <strong>\${position.title}</strong> position at \${position.companyName || 'the company'}.</p>
        <p>Date Applied: \${new Date(booking.createdAt).toLocaleDateString()}</p>
        <p>The candidate's CV is attached to this email.</p>
        <p>Please log in to the dashboard to shortlist or reject this application.</p>
        <br/>
        <p>Best regards,<br/>AmbiDer System</p>
      </div>
    \`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: recruiter.email,
      subject: \`📋 New Application — \${candidate.name} for \${position.title}\`,
      html: htmlBody,
      attachments
    });
    console.log(\`New application email sent to recruiter \${recruiter.email}\`);
  } catch (err) { console.error('Mailer error in sendNewApplicationNotification:', err); }
}`);

// 6. sendPendingClientApprovalNotification (add CV + HTML)
// Wait, this goes to candidate. Does client get an email? 
// Let's modify sendHRRequestApprovalNotification and sendPendingClientApprovalNotification?
// Actually, let's just make it HTML.

fs.writeFileSync(path.join(__dirname, 'server/utils/mailer.js'), code);
console.log('Update script completed.');
