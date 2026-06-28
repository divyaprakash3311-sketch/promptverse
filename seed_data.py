import sqlite3
import os
import hashlib
import secrets

# Define paths relative to this script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data', 'promptverse.db')

def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Create or retrieve system user
    username = "PromptMaster"
    email = "master@promptverse.com"
    password = "SuperSecurePassword123!"
    password_hash = hash_password(password)
    
    try:
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        if user:
            user_id = user[0]
            print(f"User '{username}' already exists with ID: {user_id}")
        else:
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email, password_hash)
            )
            conn.commit()  # Write to hard drive instantly
            user_id = cursor.lastrowid
            print(f"Created default seed user '{username}' with ID: {user_id}")
            
        # 2. Define premium sample prompts
        prompts = [
            {
                "title": "Python FastAPI Boilerplate Generator",
                "content": """Act as a senior backend engineer. Generate a production-ready Python FastAPI project structure and boilerplate code. 

Your response must include:
1. A clean directory layout following best practices (routers, models, schemas, core).
2. A main.py file demonstrating CORS, middleware, global error handling, and dependency injection.
3. A sample router with GET/POST validation using Pydantic.
4. Database connection setup using SQLAlchemy.

Keep the code clean, modular, and fully documented.""",
                "category": "Coding",
                "is_public": 1
            },
            {
                "title": "Dark Sci-Fi World-Building Architect",
                "content": """You are an award-winning science fiction author. Help me design a high-fidelity, grimdark sci-fi setting for a novel.

Provide detailed world-building details covering:
1. The Core Paradox: The major central conflict of the universe (e.g. dying star vs. immortal rulers).
2. Techno-Degradation: How technology exists but is decaying or poorly understood.
3. Factions & Hierarchies: Three major political or religious forces governing this society.
4. Sensory Anchor: Describe a typical street scene in a megacity using sound, smell, and light.

Maintain a gritty, atmospheric, and highly detailed tone.""",
                "category": "Creative",
                "is_public": 1
            },
            {
                "title": "High-Converting SaaS Landing Page Framework",
                "content": """Act as an expert conversion copywriter. I need a structural copy blueprint for a B2B SaaS landing page targeting startup founders.

Write the copy section-by-section including:
1. The Hero Section: Attention-grabbing Hook (H1), Explainer Sub-headline (H2), and low-friction Call to Action (CTA).
2. The Problem Statement: Frame the pain point of the customer before presenting the solution.
3. The Benefit Grid: Three primary value propositions focusing on outcomes (time saved, revenue gained) rather than feature lists.
4. Objection Buster: A short FAQ section addressing the top 3 pricing or migration concerns.

Provide precise instructions on visual hierarchy and button placement.""",
                "category": "Marketing",
                "is_public": 1
            },
            {
                "title": "Literature Review Synthesis Engine",
                "content": """You are an academic researcher and expert reviewer. Synthesize the findings of multiple research articles into a cohesive literature review section.

Inputs: [Insert Article Summaries and Key Findings here]

Tasks:
1. Theme Identification: Extract the 3 main conceptual intersections between these articles.
2. Dialectical Mapping: Contrast their methodologies and outline any conflicting conclusions.
3. Critical Gaps: Identify areas of study that are left unaddressed by all three authors.
4. Synthesis Paragraph: Write a formal 300-word paragraph integrating these ideas using standard academic citations.

Use a formal academic register and maintain rigorous analytical depth.""",
                "category": "Academic",
                "is_public": 1
            }
        ]
        
        # 3. Insert prompts
        for prompt in prompts:
            cursor.execute("SELECT id FROM prompts WHERE title = ?", (prompt["title"],))
            existing_prompt = cursor.fetchone()
            if existing_prompt:
                print(f"Prompt '{prompt['title']}' already exists. Skipping.")
            else:
                cursor.execute(
                    """
                    INSERT INTO prompts (user_id, title, content, category, is_public)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (user_id, prompt["title"], prompt["content"], prompt["category"], prompt["is_public"])
                )
                conn.commit()  # Write to hard drive instantly
                print(f"Inserted premium prompt: '{prompt['title']}'")
                
        print("Data seeding completed successfully!")
        
    except Exception as e:
        print(f"Error during seeding: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed()
