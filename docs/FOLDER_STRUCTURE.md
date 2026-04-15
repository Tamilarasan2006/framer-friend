# 📁 Farmers Friend - Folder Structure Guide

## Project Architecture Overview

This document explains the new modular folder structure of Farmers Friend, optimized for maintainability, scalability, and developer experience.

---

## 📂 Root Level Structure

```
FarmersFront/
├── 📄 index.html              # Main entry point (refactored for modularity)
├── 📄 server.js               # Express backend with validation
├── 📄 package.json            # Dependencies and scripts
├── 📄 README.md               # Project documentation
├── 📄 .env.example            # Environment variables template
├── 📄 .gitignore              # Git ignore rules
│
├── 📁 src/                    # Source code (NEW - modular structure)
│  ├── 📁 components/          # Reusable UI components
│  ├── 📁 sections/            # Page sections/views
│  ├── 📁 styles/              # Modular CSS files
│  └── 📁 scripts/             # JavaScript modules
│
├── 📁 database/               # Local JSON database files
│  ├── users.json
│  ├── market_products.json
│  ├── fertilizers.json
│  └── ... (other data files)
│
├── 📁 image/                  # Images and uploads
│  └── uploads/
│
├── 📁 docs/                   # Project documentation (NEW)
│  ├── FOLDER_STRUCTURE.md     # This file
│  ├── ARCHITECTURE.md         # Technical architecture
│  ├── COMPONENT_API.md        # Component API reference
│  └── GETTING_STARTED.md      # Developer setup guide
│
├── 📁 cordova-app/            # Mobile app (Cordova/Android)
├── 📁 apk/                    # Built APK files
└── 📁 scripts/                # Build and utility scripts
```

---

## 📦 `/src` - Source Code Directory

### Structure

```
src/
├── components/        # Reusable UI components
├── sections/         # Page sections & views
├── styles/           # Modular CSS
└── scripts/          # JavaScript logic
```

---

## 🎨 `/src/components` - UI Components

Reusable, self-contained UI components that can be included in any section.

```
src/components/
├── header.html              # Application header with branding
├── footer.html              # Application footer
├── navigation.html          # Tab navigation menu
│
├── modals/                  # Modal dialogs and panels
│  ├── cart-panel.html       # Shopping cart panel
│  ├── payment-panel.html    # Payment method selection & processing
│  ├── crop-rates-panel.html # Market crop rates modal
│  └── // Add more modals as needed
│
└── shared/                  # Shared component snippets
   ├── form-fields.html      # Reusable form inputs
   ├── alerts.html           # Alert/toast notifications
   └── loaders.html          # Loading spinners
```

### Component Guidelines

Each component file:
- Contains **only one logical component**
- Is **self-contained** with related CSS classes
- Uses **semantic HTML** for accessibility
- Includes **clear ID attributes** for JavaScript targeting
- Has **inline comments** explaining structure

**Example: `cart-panel.html`**
```html
<!-- Shopping Cart Panel Component -->
<div id="cartPanel" class="cart-panel">
    <!-- Component content -->
</div>
```

---

## 📄 `/src/sections` - Page Sections

Complete page views that can be swapped in the main viewport. Each section represents a distinct feature area.

```
src/sections/
├── home.html          # Dashboard with crop rates & best sellers
├── tools.html         # Fertilizer & feed recommendations
├── market.html        # Market products for sale
├── health.html        # Cattle health diagnostics
├── feeds.html         # Cattle feeds catalog
├── orders.html        # Order history & tracking
└── profile.html       # User profile management
```

### Section Structure

Each section:
- Is a **complete, standalone view**
- Has a **unique ID** (e.g., `id="home"`)
- Uses **class="section"** wrapper
- Contains all necessary HTML structure
- Loads with corresponding JavaScript module

**Example:**
```html
<section id="home" class="section active">
    <div class="section-title">Home Dashboard</div>
    <!-- Section content -->
</section>
```

---

## 🎯 `/src/styles` - Modular CSS

CSS split into logical files for maintainability.

```
src/styles/
├── variables.css       # CSS custom properties (colors, sizes, etc.)
├── base.css            # Base styles & typography
├── layout.css          # Layout & grid systems
├── components.css      # Component-specific styles
├── sections.css        # Section-specific styles
├── responsive.css      # Media queries & breakpoints
└── animations.css      # Keyframes & transitions
```

### Usage in HTML

```html
<head>
    <!-- Order: Variables → Base → Layout → Components → Sections → Responsive -->
    <link rel="stylesheet" href="src/styles/variables.css">
    <link rel="stylesheet" href="src/styles/base.css">
    <link rel="stylesheet" href="src/styles/layout.css">
    <link rel="stylesheet" href="src/styles/components.css">
    <link rel="stylesheet" href="src/styles/sections.css">
    <link rel="stylesheet" href="src/styles/responsive.css">
    <link rel="stylesheet" href="src/styles/animations.css">
</head>
```

---

## 💻 `/src/scripts` - JavaScript Modules

JavaScript organized into logical modules with clear responsibilities.

```
src/scripts/
│
├── core/                    # Core application logic
│  ├── app.js               # App initialization & routing
│  ├── api-client.js        # HTTP API wrapper functions
│  ├── storage.js           # LocalStorage/SessionStorage helpers
│  └── utils.js             # Common utility functions
│
├── components/              # Component JavaScript
│  ├── cart.js              # Shopping cart logic
│  ├── modals.js            # Modal open/close handlers
│  ├── navigation.js        # Tab navigation logic
│  └── forms.js             # Form validation & submission
│
└── sections/                # Section-specific logic
   ├── home.js              # Home page logic
   ├── tools.js             # Tools/fertilizer logic
   ├── market.js            # Market/products logic
   ├── health.js            # Health check logic
   └── profile.js           # Profile management logic
```

