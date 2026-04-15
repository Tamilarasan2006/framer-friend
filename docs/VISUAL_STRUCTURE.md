# 🗂️ Visual Folder Structure - Farmers Friend

This document provides a comprehensive visual representation of the Farmers Friend project structure.

---

## Complete Project Tree

```
FarmersFront/
│
├── 📄 INDEX.html                    Main application entry point (refactored)
├── 📄 server.js                     Express backend server with validated API
├── 📄 script.js                     Main application logic
├── 📄 api.js                        API integration helpers
├── 📄 dashboard.js                  Dashboard-specific logic
├── 📄 profile.js                    Profile management logic
├── 📄 price-prediction.js           Price prediction features
├── 📄 product-details.html          Product detail page
├── 📄 login.html                    Login page
├── 📄 style.css                     Global styles
│
├── 📋 Configuration Files
│  ├── 📄 package.json               Dependencies & npm scripts
│  ├── 📄 .env.example               Environment template (no secrets!)
│  ├── 📄 .env                       Actual secrets (in .gitignore)
│  ├── 📄 .gitignore                 Git ignore rules
│  ├── 📄 render.yaml                Render deployment config
│  └── 📄 CORDOVA_SETUP.md           Mobile setup guide
│
├── 📁 src/                          🆕 Source code (modular structure)
│  │
│  ├── 📁 components/                Reusable UI components
│  │  ├── 📄 header.html            App header with branding
│  │  ├── 📄 footer.html            App footer
│  │  ├── 📄 navigation.html        Tab navigation bar
│  │  └── 📁 modals/                Modal dialogs & panels
│  │     ├── 📄 cart-panel.html         Shopping cart
│  │     ├── 📄 payment-panel.html      Payment methods
│  │     └── 📄 crop-rates-panel.html   Market rates modal
│  │
│  ├── 📁 sections/                  Page sections/views
│  │  ├── 📄 home.html              Home dashboard
│  │  ├── 📄 tools.html             Fertilizer tools
│  │  ├── 📄 market.html            Market products
│  │  ├── 📄 health.html            Cattle health
│  │  ├── 📄 feeds.html             Cattle feeds
│  │  ├── 📄 orders.html            Order management
│  │  └── 📄 profile.html           User profile
│  │
│  ├── 📁 styles/                    Organized CSS files
│  │  ├── 📄 variables.css          CSS custom properties
│  │  ├── 📄 base.css               Typography & resets
│  │  ├── 📄 layout.css             Grid & layout
│  │  ├── 📄 components.css         Component styles
│  │  ├── 📄 sections.css           Section styles
│  │  ├── 📄 responsive.css         Media queries
│  │  └── 📄 animations.css         Keyframes & transitions
│  │
│  └── 📁 scripts/                   JavaScript modules
│     ├── 📁 core/                   Core functionality
│     │  ├── 📄 app.js                 App initialization
│     │  ├── 📄 api-client.js         HTTP API wrapper
│     │  ├── 📄 storage.js             LocalStorage helpers
│     │  └── 📄 utils.js              Utility functions
│     ├── 📁 components/             Component logic
│     │  ├── 📄 cart.js                Shopping cart
│     │  ├── 📄 modals.js              Modal handlers
│     │  ├── 📄 navigation.js          Tab switching
│     │  └── 📄 forms.js               Form validation
│     └── 📁 sections/               Section logic
│        ├── 📄 home.js                Home page
│        ├── 📄 tools.js               Tools page
│        ├── 📄 market.js              Market page
│        ├── 📄 health.js              Health page
│        └── 📄 profile.js             Profile page
│
├── 📁 docs/                         🆕 Comprehensive documentation
│  ├── 📄 README.md                 Documentation index
│  ├── 📄 FOLDER_STRUCTURE.md       This file + details
│  ├── 📄 ARCHITECTURE.md           System design & flows
│  ├── 📄 GETTING_STARTED.md        Developer setup guide
│  ├── 📄 COMPONENT_API.md          Component reference (coming)
│  └── 📄 TROUBLESHOOTING.md        Common issues (coming)
│
├── 📁 database/                     Local JSON database files
│  ├── 📄 users.json                User accounts & registration
│  ├── 📄 market_products.json      Products for sale
│  ├── 📄 fertilizers.json          Fertilizer catalog
│  ├── 📄 cattle_feeds.json         Cattle feed recommendations
│  ├── 📄 cattle_products.json      Cattle products
│  ├── 📄 cattle_diseases.json      Disease information
│  ├── 📄 crops.json                Crop data
│  ├── 📄 doctors.json              Doctor directory
│  ├── 📄 orders.json               Order history
│  ├── 📄 profiles.json             User profiles
│  └── 📄 ai_knowledge.json         Agriculture knowledge base
│
├── 📁 image/                        Images and uploads
│  ├── 📄 logo.jpeg                 App logo
│  └── 📁 uploads/                  User uploaded images
│     ├── 📄 [timestamp]-[hash].jpg  Generated image files
│     └── 📄 ...
│
├── 📁 scripts/                      Build and utility scripts
│  ├── 📄 check-mobile-api-base.js  Mobile API validation
│  ├── 📄 sync-cordova-www.js       Sync web to mobile app
│  ├── 📄 clean-cordova-icons.js    Clean mobile assets
│  └── 📄 generate-cordova-assets.js Regenerate assets
│
├── 📁 cordova-app/                  Mobile app (Cordova/Android)
│  ├── 📄 config.xml                Cordova config
│  ├── 📄 package.json              Mobile dependencies
│  ├── 📁 www/                      Same files as web version
│  │  ├── index.html
│  │  ├── script.js
│  │  ├── style.css
│  │  └── ... (mirrors root files)
│  ├── 📁 plugins/                  Cordova plugins
│  ├── 📁 platforms/
│  │  ├── 📁 android/               Android build files
│  │  │  ├── 📁 app/                App module
│  │  │  │  ├── 📁 src/
│  │  │  │  │  ├── main/
│  │  │  │  │  │  ├── 📁 res/       Resources (icons, splash)
│  │  │  │  │  │  ├── 📁 java/      Android code
│  │  │  │  │  │  └── AndroidManifest.xml
│  │  │  │  │  └── ...
│  │  │  │  └── build.gradle        Gradle config
│  │  │  └── ... (other Android files)
│  │  └── 📁 ios/                   iOS files (if configured)
│  ├── 📁 resources/                App resources
│  │  └── 📁 android/
│  │     ├── 📁 icon/               App icons
│  │     └── 📁 splash/             Splash screens
│  └── 📁 build/                    Generated build files
│
├── 📁 apk/                          Compiled APK releases
│  ├── 📄 FarmersFriend-db-final-fix.apk
│  └── 📄 FarmersFriend-seeddb-fix.apk
│  📌 NOTE: These are removed from Git, hosted on GitHub Releases
│
├── 📁 node_modules/                 Installed npm packages (in .gitignore)
│  ├── express/
│  ├── mongoose/
│  ├── cors/
│  └── ... (others)
│
├── 📁 .vscode/                      🆕 VS Code workspace settings
│  └── 📄 settings.json              Editor & debugger config
│
├── 📁 .git/                         Git version control
│  ├── objects/                      Object database
│  ├── refs/                         Branch references
│  └── ... (git internals)
│
├── 📁 .idea/                        JetBrains IDE files (can ignore)
│
├── 📄 README.md                     Project overview & setup
├── 📄 ATLAS_RENDER_DEPLOY.md        Deployment guide
└── 📄 package-lock.json             Locked dependency versions

```

