import os
import sqlite3
import json
from datetime import datetime

# Define paths relative to this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data', 'promptverse.db')
PROGRESS_PATH = os.path.join(BASE_DIR, 'build_progress.json')

def get_db_connection():
    """
    Establishes and returns a secure SQLite database connection with
    foreign key constraints enabled and dictionary-like row formatting.
    """
    conn = sqlite3.connect(DB_PATH)
    # Enable foreign key constraint enforcement in SQLite
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Initializes the database schema by creating the 'users', 'prompts',
    'bookmarks', and 'comments' tables if they do not already exist.
    """
    # Ensure parent data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create Prompts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        difficulty TEXT,
        tags TEXT,
        is_public INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    
    # Check and migrate columns if prompts table already exists
    cursor.execute("PRAGMA table_info(prompts);")
    columns = [col[1] for col in cursor.fetchall()]
    if "difficulty" not in columns:
        cursor.execute("ALTER TABLE prompts ADD COLUMN difficulty TEXT;")
    if "tags" not in columns:
        cursor.execute("ALTER TABLE prompts ADD COLUMN tags TEXT;")
    
    # Create Bookmarks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prompt_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        UNIQUE(user_id, prompt_id)
    );
    """)
    
    # Create Comments table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    
    conn.commit()
    conn.close()
    print(f"SQLite database initialized at: {DB_PATH}")

def update_build_progress():
    """
    Updates the build_progress.json file to log that Phase 1
    (Database and Workspace Setup) is complete.
    """
    progress = {}
    if os.path.exists(PROGRESS_PATH):
        try:
            with open(PROGRESS_PATH, 'r') as f:
                progress = json.load(f)
        except Exception:
            pass
            
    progress["Phase 1"] = {
        "status": "complete",
        "timestamp": datetime.now().isoformat(),
        "description": "Database and Workspace Setup"
    }
    
    with open(PROGRESS_PATH, 'w') as f:
        json.dump(progress, f, indent=4)
    print(f"Updated progress tracking at: {PROGRESS_PATH}")

if __name__ == "__main__":
    init_db()
    update_build_progress()
