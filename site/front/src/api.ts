import axios from 'axios';
import type { InspectParams, ApiResponse } from './types';

const API_URL = 'http://127.0.0.1:8000/api';

export const fetchWorldGeoJSON = async () => {
  const res = await axios.get(`${API_URL}/static/world`);
  return res.data;
};

export const fetchAnalysis = async (params: InspectParams): Promise<ApiResponse> => {
  const res = await axios.post(`${API_URL}/inspect`, params);
  return res.data;
};