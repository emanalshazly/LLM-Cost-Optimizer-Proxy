import React from 'react';

function RequestsTable({ requests }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (!requests || requests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        No requests yet
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Prompt</th>
            <th>Model</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Saved</th>
            <th>Cache</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request, index) => (
            <tr key={request.requestId || index}>
              <td>{formatTimestamp(request.timestamp)}</td>
              <td title={request.originalPrompt}>
                {truncateText(request.originalPrompt)}
              </td>
              <td>
                <span className="badge info">
                  {request.model?.replace('claude-3-', '').replace('-20240307', '').replace('-20240229', '') || 'N/A'}
                </span>
              </td>
              <td>{request.tokensUsed?.total || 0}</td>
              <td>{formatCurrency(request.cost?.optimized || 0)}</td>
              <td>
                <span className="badge success">
                  {formatCurrency(request.cost?.saved || 0)}
                </span>
              </td>
              <td>
                {request.cacheHit ? (
                  <span className="badge success">HIT</span>
                ) : (
                  <span className="badge warning">MISS</span>
                )}
              </td>
              <td>{request.processingTime || 0}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RequestsTable;
