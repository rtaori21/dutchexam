import axios from 'axios';

// Create a pre-configured axios instance
const api = axios.create({
    baseURL: 'http://localhost:3000/api', // Assumes backend is on 3000
});

export default api;
