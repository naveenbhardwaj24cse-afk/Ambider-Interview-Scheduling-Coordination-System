const fs = require('fs');
let c = fs.readFileSync('utils/mailer.js', 'utf8');
const sigs = [
  'sendConfirmationEmail(booking, positionTitle, recruiterName)',
  'sendRecruiterNotification(recruiterEmail, candidateName, positionTitle, slotStart, slotEnd)',
  'sendReminderEmail(booking, positionTitle)',
  'sendCancellationEmail(booking)',
  'sendNextRoundEmail(booking)',
  'sendWithdrawalEmail(booking)',
  'sendCandidateWithdrawalNotification(booking)',
  'sendCandidateSelectedNotification(booking)',
  'sendOfferAcceptedNotification(booking)',
  'sendOfferDeclinedNotification(booking)',
  'sendClientRejectionNotification(booking)',
  'sendInterviewerAssignmentNotification(booking, interviewerEmail, positionTitle)',
  'sendHRRequestApprovalNotification(client, hiringRequest)',
  'sendHRRequestRejectionNotification(client, hiringRequest)',
  'sendOfferReExtendedNotification(candidateEmail, booking)',
  'sendShortlistNotification(candidate, booking, position)',
  'sendSlotBookingConfirmationCandidate(candidate, booking, position)',
  'sendRoundPassedNotification(candidate, booking, position)',
  'sendPendingClientApprovalNotification(candidate, booking, position)',
  'sendOfferExtendedNotification(candidate, booking, position)',
  'sendOfferExpiredNotification(candidate, booking)',
  'sendNewApplicationNotification(recruiter, candidate, booking, position, candidateProfile)',
  'sendSlotBookingConfirmationRecruiter(recruiter, candidate, booking, position)',
  'sendRoundResultNotification(recruiter, candidate, booking, position, passed)',
  'sendOfferExpiredNotificationHR(hrEmail, booking)'
];
let idx = 0;
c = c.replace(/    console\.log\('Sending email to:', arguments\[0\]\.email \|\| arguments\[1\]\?\.email\);/g, (match) => {
  return `async function ${sigs[idx++] || 'unknown'} {\n  try {\n${match}`;
});
fs.writeFileSync('utils/mailer.js', c);
console.log('Fixed', idx);
