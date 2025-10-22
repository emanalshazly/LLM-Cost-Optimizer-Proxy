import axios from 'axios';

const DASHBOARD_URL = 'http://localhost:3001/api/dashboard';

async function dashboardExample() {
  console.log('📊 Dashboard API Usage Example\n');

  try {
    // Get statistics
    console.log('1. Fetching statistics for last 24 hours...');
    const stats = await axios.get(`${DASHBOARD_URL}/stats?timeframe=24h`);

    console.log('📈 Statistics:');
    console.log('   Total Requests:', stats.data.totalRequests);
    console.log('   Cache Hit Rate:', `${stats.data.cacheHitRate}%`);
    console.log('   Total Cost Saved:', `$${stats.data.totalSaved.toFixed(4)}`);
    console.log('   Savings Percent:', `${stats.data.savingsPercent}%`);
    console.log('   Avg Processing Time:', `${stats.data.avgProcessingTime}ms`);
    console.log('');

    // Get model usage
    if (stats.data.modelUsage && stats.data.modelUsage.length > 0) {
      console.log('🤖 Model Usage:');
      stats.data.modelUsage.forEach(model => {
        console.log(`   ${model._id}: ${model.count} requests ($${model.cost.toFixed(6)})`);
      });
      console.log('');
    }

    // Get recent requests
    console.log('2. Fetching recent requests...');
    const requests = await axios.get(`${DASHBOARD_URL}/requests?page=1&limit=5`);

    console.log(`📝 Recent Requests (${requests.data.pagination.total} total):`);
    requests.data.requests.forEach((req, index) => {
      console.log(`   ${index + 1}. ${req.originalPrompt.substring(0, 50)}...`);
      console.log(`      Model: ${req.model}`);
      console.log(`      Saved: $${req.cost?.saved?.toFixed(6) || 0}`);
      console.log(`      Cache: ${req.cacheHit ? 'HIT' : 'MISS'}`);
      console.log('');
    });

    // Get health status
    console.log('3. Checking system health...');
    const health = await axios.get('http://localhost:3001/api/health');
    console.log('🏥 System Status:', health.data.status);
    console.log('   MongoDB:', health.data.database);
    console.log('   Redis:', health.data.cache);
    console.log('');

    console.log('✨ Dashboard demo completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

dashboardExample();
