import React from 'react';

const StatusBadge = ({ status, type = 'booking' }) => {
  let bg = '#f3f4f6';
  let color = '#374151';
  let text = status;

  if (type === 'booking') {
    if (status === 'confirmed') { bg = '#dcfce7'; color = '#166534'; text = 'Confirmed'; }
    else if (status === 'rejected') { bg = '#fee2e2'; color = '#991b1b'; text = 'Rejected'; }
    else if (status === 'pending_client_approval') { bg = '#dbeafe'; color = '#1e40af'; text = 'Pending Sign-off'; }
    else if (status === 'expired') { bg = '#f3f4f6'; color = 'gray'; text = 'Offer Expired'; }
    else if (status === 'offer_accepted') { bg = '#dcfce7'; color = '#166534'; text = 'Offer Accepted'; }
    else if (status === 'offer_declined') { bg = '#fee2e2'; color = '#991b1b'; text = 'Offer Declined'; }
    else if (status === 'withdrawn') { bg = '#fef3c7'; color = '#92400e'; text = 'Withdrawn'; }
    else if (status === 'cancelled') { bg = '#fee2e2'; color = '#991b1b'; text = 'Cancelled'; }
    else if (status === 'applied') { bg = '#fef3c7'; color = '#92400e'; text = 'Applied'; }
    else if (status === 'selected') { bg = '#dcfce7'; color = '#166534'; text = 'Selected'; }
    else { text = String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); } // Fallback formatting
  } 
  else if (type === 'user') {
    if (status === true || status === 'active') { bg = '#dcfce7'; color = '#166534'; text = 'Active'; }
    else { bg = '#fee2e2'; color = '#991b1b'; text = 'Inactive'; }
  }
  else if (type === 'request') {
    if (status === 'pending_hr_approval') { bg = '#fef3c7'; color = '#92400e'; text = 'Pending HR'; }
    else if (status === 'approved') { bg = '#dcfce7'; color = '#166534'; text = 'Approved'; }
    else if (status === 'rejected') { bg = '#fee2e2'; color = '#991b1b'; text = 'Rejected'; }
    else if (status === 'filled') { bg = '#e0e7ff'; color = '#3730a3'; text = 'Filled'; }
    else { text = String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  }

  return (
    <span style={{ 
      padding: '4px 8px', 
      borderRadius: '4px', 
      fontSize: '12px',
      background: bg,
      color: color,
      fontWeight: status === 'expired' ? 'bold' : 'normal',
      whiteSpace: 'nowrap'
    }}>
      {text}
    </span>
  );
};

export default StatusBadge;