---

## Size And Complexity Overview

```
Code Statistics:
├── Lines of Code
│  ├── index.html          1,294 lines (refactored into components)
│  ├── script.js           ~800 lines
│  ├── style.css           ~4,000 lines
│  ├── server.js           ~900 lines (with validation)
│  └── Total              ~7,000 lines
│
├── File Count
│  ├── HTML files          12
│  ├── CSS files           7 (was 1)
│  ├── JS files            11
│  ├── JSON data files     11
│  └── Documentation       6 files
│
└── Components
   ├── API Endpoints       20+
   ├── Page Sections       7
   ├── Reusable Components 5
   ├── Database Tables     11
   └── Form Fields         50+
```

---

## Directory Color Legend

```
📁 = Directory
📄 = File
📌 = Important note
🆕 = New (added in refactor)
```

---

## Import/Load Dependencies

### HTML Component Loading Order
```
1. Header component    (constant, at top)
2. Navigation component (always visible)
3. Modal components    (hidden, revealed on demand)
4. Section components  (only one visible at a time)
5. Footer component    (at bottom)
```

### CSS Load Order (Cascade)
```
1. variables.css     ← Color & size definitions
2. base.css          ← Typography & resets
3. layout.css        ← Grid & spacing
4. components.css    ← Component styles
5. sections.css      ← Section styles
6. responsive.css    ← Media queries
7. animations.css    ← Transitions & keyframes
```

