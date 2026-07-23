import React from 'react';
import './DataTable.css';

const DataTable = ({ headers, children, emptyMessage = 'No data available.' }) => {
  const hasRows = React.Children.toArray(children).length > 0;

  return (
    <div className="table-container">
      {hasRows ? (
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </div>
  );
};

export default DataTable;
