import React, { useState, useEffect } from 'react';
import { dashboardAPI } from './services/api';
import StatsGrid from './components/StatsGrid';
import CostChart from './components/CostChart';
import RequestsTable from './components/RequestsTable';

function App() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeframe, refreshKey]);

  const loadData = async () => {
    try {
      setError(null);
      const [statsData, requestsData] = await Promise.all([
        dashboardAPI.getStats(timeframe),
        dashboardAPI.getRequests(1, 50)
      ]);
      setStats(statsData);
      setRequests(requestsData.requests || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear the cache?')) {
      try {
        await dashboardAPI.clearCache();
        alert('Cache cleared successfully!');
        setRefreshKey(k => k + 1);
      } catch (err) {
        alert('Failed to clear cache: ' + err.message);
      }
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  if (loading && !stats) {
    return (
      <div className="app">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>LLM Cost Optimizer Dashboard</h1>
        <p>Monitor your AI costs and optimize performance in real-time</p>
      </header>

      <div className="container">
        {error && (
          <div className="error">
            Error loading data: {error}
          </div>
        )}

        <div className="controls">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleClearCache}>
            Clear Cache
          </button>
        </div>

        {stats && <StatsGrid stats={stats} />}

        {stats && stats.costTrend && (
          <div className="chart-section">
            <h2>Cost Savings Over Time</h2>
            <CostChart data={stats.costTrend} />
          </div>
        )}

        <div className="requests-section">
          <h2>Recent Requests</h2>
          <RequestsTable requests={requests} />
        </div>
      </div>
    </div>
  );
}

export default App;
