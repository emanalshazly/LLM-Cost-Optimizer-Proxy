import React from 'react';

function StatsGrid({ stats }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Total Requests</div>
        <div className="stat-value primary">{stats.totalRequests || 0}</div>
        <div className="stat-change">
          {stats.requestsChange > 0 ? '+' : ''}{stats.requestsChange || 0} from previous period
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Cost Saved</div>
        <div className="stat-value success">
          {formatCurrency(stats.totalSaved || 0)}
        </div>
        <div className="stat-change">
          {formatPercent(stats.savingsPercent || 0)} savings rate
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Cache Hit Rate</div>
        <div className="stat-value primary">
          {formatPercent(stats.cacheHitRate || 0)}
        </div>
        <div className="stat-change">
          {stats.totalCacheHits || 0} cache hits
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Avg Processing Time</div>
        <div className="stat-value">{stats.avgProcessingTime || 0}ms</div>
        <div className="stat-change">
          {stats.processingTimeChange > 0 ? '+' : ''}{stats.processingTimeChange || 0}ms change
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Original Cost</div>
        <div className="stat-value">
          {formatCurrency(stats.totalOriginalCost || 0)}
        </div>
        <div className="stat-change">
          Without optimization
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Optimized Cost</div>
        <div className="stat-value success">
          {formatCurrency(stats.totalOptimizedCost || 0)}
        </div>
        <div className="stat-change">
          After optimization
        </div>
      </div>
    </div>
  );
}

export default StatsGrid;
