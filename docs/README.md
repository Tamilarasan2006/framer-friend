# 📚 Documentation Index - Farmers Friend

Welcome to the Farmers Friend developer documentation! This guide will help you understand the codebase, architecture, and how to contribute.

---

## 📖 Documentation Files

### Quick Start
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Set up development environment
  - Prerequisites and installation
  - VS Code setup and configuration
  - Common development tasks
  - Troubleshooting guide

### Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and technical details
  - Architecture diagram
  - Request/response flow
  - Data flow and state management
  - API endpoint structure
  - Security implementation
  - Performance optimization

### Code Organization
- **[FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)** - How code is organized
  - Directory layout
  - Component guidelines
  - Section structure
  - CSS organization
  - JavaScript modules
  - File naming conventions
  - Best practices

### API Reference (Coming Soon)
- **COMPONENT_API.md** - Component and module documentation
  - Component signatures
  - Available methods
  - Event handlers
  - Usage examples

---

## 🎯 Quick Navigation by Topic

### I want to...

#### **Set up my development environment**
→ [GETTING_STARTED.md](GETTING_STARTED.md#initial-setup)

#### **Understand the code structure**
→ [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)

#### **Learn how the app works**
→ [ARCHITECTURE.md](ARCHITECTURE.md)

#### **Add a new feature**
→ [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md#adding-new-features)

#### **Understand API design**
→ [ARCHITECTURE.md](ARCHITECTURE.md#api-endpoint-structure)

#### **Configure VS Code**
→ [GETTING_STARTED.md](GETTING_STARTED.md#vs-code-setup-recommended)

#### **Debug an issue**
→ [GETTING_STARTED.md](GETTING_STARTED.md#debugging-in-vs-code)

#### **Find where to edit something**
→ [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md#quick-navigation)

#### **Learn about security**
→ [ARCHITECTURE.md](ARCHITECTURE.md#security-measures)

#### **Understand the database**
→ [ARCHITECTURE.md](ARCHITECTURE.md#data-flow-database)

---

## 📋 Key Concepts

### Modular Architecture
The codebase is organized into:
- **Components** - Reusable UI elements (header, modals, forms)
- **Sections** - Complete page views (home, market, profile)
- **Styles** - Separated CSS (variables, layout, components)
- **Scripts** - Organized JavaScript (core, components, sections)

See [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for details.

### Request Flow
```
User Action → Component Handler → API Client → Server → Database → Response → UI Update
```

See [ARCHITECTURE.md](ARCHITECTURE.md#requestresponse-flow) for detailed flow.

### Validation
- **Frontend** - Quick feedback for user experience
- **Backend** - Security-critical, prevents injection attacks

See [ARCHITECTURE.md](ARCHITECTURE.md#input-validation-strategy) for details.

### Database Options
- **Development** - JSON files in `database/` folder
- **Production** - MongoDB Atlas (free tier available)

See [ARCHITECTURE.md](ARCHITECTURE.md#data-flow-database) for details.

---

## 🛠️ Technology Stack

| Aspect | Technology |
|--------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas (or JSON files) |
| **Icons** | Font Awesome 6.4.0 |
| **Charts** | Chart.js 4.4.0 |
| **Mobile** | Apache Cordova |

---

## 📊 Project Statistics

- **Total Lines in Original index.html**: 1,294 lines
- **Modular Components**: Separated into logical files
- **API Endpoints**: 20+ routes with validation
- **Database Collections**: 10+ JSON files / MongoDB collections
- **Sections**: 7+ distinct page views

---

## 💡 Best Practices

✅ **DO:**
- Keep components single-responsibility
- Use semantic HTML
- Add aria-labels for accessibility
- Write clean, documented code
- Test changes locally before committing

❌ **DON'T:**
- Mix concerns in a single file
- Use inline styles
- Hardcode values (use variables)
- Create files without documentation
- Commit secrets or credentials

See [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md#best-practices) for full guide.

---

## ✨ Recent Improvements

### Code Quality
- ✅ Comprehensive README with setup & deployment
- ✅ Server-side input validation on all endpoints
- ✅ Security hardening (.env management)
- ✅ Accessibility improvements (semantic HTML & keyboard nav)

### Code Organization
- ✅ Modular folder structure
- ✅ Comprehensive documentation
- ✅ VS Code workspace settings
- ✅ Clear coding standards

### Developer Experience
- ✅ Getting started guide
- ✅ Architecture documentation
- ✅ Folder structure guide
- ✅ Code examples and patterns

---

## 🚀 Next Steps for Contributors

1. **[Set up your environment](GETTING_STARTED.md#initial-setup)** (5 mins)
2. **[Read the architecture](ARCHITECTURE.md)** (15 mins)
3. **[Review folder structure](FOLDER_STRUCTURE.md)** (10 mins)
4. **[Make a small change](#)** (30 mins)
5. **[Submit a pull request](#)** (5 mins)

---

## 📞 Getting Help

- 📚 **Documentation**: All docs in this folder
- 🔍 **VS Code**: Use Ctrl+F to search files
- 💬 **GitHub Issues**: Ask questions or report bugs
- 📧 **Email**: farmers.friend.app@gmail.com

---

## 📄 Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Apr 15, 2026 | Initial documentation suite |
| | | - Added FOLDER_STRUCTURE.md |
| | | - Added ARCHITECTURE.md |
| | | - Added GETTING_STARTED.md |
| | | - Added VS Code settings |

---

## 📌 Important Files

| File | Purpose |
|------|---------|
| **README.md** | Project overview & setup |
| **server.js** | Express backend with validation |
| **.env.example** | Environment variables template |
| **package.json** | Dependencies & scripts |
| **index.html** | Main entry point |
| **.vscode/settings.json** | VS Code configuration |

---

## 🎓 Learning Resources

### JavaScript
- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)

### Express.js
- [Express.js Documentation](https://expressjs.com/)
- [Official Guide](https://expressjs.com/en/starter/hello-world.html)

### MongoDB
- [MongoDB University](https://university.mongodb.com/)
- [MongoDB Docs](https://docs.mongodb.com/)

### Web Development
- [CSS Tricks](https://css-tricks.com/)
- [HTML Standard](https://html.spec.whatwg.org/)
- [WCAG Accessibility](https://www.w3.org/WAI/)

---

**Last Updated**: April 15, 2026
**Maintainer**: Farmers Friend Team
**License**: MIT