### JavaScript Load Order (Execution)
```
1. api-client.js     ← HTTP wrapper (no dependencies)
2. storage.js        ← Storage helpers
3. utils.js          ← Utility functions
4. cart.js           ← Component logic
5. modals.js         ← Modal handlers
6. home.js           ← Section logic
7. app.js            ← Initialization (depends on all)
```

---

## Common File Locations

| What | Where | Example |
|------|-------|---------|
| Add new page | `src/sections/` | `src/sections/my-page.html` |
| Add new component | `src/components/` | `src/components/my-component.html` |
| Add component logic | `src/scripts/components/` | `src/scripts/components/my-component.js` |
| Add app-wide styles | `src/styles/` | `src/styles/my-styles.css` |
| Store user data | `database/` | `database/custom-data.json` |
| Add API route | `server.js` | Implement new `app.post('/api/...')` |
| Upload files | `image/uploads/` | Automatic via API |
| Create documentation | `docs/` | `docs/MY_GUIDE.md` |

---

## Quick File Navigation

### Frontend Files
- **Main UI**: `index.html`
- **Global Styles**: `style.css` (or `src/styles/*`)
- **Main Logic**: `script.js`
- **API Integration**: `api.js`
- **Specific Pages**: `src/sections/*.html`

### Backend Files
- **Server**: `server.js`
- **Data**: `database/*.json`
- **Config**: `package.json`, `.env`

### Mobile Files
- **Config**: `cordova-app/config.xml`
- **Web Assets**: `cordova-app/www/`
- **Build**: `cordova-app/platforms/android/`

### Documentation
- **Getting Started**: `docs/GETTING_STARTED.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Folder Guide**: `docs/FOLDER_STRUCTURE.md`

---

## Git Ignore Rules

These files are intentionally NOT committed:
```gitignore
node_modules/      # Dependencies (install with npm)
.env               # Secrets & credentials
*.apk              # Compiled mobile apps
build/             # Build artifacts
dist/              # Distribution files
.DS_Store          # macOS system files
Thumbs.db          # Windows cache
```

---

## Future Structure Additions

As the project grows, consider adding:
```
├── tests/                 Unit & integration tests
│  ├── unit/
│  ├── integration/
│  └── e2e/
├── public/                Static assets CDN
├── config/                App configuration
├── migrations/            Database migrations
└── utils/                 Shared utilities
```

---

## Performance Tips by Location

| Area | Tip |
|------|-----|
| **src/styles/** | Import only needed CSS files |
| **src/scripts/** | Lazy load section JS |
| **database/** | Use MongoDB for production |
| **image/uploads/** | Compress images before upload |
| **index.html** | Load critical CSS inline |

---

Related Documentation:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [GETTING_STARTED.md](GETTING_STARTED.md) - Developer setup
- [README.md](README.md) - Documentation index
