import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const dashboardAPI = {
  async getStats(timeframe = '24h') {
    const response = await axios.get(`${API_BASE_URL}/dashboard/stats`, {
      params: { timeframe }
    });
    return response.data;
  },

  async getRequests(page = 1, limit = 50) {
    const response = await axios.get(`${API_BASE_URL}/dashboard/requests`, {
      params: { page, limit }
    });
    return response.data;
  },

  async clearCache() {
    const response = await axios.post(`${API_BASE_URL}/dashboard/cache/clear`);
    return response.data;
  },

  async getHealth() {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  }
};
