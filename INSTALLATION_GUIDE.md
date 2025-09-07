# Open WebUI Professional Gateway - Installation Guide

## 📋 **Pre-Installation Checklist**

Before starting the installation, ensure you have:

- [ ] Open WebUI running and accessible
- [ ] Node.js 14+ installed on your server
- [ ] Server access (SSH or direct access)
- [ ] Domain/subdomain ready (optional)
- [ ] Company logo and branding assets
- [ ] Open WebUI admin credentials

---

## 🚀 **Quick Installation (5 minutes)**

### **Step 1: Download & Extract**
```bash
# Download the package
wget https://your-domain.com/openwebui-gateway.zip
unzip openwebui-gateway.zip
cd openwebui-gateway
```

### **Step 2: Install Dependencies**
```bash
npm install
```

### **Step 3: Configure Environment**
```bash
# Copy the example environment file
cp .env.example .env.local

# Edit the configuration
nano .env.local
```

### **Step 4: Configure Your Settings**
Edit `.env.local` with your settings:

```env
# Open WebUI Configuration
OPENWEBUI_URL=http://localhost:3000
OPENWEBUI_API_KEY=your_api_key_here
# OR use admin credentials
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your_admin_password

# Server Configuration
PORT=8000

# Optional: JWT Token (if you have one)
OPENWEBUI_JWT_TOKEN=your_jwt_token_here
```

### **Step 5: Start the Gateway**
```bash
npm start
```

### **Step 6: Test the Installation**
1. Open your browser to `http://your-server:8000`
2. Test registration and login functionality
3. Verify the chatbot is working
4. Check that branding is applied correctly

---

## 🎨 **Customization Guide**

### **Adding Your Logo**

1. **Replace the logo file:**
   ```bash
   # Place your logo in the public folder
   cp your-logo.svg public/logo.svg
   ```

2. **Update the logo reference in `public/index.html`:**
   ```html
   <!-- Find this line and update the path -->
   <img src="logo.svg" alt="Your Company Logo" class="logo">
   ```

### **Customizing Colors**

Edit the CSS variables in `public/index.html`:

```css
:root {
  --primary-color: #ff6b9d;        /* Main brand color */
  --primary-hover: #ff5a8a;        /* Hover state */
  --secondary-color: #6c757d;      /* Secondary elements */
  --text-primary: #333333;         /* Main text color */
  --text-secondary: #666666;       /* Secondary text */
  --background: #f8f9fa;           /* Background color */
  --card-background: #ffffff;      /* Card background */
}
```

### **Updating Company Information**

1. **Company Name:** Update in `public/index.html`
   ```html
   <h1 class="title">Your Company Name</h1>
   ```

2. **Contact Information:** Update in the chatbot responses
3. **Support Email:** Update in error messages and chatbot

---

## 🔧 **Advanced Configuration**

### **Setting Up the AI Chatbot**

1. **Create an Assistant in Open WebUI:**
   - Go to your Open WebUI admin panel
   - Navigate to Assistants
   - Create a new assistant (e.g., "support-assistant", "company-support", etc.)
   - Configure it with your company information

2. **Configure the Assistant Name:**
   Add this to your `.env.local` file:
   ```env
   # Assistant Configuration
   OPENWEBUI_ASSISTANT_NAME=your-assistant-name-here
   ```
   
   The assistant name should match exactly what you created in Open WebUI.

### **Customizing Validation Messages**

Edit validation messages in `public/index.html`:

```javascript
// Email validation
showValidationMessage(emailInput, 'Please enter a valid email address');

// Password validation  
showValidationMessage(passwordInput, 'Password must be at least 6 characters');
```

### **Adding Custom Features**

The codebase is modular and easy to extend:

- **Additional validation rules** - Add to `validateForm()` function
- **New form fields** - Add HTML and corresponding validation
- **Custom styling** - Modify CSS variables and classes
- **Additional API endpoints** - Add to `server.js`

---

## 🔒 **Security Configuration**

### **Production Security Checklist**

- [ ] Change default admin credentials
- [ ] Use HTTPS in production
- [ ] Set up proper firewall rules
- [ ] Enable rate limiting (already configured)
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity

### **Environment Variables for Production**

```env
# Production settings
NODE_ENV=production
PORT=443
OPENWEBUI_URL=https://your-openwebui-domain.com
OPENWEBUI_API_KEY=your_secure_api_key
```

---

## 🐛 **Troubleshooting**

### **Common Issues**

**1. "Cannot connect to Open WebUI"**
- Check if Open WebUI is running
- Verify the URL in `.env.local`
- Check firewall settings

**2. "Chatbot not responding"**
- Verify API key or admin credentials
- Check Open WebUI assistant configuration
- Review server logs for errors

**3. "Styling not applied"**
- Clear browser cache
- Check file paths for assets
- Verify CSS is loading correctly

**4. "Registration not working"**
- Check Open WebUI user creation permissions
- Verify admin credentials
- Review server logs

### **Getting Help**

If you encounter issues:

1. **Check the logs:**
   ```bash
   npm start 2>&1 | tee gateway.log
   ```

2. **Contact Support:**
   - Email: tim.ohlen@digitalist.com
   - Include logs and error messages
   - Describe your setup and issue

---

## 📈 **Performance Optimization**

### **For High-Traffic Deployments**

1. **Use a reverse proxy (Nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-gateway.com;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **Enable compression:**
   ```javascript
   // Add to server.js
   app.use(compression());
   ```

3. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "openwebui-gateway"
   pm2 startup
   pm2 save
   ```

---

## 🔄 **Updates and Maintenance**

### **Updating the Gateway**

1. **Backup your configuration:**
   ```bash
   cp .env.local .env.local.backup
   cp -r public/custom public/custom.backup
   ```

2. **Download the latest version:**
   ```bash
   wget https://your-domain.com/openwebui-gateway-latest.zip
   ```

3. **Apply updates:**
   ```bash
   unzip openwebui-gateway-latest.zip
   # Merge your customizations
   npm install
   npm start
   ```

### **Regular Maintenance**

- **Weekly:** Check logs for errors
- **Monthly:** Update dependencies
- **Quarterly:** Review security settings
- **As needed:** Update branding and content

---

*Need help? Contact us at tim.ohlen@digitalist.com or +46 722-212102*
