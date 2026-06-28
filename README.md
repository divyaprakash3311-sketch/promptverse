# PromptVerse 🚀

PromptVerse is a high-fidelity, full-stack AI prompt management platform designed for developers and AI enthusiasts to curate, organize, and discover engineering prompts. Built with a fast, modern asynchronous Python backend and a beautiful glassmorphic dark-theme user interface.

## ✨ Features

- **Immersive Glassmorphic UI:** A visually stunning presentation layer featuring blur effects, cohesive color-coded badge outlines for difficulty tiers, and interactive element hover states.
- **Persistent Database Infrastructure:** Driven by a robust SQLite backend that preserves user accounts, custom prompts, relationally linked bookmarks, and user discussions even after server restarts.
- **Smart Bookmarking Engine:** Features an optimized frontend state array synchronized with a relational database backend using immediate write-ahead logging commits.
- **Interactive Comment Sections:** Multi-user relational comment feeds nested inside prompt layout modules allowing users to collaborate on prompt optimizations.
- **Advanced Dynamic Filtering:** Search instantly through content titles, creator names, targeted system tags, and difficulty configurations.
- **Security First:** Implements secure DOM rendering boundaries protecting the user interface from cross-site scripting (XSS) injection vulnerabilities.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES6+), FontAwesome Icons
- **Backend:** FastAPI (Python), Pydantic (Data Validation)
- **Database:** SQLite3 (with foreign keys and cascade delete support)

---

## 📂 Project Structure

```text
promptverse/
├── app/
│   ├── database.py       # DB Initialization, schemas & migrations
│   ├── seed_data.py       # Core prompt datasets
│   └── server.py         # FastAPI routes, authentication, and endpoints
├── frontend/
│   ├── index.html        # Interactive glassmorphic presentation layer
│   └── dashboard.js      # App state control, async API fetch engine, and animations
├── app.py                # Main application server execution entrypoint
└── build_progress.json   # Full development milestone log
