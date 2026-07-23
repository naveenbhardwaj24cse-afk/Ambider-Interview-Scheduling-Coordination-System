const fs = require('fs');

let code = fs.readFileSync('server/utils/mailer.js', 'utf8');

// We need to carefully replace existing functions or remove them.
const functionsToRemove = [
  'sendShortlistNotification',
  'sendOfferExpiredNotification',
  'sendOfferExpiredNotificationHR',
  'sendOfferExpiredNotificationRecruiter',
  'sendOfferExtendedNotification'
];

functionsToRemove.forEach(fnName => {
  // Find "async function name(..." and the matching closing brace.
  const regex = new RegExp(\`async function \${fnName}\\\\(.*?\\\\) \\{[\\\\s\\\\S]*?\\n\\}\`, 'g');
  code = code.replace(regex, '');
});

const replacements = `
async function sendShortlistNotification(candidate, booking, position) {
  try {
    const companyName = position.companyName || 'the company';
    const emailText = \\\`Congratulations \${candidate.name},\\n\\nYou have been shortlisted for the \${position.title} position at \${companyName}.\\n\\nPlease log in to your Candidate Dashboard to book your interview slot.\\n\\nBest regards,\\nAmbiDer Recruiting\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email,
      subject: \\\`🎉 You've been shortlisted for \${position.title} at \${companyName}\\\`,
      text: emailText
    });
    console.log(\\\`Shortlist email sent to \${candidate.email}\\\`);
  } catch (error) {
    console.error('Error sending shortlist notification email:', error);
  }
}

async function sendSlotBookingConfirmationCandidate(candidate, booking, position) {
  try {
    const { generateICS } = require('./calendarHelper');
    const icsContent = generateICS(booking, candidate, position, { name: 'Recruiter', email: process.env.GMAIL_USER });
    const attachments = [];
    if (icsContent) {
      attachments.push({
        filename: 'invite.ics',
        content: Buffer.from(icsContent, 'utf-8'),
        contentType: 'text/calendar'
      });
    }
    const companyName = position.companyName || 'the company';
    const dateStr = new Date(booking.slotStart).toLocaleString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const endStr = new Date(booking.slotEnd).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    const emailText = \\\`Hello \${candidate.name},\\n\\nYour interview is confirmed.\\n\\nDate/Time: \${dateStr} - \${endStr}\\nRound: \${booking.currentRound} of \${booking.totalRounds}\\n\\nJoin here: \${booking.meetLink}\\n\\nPlease find the calendar invite attached.\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email,
      subject: \\\`📅 Interview Confirmed — \${position.title} at \${companyName} | Round \${booking.currentRound}\\\`,
      text: emailText,
      attachments
    });
    console.log(\\\`Slot booking confirmation sent to candidate \${candidate.email}\\\`);
  } catch (error) {
    console.error('Error sending candidate slot confirmation:', error);
  }
}

async function sendRoundPassedNotification(candidate, booking, position) {
  try {
    const companyName = position.companyName || 'the company';
    const emailText = \\\`Congratulations \${candidate.name},\\n\\nYou have passed Round \${booking.currentRound - 1}!\\n\\nPlease log in to your Candidate Dashboard to book your slot for the next round.\\n\\nBest regards,\\nAmbiDer Recruiting\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email,
      subject: \\\`✅ Round \${booking.currentRound - 1} Passed — \${position.title} at \${companyName}\\\`,
      text: emailText
    });
    console.log(\\\`Round passed email sent to \${candidate.email}\\\`);
  } catch (error) {
    console.error('Error sending round passed notification:', error);
  }
}

async function sendPendingClientApprovalNotification(candidate, booking, position) {
  try {
    const companyName = position.companyName || 'the company';
    const emailText = \\\`Hello \${candidate.name},\\n\\nYou have successfully completed all interview rounds for \${position.title}.\\n\\nYour profile is currently under final review by the client. We will reach out as soon as a decision is made.\\n\\nBest regards,\\nAmbiDer Recruiting\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email,
      subject: \\\`⏳ Final Review in Progress — \${position.title} at \${companyName}\\\`,
      text: emailText
    });
    console.log(\\\`Pending client approval email sent to candidate \${candidate.email}\\\`);
  } catch (error) {
    console.error('Error sending pending client approval notification:', error);
  }
}

async function sendOfferExtendedNotification(candidate, booking, position) {
  try {
    const companyName = position.companyName || 'the company';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    
    const emailText = \\\`Congratulations \${candidate.name},\\n\\nWe are thrilled to extend an offer to you for the position of \${position.title}.\\n\\nThis offer expires on: \${expiryStr}\\n\\nPlease log in to your Candidate Dashboard to accept or decline the offer.\\n\\nBest regards,\\nAmbiDer Recruiting\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email,
      subject: \\\`🎊 Offer Extended — \${position.title} at \${companyName}\\\`,
      text: emailText
    });
    console.log(\\\`Offer extended email sent to \${candidate.email}\\\`);
  } catch (error) {
    console.error('Error sending offer extended notification:', error);
  }
}

async function sendOfferExpiredNotification(candidate, booking) {
  try {
    const positionTitle = booking.positionId?.title || 'the position';
    const emailText = \\\`Hello \${candidate.name || booking.candidateName},\\n\\nYour offer for the position of \${positionTitle} has expired.\\n\\nIf this was unexpected, please contact your recruiter.\\n\\nBest regards,\\nAmbiDer Recruiting\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: candidate.email || booking.candidateEmail,
      subject: \\\`⚠️ Your Offer Has Expired — \${positionTitle}\\\`,
      text: emailText
    });
    console.log(\\\`Offer expired email sent to \${candidate.email || booking.candidateEmail}\\\`);
  } catch (error) {
    console.error('Error sending offer expired notification:', error);
  }
}

async function sendNewApplicationNotification(recruiter, candidate, booking, position, candidateProfile) {
  try {
    const companyName = position.companyName || 'the company';
    const BookingModel = require('../models/Booking');
    const applicantsCount = await BookingModel.countDocuments({ positionId: position._id });
    
    const attachments = [];
    if (candidateProfile && candidateProfile.cvUrl) {
      const fs = require('fs');
      const path = require('path');
      const cvPath = path.join(__dirname, '..', candidateProfile.cvUrl);
      if (fs.existsSync(cvPath)) {
        const ext = path.extname(candidateProfile.cvUrl) || '.pdf';
        attachments.push({
          filename: \\\`\${candidate.name.replace(/\\s+/g, '_')}_CV\${ext}\\\`,
          content: fs.readFileSync(cvPath)
        });
      }
    }
    
    const emailText = \\\`Hello \${recruiter.name},\\n\\n**\${candidate.name}** has applied for \${position.title} at \${companyName} on \${new Date(booking.createdAt).toLocaleDateString()}.\\n\\nThere are now \${applicantsCount} candidates in the pipeline for this position.\\n\\nPlease log in to shortlist or reject this application.\\n\\nBest regards,\\nAmbiDer System\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recruiter.email,
      subject: \\\`📋 New Application — \${candidate.name} for \${position.title} at \${companyName}\\\`,
      text: emailText,
      attachments
    });
    console.log(\\\`New application email sent to recruiter \${recruiter.email}\\\`);
  } catch (error) {
    console.error('Error sending new application notification:', error);
  }
}

async function sendSlotBookingConfirmationRecruiter(recruiter, candidate, booking, position) {
  try {
    const { generateICS } = require('./calendarHelper');
    const icsContent = generateICS(booking, candidate, position, recruiter);
    const attachments = [];
    if (icsContent) {
      attachments.push({
        filename: 'invite.ics',
        content: Buffer.from(icsContent, 'utf-8'),
        contentType: 'text/calendar'
      });
    }
    
    const CandidateProfileModel = require('../models/CandidateProfile');
    const profile = await CandidateProfileModel.findOne({ userId: candidate._id });
    if (profile && profile.cvUrl) {
      const fs = require('fs');
      const path = require('path');
      const cvPath = path.join(__dirname, '..', profile.cvUrl);
      if (fs.existsSync(cvPath)) {
        const ext = path.extname(profile.cvUrl) || '.pdf';
        attachments.push({
          filename: \\\`\${candidate.name.replace(/\\s+/g, '_')}_CV\${ext}\\\`,
          content: fs.readFileSync(cvPath)
        });
      }
    }
    
    const companyName = position.companyName || 'the company';
    const dateStr = new Date(booking.slotStart).toLocaleString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const endStr = new Date(booking.slotEnd).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    const emailText = \\\`Hello \${recruiter.name},\\n\\nAn interview has been scheduled for **\${candidate.name}**.\\n\\nPosition: \${position.title} at \${companyName}\\nRound: \${booking.currentRound} of \${booking.totalRounds}\\nDate/Time: \${dateStr} - \${endStr}\\n\\nJoin here: \${booking.meetLink}\\n\\nBest regards,\\nAmbiDer System\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recruiter.email,
      subject: \\\`📅 Interview Scheduled — \${candidate.name} | \${position.title} | Round \${booking.currentRound} of \${booking.totalRounds}\\\`,
      text: emailText,
      attachments
    });
    console.log(\\\`Slot booking confirmation sent to recruiter \${recruiter.email}\\\`);
  } catch (error) {
    console.error('Error sending recruiter slot confirmation:', error);
  }
}

async function sendRoundResultNotification(recruiter, candidate, booking, position, passed) {
  try {
    const resultIcon = passed ? '✅' : '❌';
    const resultText = passed ? 'Passed' : 'Failed';
    const lastRound = booking.roundHistory && booking.roundHistory.length > 0 ? booking.roundHistory[booking.roundHistory.length - 1].round : booking.currentRound;
    
    const emailText = \\\`Hello \${recruiter.name},\\n\\nResult for **\${candidate.name}**.\\n\\nRound \${lastRound} has been marked as \${resultText}.\\n\\nNext steps: \${passed ? 'Candidate will book the next round slot.' : 'Candidacy has been concluded.'}\\n\\nBest regards,\\nAmbiDer System\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recruiter.email,
      subject: \\\`\${resultIcon} Round \${lastRound} Result — \${candidate.name} | \${position.title}\\\`,
      text: emailText
    });
    console.log(\\\`Round result notification sent to recruiter \${recruiter.email}\\\`);
  } catch (error) {
    console.error('Error sending round result notification:', error);
  }
}

async function sendOfferExpiredNotificationHR(booking) {
  try {
    const hrEmail = process.env.GMAIL_USER;
    const positionTitle = booking.positionId?.title || 'the position';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    
    const emailText = \\\`The offer for \${booking.candidateName} for the \${positionTitle} position has expired on \${expiryStr}.\\n\\nPlease log in to re-extend if needed.\\n\\nAmbiDer System\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: hrEmail,
      subject: \\\`⚠️ Offer Expired: \${booking.candidateName} for \${positionTitle}\\\`,
      text: emailText
    });
  } catch (error) {
    console.error('Error sending HR offer expired notification:', error);
  }
}

async function sendOfferExpiredNotificationRecruiter(recruiter, booking) {
  if (!recruiter) return;
  try {
    const positionTitle = booking.positionId?.title || 'the position';
    const expiryStr = booking.offerExpiresAt ? new Date(booking.offerExpiresAt).toLocaleString() : 'N/A';
    
    const emailText = \\\`The offer for \${booking.candidateName} for the \${positionTitle} position has expired on \${expiryStr}.\\n\\nPlease log in to re-extend if needed.\\n\\nAmbiDer System\\\`;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recruiter.email,
      subject: \\\`⚠️ Offer Expired: \${booking.candidateName} for \${positionTitle}\\\`,
      text: emailText
    });
  } catch (error) {
    console.error('Error sending Recruiter offer expired notification:', error);
  }
}
`;

const newExports = `
module.exports = { 
  sendConfirmation, 
  sendRecruiterNotification, 
  sendReminder, 
  sendCancellation, 
  sendNextRoundInvite, 
  sendWithdrawal, 
  sendCandidateWithdrawalNotification,
  sendCandidateSelectedNotification,
  sendOfferAcceptedNotification,
  sendOfferDeclinedNotification,
  sendClientApprovalPendingNotification,
  sendOfferExtendedNotification,
  sendClientRejectionNotification,
  sendInterviewerAssignmentNotification,
  sendShortlistNotification,
  sendHRRequestApprovalNotification,
  sendHRRequestRejectionNotification,
  sendOfferExpiredNotification,
  sendOfferExpiredNotificationHR,
  sendOfferExpiredNotificationRecruiter,
  sendOfferReExtendedNotification,
  // New ones added
  sendSlotBookingConfirmationCandidate,
  sendRoundPassedNotification,
  sendPendingClientApprovalNotification,
  sendNewApplicationNotification,
  sendSlotBookingConfirmationRecruiter,
  sendRoundResultNotification
};
`;

code = code.replace(/module\.exports\s*=\s*\{[\s\S]*?^};/m, newExports);

fs.writeFileSync('server/utils/mailer.js', code + '\n' + replacements);
console.log('mailer.js patched successfully');
