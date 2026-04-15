# 🏗️ Farmers Friend - System Architecture Guide

## Overview

This document describes the system architecture, data flow, and key design decisions in the Farmers Friend application.

---

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser/Mobile)                    │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   HTML Sections  │  │   Components     │  │   CSS/JS     │  │
│  │                  │  │                  │  │              │  │
│  │ - home.html      │  │ - header         │  │ - variables  │  │
│  │ - market.html    │  │ - modals         │  │ - layout     │  │
│  │ - health.html    │  │ - navigation     │  │ - components │  │
│  │ - profile.html   │  │ - forms          │  │ - animations │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│           │                    │                     │           │
│           └────────────────────┼─────────────────────┘           │
│                                │                                 │
│                        ┌───────▼────────┐                       │
│                        │  ApiClient     │                       │
│                        │  (HTTP Handler)│                       │
│                        └───────────────┘                        │
│                                │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HTTP/REST
┌────────────────────────────────▼────────────────────────────────┐
│                   SERVER (Node.js + Express)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ API Routes                                               │  │
│  │                                                          │  │
│  │ - /api/auth/*        (authentication)                   │  │
│  │ - /api/market-*      (marketplace)                      │  │
│  │ - /api/fertilizers   (fertilizer catalog)               │  │
│  │ - /api/cattle-*      (cattle health & products)         │  │
│  │ - /api/orders        (order management)                 │  │
│  │ - /api/profiles      (user profiles)                    │  │
│  │ - /api/upload-image  (file uploads)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                           │                         │
│  ┌────────▼────────┐      ┌──────────▼──────────┐              │
│  │ Validation Layer│      │ Authentication      │              │
│  │                │      │ & Authorization     │              │
│  │ - String check│      │                     │              │
│  │ - Email valid│      │ - JWT tokens        │              │
│  │ - Phone check│      │ - User roles        │              │
│  │ - Sanitize  │      │ - Permissions       │              │
│  └────────────────┘      └─────────────────────┘              │
│           │                           │                        │
│           └──────────┬────────────────┘                        │
│                      │                                         │
│            ┌─────────▼──────────┐                             │
│            │  Database Layer    │                             │
│            │                    │                             │
│            │ ┌──────────────┐   │                             │
│            │ │ MongoDB Atlas│   │ OR                          │
│            │ │ (Production) │   │                             │
│            │ └──────────────┘   │                             │
│            │ ┌──────────────┐   │                             │
│            │ │ JSON Files   │   │ (Development/Fallback)      │
│            │ └──────────────┘   │                             │
│            └────────────────────┘                             │
│                      ▲                                         │
│                      │                                         │
│            ┌─────────▼──────────┐                             │
│            │ Database Files     │                             │
│            │                    │                             │
│            │ - users.json       │                             │
│            │ - products.json    │                             │
│            │ - orders.json      │                             │
│            │ - profiles.json    │                             │
│            │ - ... (10 files)   │                             │
│            └────────────────────┘                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Request/Response Flow

### 1. User Interaction Flow

```
User Action (Click, Form Submit)
          ↓
Section Handler (e.g., home.js)
          ↓
Component Handler (e.g., cart.js)
          ↓
ApiClient.request()
          ↓
HTTP Request → Server
          ↓
          [Server Processing - See section 3]
          ↓
HTTP Response ← Server
          ↓
Response Handler (Promise resolution)
          ↓
UI Update (DOM manipulation)
          ↓
User Sees Result
```

### 2. Example: Add Product Flow

```
1. User clicks "ADD PRODUCT" button
2. toggleProductForm() shows form
3. User fills in product details
4. addMarketProduct() validates form
5. ApiClient.post('/api/market-products', data)
6. Server validates input (validateProduct())
7. Server writes to database
8. Response returns product with ID
9. UI adds new product to list
10. Form closes, user sees confirmation
```

### 3. Server Processing Flow

```
HTTP Request arrives
          ↓
Compression & CORS middleware
          ↓
Express Router (matches URL)
          ↓
Authentication Check (if needed)
          ↓
Input Validation
    ├─ Check required fields
    ├─ Validate data types
    ├─ Sanitize strings (prevent injection)
    └─ Verify length constraints
          ↓
Database Operation
    ├─ MongoDB: Direct query
    └─ JSON: File read/write
          ↓
Response Formatting
    ├─ 200 OK (success)
    ├─ 400 Bad Request (validation error)
    ├─ 404 Not Found (resource missing)
    └─ 500 Server Error (unexpected)
          ↓
HTTP Response to Client
```

---

## Data Flow: Database

### Local Development (JSON Files)

```
Client Request
    ↓
server.js
    ↓
readDB() function
    ├─ Check memory cache (_dbCache)
    └─ If not cached: Read from file
    ↓
Process & Respond
    ↓
writeDB() function
    ├─ Update memory cache
    └─ Write to database/*.json file
```

### Production (MongoDB Atlas)

```
Client Request
    ↓
server.js
    ↓
readMongo() function
    ├─ Query MongoDB with Mongoose
    └─ Cache result in memory
    ↓
Process & Respond
    ↓
writeMongo() function
    ├─ Update memory cache
    └─ Write to MongoDB collection
    ↓
Fallback for failures
    └─ Transparent fallback to JSON files
```

---

## Module Dependencies

### Core Modules (No dependencies)
- `api-client.js` - HTTP wrapper
- `storage.js` - LocalStorage utilities
- `utils.js` - Common functions

### Component Modules (Depend on core)
- `cart.js` - Shopping cart logic
- `modals.js` - Modal management
- `navigation.js` - Tab switching
- `forms.js` - Form handling

### Section Modules (Depend on core + components)
- `home.js` - Dashboard
- `market.js` - Products
- `health.js` - Cattle health
- `profile.js` - User profile

### App Module (Depends on all)
- `app.js` - App initialization & routing

**Dependency Graph:**
```
       app.js
         ▲
    ┌────┼────────────┐
    │    │            │
 home.js  │       profile.js
    │    │            │
    └───►│◄───────────┘
        core modules
        (api-client, 
         storage, utils)
         
AND

    navigation.js
         ▲
         │
      app.js
```

---

## State Management Pattern

### Client-Side State

**LocalStorage** (Persistent across sessions):
```javascript
// User session
localStorage.setItem('userId', '12345');
localStorage.setItem('userName', 'John Farmer');

// Cart items
localStorage.setItem('cart', JSON.stringify([...]));

// User preferences
localStorage.setItem('theme', 'light');
localStorage.setItem('language', 'en');
```

**Memory (Session only):**
```javascript
// Current section/tab
window.currentTab = 'home';

// Cached API responses
const AppState = {
    products: null,
    fertilizers: null,
    userProfile: null
};
```

**DOM State:**
```javascript
// UI visibility
document.getElementById('cartPanel').style.display = 'block';

// Form field values
document.getElementById('productName').value = 'Organic Rice';

// Active element tracking
document.querySelector('.section.active');
```

### Server-Side State

**Database Persistence:**
- All user data, products, orders stored in database
- Read on request, write after modifications
- In-memory cache (_dbCache) for performance

**Session Management:**
- Currently client-side (no session backend)
- Future: Implement JWT tokens or sessions

---

## API Endpoint Structure

### Authentication Routes
```
POST   /api/auth/register      Create new user account
POST   /api/auth/login         Authenticate user
```

### Product Management
```
GET    /api/market-products    List all products (with filters)
POST   /api/market-products    Create new product
PUT    /api/market-products/:id Update product
DELETE /api/market-products/:id Delete product
GET    /api/market-products/nearby  Find products by location
```

### Catalog Management
```
GET    /api/fertilizers        List fertilizers
POST   /api/fertilizers        Add fertilizer
DELETE /api/fertilizers/:id    Remove fertilizer

GET    /api/cattle-products    List cattle products
POST   /api/cattle-products    Add cattle product
DELETE /api/cattle-products/:id Remove cattle product
```

### Data & Information
```
GET    /api/cattle-diseases/:animalType  Get disease info
GET    /api/doctors                      List doctors
GET    /api/ai-knowledge/:topic          Get agriculture knowledge
GET    /api/live-crop-rates              Get market rates
```

### User Management
```
GET    /api/profiles/:userId   Get user profile
PUT    /api/profiles/:userId   Update user profile
GET    /api/dashboard/:userId  Get user dashboard stats
```

### Media
```
POST   /api/upload-image       Upload image file
```

---

## Input Validation Strategy

### Frontend Validation
```javascript
// User types in form → onchange triggers validation
// Shows immediate feedback (green/red borders)
// Prevents obviously invalid data from being sent
// UX: Fast feedback without server round-trip
```

### Backend Validation (REQUIRED)
```javascript
// Server validates ALL input before processing
// validateString() - Check length, sanitize special chars
// validateEmail() - Format & length check
// validatePhone() - 10-15 digit validation
// validateNumber() - Type & range check
// validateProduct() - All product fields validated together

// Returns 400 Bad Request with detailed error message
// Security: Cannot be bypassed like frontend validation
```

---

## Error Handling

### Client-Side
```
Try to execute action
    ↓
API call fails → Catch error
    ↓
Show user-friendly error message (toast/alert)
    ↓
Log error to console (dev)
    ↓
Retry or fallback option
```

### Server-Side
```
Request arrives
    ↓
Validation fails → Return 400 with message
    ↓
Resource not found → Return 404
    ↓
Unexpected error → Catch & return 500 + log
    ↓
Middleware catches uncaught errors
    ↓
Response sent to client
```

---

## Security Measures

### Input Validation
- ✅ String sanitization (removes `<>{}|\^`` chars)
- ✅ Length constraints (prevents buffer overflow)
- ✅ Type validation (prevents type confusion)
- ✅ Email/phone format validation
- ✅ Number range validation

### Sensitive Data
- ✅ `.env` with credentials not committed
- ✅ MongoDB credentials in environment
- ✅ No hardcoded secrets in code
- ✅ Admin credentials need update (currently hardcoded)

### Future Security Improvements
- 🔲 Add JWT token authentication
- 🔲 Implement HTTPS in production
- 🔲 Add rate limiting on API endpoints
- 🔲 Hash passwords with bcrypt
- 🔲 Add CSRF token validation
- 🔲 Implement role-based access control

---

## Performance Optimization

### Caching Strategy
```javascript
// In-memory cache for database reads
const _dbCache = {};

// Only re-read file if cache is empty
if (_dbCache[filename] === undefined) {
    data = await readJSONFallback(filename);
    _dbCache[filename] = data;
}
```

### API Caching
```javascript
// Cache live crop rates for 5 minutes
const LIVE_RATE_CACHE_TTL_MS = 5 * 60 * 1000;
_liveRateCache[cacheKey] = { ts: now, payload };
```

### Frontend Optimization
- Lazy load section JavaScript
- Only load section CSS when needed
- Use local storage for session data
- Debounce form input events
- Minimize DOM re-renders

---

## Mobile App Integration (Cordova)

The same JavaScript/HTML runs on both web and mobile:
```
Browser/Web            Mobile (Android)
    ↓                         ↓
index.html            →  cordova-app/www/
script.js             →  Cordova wrapper
style.css             →  Webview rendering
    ↓                         ↓
    └──────→ Built as APK ←───┘
```

### Cordova Configuration
- `cordova-app/config.xml` - App settings
- `cordova-app/www/` - Web assets
- `platforms/android/` - Android build files

**Build Process:**
```bash
npm run mobile:sync              # Copy www files to cordova-app/www
npm run mobile:android:build    # Build APK
npm run mobile:android:run      # Run on device
```

---

## Deployment Architecture

### Development
```
Local Machine
    ↓
npm start / npm run dev
    ↓
localhost:3000
    ↓
Local JSON database
```

### Production
```
GitHub Repository
    ↓
GitHub → Render.com (CI/CD)
    ↓
Render Platform
    ↓
Express Server + MongoDB Atlas
```

### Build Pipeline
```
git push → GitHub
    ↓
Render detects changes
    ↓
npm install
    ↓
npm start (server.js)
    ↓
Server listening on port
    ↓
Live at https://your-app.onrender.com
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5 | Structure |
| | CSS3 | Styling |
| | Vanilla JavaScript | Interactivity |
| | Chart.js | Data visualization |
| | Font Awesome | Icons |
| **Backend** | Node.js | Runtime |
| | Express.js | Web framework |
| | Mongoose | MongoDB ODM |
| **Database** | MongoDB Atlas | Production database |
| | JSON Files | Development/Fallback |
| **Mobile** | Apache Cordova | Mobile wrapper |
| | Android SDK | APK compilation |
| **Hosting** | Render.com | Cloud platform |
| **DevOps** | Git | Version control |
| | npm | Package management |
| | Docker | Containerization (future) |

---

## Future Improvements

1. **Microservices** - Split into separate services for scalability
2. **WebSockets** - Real-time notifications & updates
3. **Caching Layer** - Redis for distributed caching
4. **Message Queue** - RabbitMQ for async tasks
5. **Image Processing** - Server-side image optimization
6. **Payment Gateway** - Integrate Razorpay/Stripe
7. **Analytics** - Google Analytics / Mixpanel
8. **PWA** - Progressive Web App features
9. **Service Worker** - Offline support

---

## Related Documentation

- [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) - Code organization
- [COMPONENT_API.md](COMPONENT_API.md) - Component reference
- [README.md](../README.md) - Project overview
