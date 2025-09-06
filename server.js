const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 8000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'För många försök från denna IP, försök igen senare.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'För många inloggningsförsök, försök igen senare.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // allow 2 requests per 15 minutes, then...
  delayMs: () => 500 // begin adding 500ms of delay per request above delayAfter
});

// Apply rate limiting
app.use(limiter);
app.use(speedLimiter);

// CORS and JSON parsing
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
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

// Input validation and sanitization
const validateAndSanitizeInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Ogiltig indata',
      errors: errors.array()
    });
  }
  next();
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return DOMPurify.sanitize(str.trim());
};

// Validation rules
const registrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Ange en giltig e-postadress')
    .isLength({ max: 254 })
    .withMessage('E-postadressen är för lång'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Lösenordet måste vara mellan 6 och 128 tecken')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Ange en giltig e-postadress'),
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('Lösenordet får inte vara tomt')
];

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
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    // Sanitize inputs
    const email = sanitizeString(req.body.email);
    const password = sanitizeString(req.body.password);
    
    // Additional validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-post och lösenord krävs' 
      });
    }

    // Log registration attempt
    console.log(`Registration attempt from IP: ${req.ip}, Email: ${email}`);

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
    console.error('Registration error:', {
      message: error.message,
      stack: error.stack,
      ip: req.ip,
      email: req.body.email
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server fel. Försök igen senare.' 
    });
  }
});

// Login endpoint
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    // Sanitize inputs
    const email = sanitizeString(req.body.email);
    const password = sanitizeString(req.body.password);
    
    // Additional validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-post och lösenord krävs' 
      });
    }

    // Log login attempt
    console.log(`Login attempt from IP: ${req.ip}, Email: ${email}`);

    // Check if Open WebUI is available
    if (!OPENWEBUI_URL) {
      console.log('Open WebUI not configured, simulating login success (demo mode)');
      res.json({ 
        success: true, 
        message: 'Inloggning lyckades! (Demo mode)',
        redirectUrl: 'http://localhost:3000',
        demoMode: true
      });
      return;
    }

    // Check if Open WebUI is actually running
    try {
      const healthCheck = await fetch(`${OPENWEBUI_URL}`, { 
        method: 'GET',
        timeout: 5000 
      });
      
      if (!healthCheck.ok) {
        console.log('Open WebUI not responding, using demo mode');
        res.json({ 
          success: true, 
          message: 'Inloggning lyckades! (Demo mode - Open WebUI not responding)',
          redirectUrl: OPENWEBUI_URL,
          demoMode: true
        });
        return;
      }
      
      console.log('Open WebUI is running, attempting real authentication');
    } catch (error) {
      console.log('Open WebUI not reachable, using demo mode:', error.message);
      res.json({ 
        success: true, 
        message: 'Inloggning lyckades! (Demo mode - Open WebUI not reachable)',
        redirectUrl: OPENWEBUI_URL,
        demoMode: true
      });
      return;
    }

    // Try to authenticate with Open WebUI
    const response = await fetch(`${OPENWEBUI_API_URL}/auths/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('User logged in successfully');
      console.log('Full response data:', JSON.stringify(data, null, 2));
      
      // Open WebUI returns token in 'token' field, not 'access_token'
      const authToken = data.token || data.access_token;
      console.log('Auth token received:', authToken ? 'Yes' : 'No');
      console.log('Token value:', authToken);
      
      // Generate redirect URL through our auth endpoint
      const redirectUrl = `${req.protocol}://${req.get('host')}/auth/${authToken}`;
      
      res.json({ 
        success: true, 
        message: 'Inloggning lyckades!',
        redirectUrl: redirectUrl,
        token: authToken
      });
    } else {
      console.error('Open WebUI login error:', response.status, data);
      res.status(response.status).json({ 
        success: false, 
        message: data.detail || 'Inloggning misslyckades. Kontrollera dina uppgifter.',
        error: data
      });
    }
    
  } catch (error) {
    console.error('Login error:', {
      message: error.message,
      stack: error.stack,
      ip: req.ip,
      email: req.body.email
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server fel. Försök igen senare.' 
    });
  }
});

// Redirect to Open WebUI endpoint
app.get('/api/redirect-to-openwebui', (req, res) => {
  res.redirect(OPENWEBUI_URL);
});

// Authentication endpoint that sets up proper session
app.get('/auth/:token', (req, res) => {
  const token = req.params.token;
  
  console.log('Auth endpoint called with token:', token ? 'Present' : 'Missing');
  
  // Create an HTML page that properly sets up the authentication
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authenticating...</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          background: #1a1a1a;
          color: white;
        }
        .spinner { 
          border: 4px solid #f3f3f3; 
          border-top: 4px solid #ff6b9d; 
          border-radius: 50%; 
          width: 40px; 
          height: 40px; 
          animation: spin 1s linear infinite; 
          margin: 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <h2>Authenticating with Open WebUI...</h2>
      <div class="spinner"></div>
      <p>Please wait while we log you in...</p>
      
      <script>
        // Try multiple methods to set the authentication
        const token = '${token}';
        console.log('Setting up authentication with token:', token ? 'Present' : 'Missing');
        
        // Method 1: Set in localStorage
        localStorage.setItem('access_token', token);
        localStorage.setItem('token', token);
        localStorage.setItem('openwebui_token', token);
        
        // Method 2: Set in sessionStorage
        sessionStorage.setItem('access_token', token);
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('openwebui_token', token);
        
        // Method 3: Set as a cookie
        document.cookie = 'access_token=' + token + '; path=/; max-age=86400; SameSite=Lax';
        document.cookie = 'token=' + token + '; path=/; max-age=86400; SameSite=Lax';
        document.cookie = 'openwebui_token=' + token + '; path=/; max-age=86400; SameSite=Lax';
        
        // Method 4: Try to verify the token with Open WebUI
        if (window.fetch && token) {
          fetch('${OPENWEBUI_URL}/api/v1/auths/me', {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            }
          }).then(response => {
            console.log('Auth verification response:', response.status);
            if (response.ok) {
              console.log('Token is valid!');
            } else {
              console.log('Token verification failed:', response.status);
            }
          }).catch(err => {
            console.log('Auth verification failed:', err);
          });
        }
        
        // Redirect to Open WebUI with token in URL
        setTimeout(() => {
          const redirectUrl = '${OPENWEBUI_URL}?access_token=' + encodeURIComponent(token) + '&token=' + encodeURIComponent(token);
          console.log('Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;
        }, 3000);
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
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
