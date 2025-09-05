const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Open WebUI API configuration
const OPENWEBUI_URL = process.env.OPENWEBUI_URL || 'http://localhost:3000';
const OPENWEBUI_API_URL = `${OPENWEBUI_URL}/api/v1`;

// Admin credentials for authentication
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const API_KEY = process.env.OPENWEBUI_API_KEY || null;

// Cache for admin JWT token
let adminToken = null;
let tokenExpiry = null;

// Try to get JWT token at startup
async function initializeAuth() {
  try {
    // First try to get JWT token from environment
    const envJwtToken = process.env.OPENWEBUI_JWT_TOKEN;
    if (envJwtToken) {
      adminToken = envJwtToken;
      console.log('JWT token loaded from environment');
      return;
    }
    
    // If no env token, try to get one by logging in
    adminToken = await getAdminToken();
    if (adminToken) {
      console.log('JWT token obtained successfully via login');
    } else {
      console.log('No JWT token available');
    }
  } catch (error) {
    console.log('Failed to get JWT token:', error.message);
  }
}

// Function to get admin JWT token
async function getAdminToken() {
  // Check if we have a valid token
  if (adminToken && tokenExpiry && Date.now() < tokenExpiry) {
    return adminToken;
  }

  try {
    console.log('Getting admin token...');
    const response = await fetch(`${OPENWEBUI_API_URL}/auths/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });

    if (response.ok) {
      const data = await response.json();
      adminToken = data.access_token;
      // Set expiry to 1 hour from now (adjust as needed)
      tokenExpiry = Date.now() + (60 * 60 * 1000);
      console.log('Admin token obtained successfully');
      return adminToken;
    } else {
      console.error('Failed to get admin token:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error getting admin token:', error);
    return null;
  }
}

// Register user endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Register user with Open WebUI using API key
    const userData = {
      name: email.split('@')[0], // Use email prefix as name
      email: email,
      password: password,
      role: 'pending', // Set user to pending status
      is_active: false // User is not active until approved
    };

    console.log('Attempting to register user:', email);

    if (!API_KEY && !adminToken) {
      console.log('No API key or JWT token found, simulating success (demo mode)');
      res.json({ 
        success: true, 
        message: 'Registration successful! Your account is pending approval.',
        status: 'pending'
      });
      return;
    }

    // Use the simple approach - call Open WebUI signup directly
    console.log('Calling Open WebUI signup endpoint...');
    const response = await fetch(`${OPENWEBUI_API_URL}/auths/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password: userData.password
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('User registered successfully via Open WebUI signup');
      res.json({ 
        success: true, 
        message: 'Registration successful! Your account is pending approval.',
        status: 'pending'
      });
    } else {
      console.error('Open WebUI signup error:', response.status, data);
      res.status(response.status).json({ 
        success: false, 
        message: data.detail || 'Registration failed. Please try again.',
        error: data
      });
    }
    
    /* 
    // Real implementation (uncomment when admin credentials are set up):
    
    const userData = {
      name: email.split('@')[0], // Use email prefix as name
      email: email,
      password: password
    };

    console.log('Attempting to register user:', email);

    // Try the public signup endpoint first
    let response = await fetch(`${OPENWEBUI_API_URL}/auths/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (response.ok) {
      console.log('User registered successfully via signup endpoint');
      res.json({ 
        success: true, 
        message: 'Registration successful! Your account is pending approval.',
        status: 'pending'
      });
      return;
    }

    // If signup fails, try to create user via admin API
    console.log('Signup endpoint failed, trying admin API...');
    const adminToken = await getAdminToken();
    
    if (!adminToken) {
      throw new Error('Unable to authenticate as admin');
    }

    // Create user via admin API
    response = await fetch(`${OPENWEBUI_API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        ...userData,
        role: 'pending', // Set user to pending status
        is_active: false // User is not active until approved
      })
    });

    if (response.ok) {
      console.log('User created successfully via admin API');
      res.json({ 
        success: true, 
        message: 'Registration successful! Your account is pending approval.',
        status: 'pending'
      });
    } else {
      const errorData = await response.json();
      console.error('Open WebUI API Error:', response.status, errorData);
      res.status(400).json({ 
        success: false, 
        message: 'Registration failed. Please try again.' 
      });
    }
    */

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open WebUI URL: ${OPENWEBUI_URL}`);
  
  // Initialize authentication
  await initializeAuth();
});