### Module Pattern

Each module:
- Uses **IIFE (Immediately Invoked Function Expression)** for scope
- Exports a **single public API**
- Has **clear dependencies**
- Follows **consistent naming conventions**

**Example: `src/scripts/core/api-client.js`**
```javascript
const ApiClient = (() => {
    const BASE_URL = '/api';
    
    const getProducts = async () => {
        // Implementation
    };
    
    const addProduct = async (data) => {
        // Implementation
    };
    
    return { getProducts, addProduct };
})();
```

---

## 📚 `/docs` - Documentation

Comprehensive documentation for developers.

```
docs/
├── FOLDER_STRUCTURE.md      # This file - folder organization
├── ARCHITECTURE.md          # System design & data flow
├── COMPONENT_API.md         # Component & module API reference
├── GETTING_STARTED.md       # Developer setup guide
├── ADDING_FEATURES.md       # How to add new features
└── TROUBLESHOOTING.md       # Common issues & solutions
```

---

## File Naming Conventions

### HTML Components
- **Kebab-case** with descriptive names
- Examples: `cart-panel.html`, `crop-rates-panel.html`, `form-fields.html`

### JavaScript Files
- **Kebab-case** for file names
- **camelCase** for variable/function names
- Examples: `api-client.js`, `form-validation.js`, `modal-handler.js`

### CSS Files
- **Kebab-case** names
- **No spaces or special characters**
- Examples: `components.css`, `responsive.css`, `variables.css`

### CSS Classes
- **Kebab-case** class names
- **BEM methodology** for complex components
  - Block: `.cart-panel`
  - Element: `.cart-panel__item`
  - Modifier: `.cart-panel--empty`

---

## Import/Load Order

### HTML Components
Load components in logical order:
```html
<!-- 1. Header -->
<div id="app">
    <!-- 2. Navigation -->
    <!-- 3. Modals -->
    <!-- 4. Main content (sections) -->
    <!-- 5. Footer -->
</div>
```

### CSS Files
Load in dependency order:
```
1. variables.css     (depends on nothing)
2. base.css          (depends on variables)
3. layout.css        (depends on variables, base)
4. components.css    (depends on all above)
5. sections.css      (depends on all above)
6. responsive.css    (depends on all above)
7. animations.css    (depends on all above)
```

### JavaScript Modules
Load after DOM content:
```html
<script defer src="src/scripts/core/api-client.js"></script>
<script defer src="src/scripts/core/storage.js"></script>
<script defer src="src/scripts/components/cart.js"></script>
<script defer src="src/scripts/sections/home.js"></script>
<script defer src="src/scripts/core/app.js"></script>
```

---

## Adding New Features

### 1. Create New Component
```bash
# Create component files
touch src/components/my-new-component.html
# Add styling to src/styles/components.css
# Add logic to src/scripts/components/my-new-component.js
```

### 2. Create New Section
```bash
# Create section files
touch src/sections/my-new-section.html
# Add styling to src/styles/sections.css
# Add logic to src/scripts/sections/my-new-section.js
```

### 3. Update index.html
- Include new HTML file
- Link new CSS file
- Load new JavaScript module

### 4. Document Changes
- Update relevant `docs/*.md` files
- Add comments to complex logic
- Update this folder structure guide if needed

---

## Best Practices

✅ **DO:**
- Keep components **single-responsibility**
- Use **semantic HTML** (buttons, forms, etc.)
- Include **aria-labels** for accessibility
- Keep **files under 300 lines**
- Use **clear, descriptive names**
- Add **inline comments** for complex logic

❌ **DON'T:**
- Embed large blocks of JavaScript in HTML
- Use inline styles (use CSS files instead)
- Mix component concerns
- Create files without documentation
- Use vague variable names like `data`, `temp`, `x`

---

## Performance Tips

1. **Lazy Load Sections** - Load section JS only when section becomes active
2. **Code Splitting** - Separate critical path JS from feature JS
3. **CSS Optimization** - Use only necessary CSS files per page
4. **Image Optimization** - Use optimized images in `image/` directory
5. **Caching** - Leverage browser caching for static assets

---

## VS Code Workspace Settings

Recommended `.vscode/settings.json`:
```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "[html]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[css]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "files.exclude": {
        "node_modules": true,
        ".git": true,
        "cordova-app/platforms": true
    },
    "search.exclude": {
        "node_modules": true,
        "cordova-app": true,
        "database": true
    }
}
```

---

## Quick Navigation

| Need | Location |
|------|----------|
| **Change colors/fonts** | `src/styles/variables.css` |
| **Fix layout issues** | `src/styles/layout.css` |
| **Style components** | `src/styles/components.css` |
| **Add new page** | `src/sections/*.html` + JS |
| **Add new component** | `src/components/*.html` + JS |
| **Backend APIs** | `server.js` |
| **Data files** | `database/*.json` |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design & data flow
- [COMPONENT_API.md](COMPONENT_API.md) - API reference for all components
- [GETTING_STARTED.md](GETTING_STARTED.md) - Developer setup
- [README.md](../README.md) - Project overview
