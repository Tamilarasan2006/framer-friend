# 🚀 Getting Started - Developer Guide

Welcome to Farmers Friend! This guide will help you set up your development environment and start contributing.

---

## Prerequisites

### Required Software
- **Node.js** v14 or higher ([Download](https://nodejs.org/))
- **npm** v6 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **MongoDB Atlas Account** (free tier available at [mongodb.com](https://www.mongodb.com/cloud/atlas))
- **VS Code** (optional but recommended)

### For Mobile Development
- **Java Development Kit (JDK)** v11+
- **Android SDK** (via Android Studio)
- **Cordova CLI** (`npm install -g cordova`)

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/FarmersFront.git
cd FarmersFront
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `mongoose` - MongoDB driver
- `cors` - Cross-origin support
- `compression` - Response compression
- `dotenv` - Environment variables
- `nodemon` - Auto-reload development server (dev)

### 3. Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your MongoDB connection string
# Open .env in your editor and fill in:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/...
```

**How to get MongoDB URI:**
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account (M0 cluster)
3. In Dashboard → Clusters → Connect
4. Choose "Drivers" option
5. Copy connection string
6. Replace `<username>`, `<password>`, `<database>`

### 4. Start Development Server

```bash
# Production mode
npm start
# → Server runs at http://localhost:3000

# Development mode (auto-reload on changes)
npm run dev
# → Server runs at http://localhost:3000 with nodemon
```

### 5. Open in Browser

Navigate to `http://localhost:3000`

You should see the Farmers Friend home page! 🎉

---

## VS Code Setup (Recommended)

### 1. Install Recommended Extensions

Open VS Code and install these extensions:

- **Prettier** - Code formatter (`esbenp.prettier-vscode`)
- **ESLint** - JavaScript linter (`dbaeumer.vscode-eslint`)
- **HTML Snippets** - HTML code completion (`abusaidm.html-snippets`)
- **REST Client** - Test API endpoints (`humao.rest-client`)
- **Markdown Preview Enhanced** - Better markdown preview

### 2. Create VS Code Workspace Settings

`.vscode/settings.json`:
```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.trimAutoWhitespace": true,
    "[html]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[css]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[json]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "files.exclude": {
        "node_modules": true,
        ".git": true,
        "cordova-app/platforms": true,
        "cordova-app/plugins": true
    },
    "search.exclude": {
        "node_modules": true,
        "cordova-app": true,
        "database": true,
        ".git": true
    },
    "files.watcherExclude": {
        "**/node_modules": true,
        "**/platforms": true,
        "**/build": true
    }
}
```

### 3. Create VS Code Launch Configuration

`.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch Server",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/server.js",
            "restart": true,
            "console": "integratedTerminal",
            "env": {
                "NODE_ENV": "development"
            }
        },
        {
            "name": "Chrome",
            "type": "chrome",
            "request": "launch",
            "url": "http://localhost:3000",
            "webRoot": "${workspaceFolder}"
        }
    ]
}
```

Now you can:
- Press `F5` to debug server
- Set breakpoints in server.js
- Step through code execution

---

## Project Structure Overview

```
FarmersFront/
├── index.html            ← Main app file
├── server.js             ← Express backend
├── package.json          ← Dependencies
├── .env                  ← Secrets (DON'T COMMIT!)
│
├── src/                  ← Source code
│  ├── components/        ← UI components
│  ├── sections/          ← Page views
│  ├── styles/            ← CSS files
│  └── scripts/           ← JavaScript logic
│
├── database/             ← JSON database files
├── image/uploads/        ← Uploaded images
├── docs/                 ← Documentation
└── cordova-app/          ← Mobile app
```

See [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for detailed organization.

---

## Common Development Tasks

### Task 1: Making Code Changes

1. Create/edit a file
2. Save (auto-formats with Prettier)
3. Super refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
4. Check console for errors (`F12`)
5. Test the feature

### Task 2: Testing API Endpoints

Install REST Client extension, then create `test.http`:

```http
### Get all products
GET http://localhost:3000/api/market-products

### Add new product
POST http://localhost:3000/api/market-products
Content-Type: application/json

{
  "name": "Organic Rice",
  "price": 450,
  "quantity": 100,
  "location": "Tiruchirappalli"
}

### Get user profile
GET http://localhost:3000/api/profiles/user123
```

Click "Send Request" above each request to test!

### Task 3: Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes to code
# Edit files as needed

# 3. Test locally
npm run dev
# Verify feature works in browser

# 4. Commit changes
git add .
git commit -m "feat: add my new feature"

# 5. Push to GitHub
git push origin feature/my-new-feature

# 6. Create Pull Request on GitHub
```

### Task 4: Debugging in VS Code

1. Set breakpoint by clicking line number (red dot appears)
2. Press `F5` or click "Run and Debug"
3. Trigger the breakpoint by using the app
4. Execution pauses at breakpoint
5. Use Debug panel to inspect variables
6. Continue with `F10` (step) or `F5` (resume)

---

## Useful npm Commands

```bash
# Install dependencies
npm install

# Start server (production)
npm start

# Start server (development with auto-reload)
npm run dev

# Check if mobile API is accessible
npm run mobile:hosted:check

# Sync files to Cordova app
npm run mobile:sync

# Build Android APK
npm run mobile:android:build

# Run on connected device
npm run mobile:android:run

# Export user list as CSV
curl http://localhost:3000/api/users/export > users.csv
```

---

## Coding Standards

### JavaScript
```javascript
// ✅ Good
const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// ❌ Bad
function check(e) {
    return e.includes('@');
}
```

**Rules:**
- Use `const` by default, `let` for reassignment, avoid `var`
- Use arrow functions `() => {}`
- Use descriptive variable names
- Add comments for complex logic
- Keep functions under 20 lines

### HTML
```html
<!-- ✅ Good -->
<button 
    id="submitBtn" 
    class="btn btn-primary" 
    aria-label="Submit form"
    onclick="handleSubmit()"
>
    Submit
</button>

<!-- ❌ Bad -->
<div class="button" onclick="submit()">submit</div>
```

**Rules:**
- Use semantic HTML (button, form, input)
- Use kebab-case for IDs and classes
- Add aria-labels for accessibility
- Keep nesting 3-4 levels deep max

### CSS
```css
/* ✅ Good */
.cart-panel {
    background: var(--white);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
}

.cart-panel__item {
    padding: 1rem;
    border-bottom: 1px solid var(--border-soft);
}

/* ❌ Bad */
.cp {
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
}
```

**Rules:**
- Use CSS variables for colors/sizes
- Use BEM naming: `.block`, `.block__element`, `.block--modifier`
- Use rem/em for responsive sizing
- Avoid inline styles

---

## Troubleshooting

### Issue: "Port 3000 already in use"

**Solution:** Kill the process using port 3000
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### Issue: "Cannot connect to MongoDB"

**Solution:** Check your .env file
```bash
# Verify .env exists and has MONGO_URI
cat .env | grep MONGO_URI

# Test connection
node -e "require('dotenv').config(); console.log(process.env.MONGO_URI)"
```

### Issue: "Changes not showing up"

**Solution:** Hard refresh browser cache
```
Ctrl+Shift+R (Windows)
Cmd+Shift+R (Mac)
```

### Issue: "npm install fails"

**Solution:** Clean cache and retry
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Git conflicts when pulling"

**Solution:** Stash changes and pull
```bash
git stash
git pull origin main
git stash pop
```

---

## Git Workflow

### Creating a feature branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: describe your change"

# Push to GitHub
git push origin feature/my-feature

# Create Pull Request on GitHub
```

### Commit Message Format

```
feat: add new feature (new functionality)
fix: bug fix (fix existing bug)
docs: documentation (readme, comments)
style: formatting (whitespace, semicolons)
refactor: code restructuring (no behavior change)
perf: performance improvement
test: add tests
chore: build, deps, config

Example: feat: add shopping cart panel
```

---

## Next Steps

1. ✅ Set up development environment
2. ✅ Review [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)
3. ✅ Read [ARCHITECTURE.md](ARCHITECTURE.md)
4. ✅ Pick a simple issue to work on
5. ✅ Make changes locally
6. ✅ Test thoroughly
7. ✅ Submit pull request

---

## Getting Help

- 📚 **Documentation**: See `/docs` folder
- 🔍 **Search Code**: Use VS Code Ctrl+F
- 💬 **Ask Questions**: Create GitHub issue
- 🐛 **Report Bugs**: Report with steps to reproduce
- 📧 **Email**: farmers.friend.app@gmail.com

---

## Related Documentation

- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) - Code organization
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [COMPONENT_API.md](COMPONENT_API.md) - Component reference
- [README.md](../README.md) - Project overview
