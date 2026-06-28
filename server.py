import os
import sys
import re
import hashlib
import secrets
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime

# Ensure the parent app directory is in Python path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import get_db_connection

from fastapi import FastAPI, HTTPException, Depends, Request, Response, Cookie, Header, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="PromptVerse API Server",
    description="Backend API server for user authentication and prompt management.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Email verification regex pattern
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def validate_email_format(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))

# In-memory session store: session_id -> user dictionary
SESSIONS: Dict[str, Dict[str, Any]] = {}

# Password hashing utilities
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

def verify_password(stored_password_hash: str, password: str) -> bool:
    """Verifies a password against its stored hash."""
    try:
        salt, key_hex = stored_password_hash.split('$')
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return key.hex() == key_hex
    except Exception:
        return False

# Pydantic models for request bodies
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: str = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")

class UserLogin(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Password")

class PromptCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Title of the prompt")
    content: str = Field(..., min_length=1, description="Content/body of the prompt")
    category: Optional[str] = Field(None, description="Optional category (e.g. Coding, Creative)")
    difficulty: Optional[str] = Field("Beginner", description="Difficulty tier (e.g. Beginner, Intermediate, Advanced)")
    tags: Optional[str] = Field(None, description="Optional comma-separated tags")
    is_public: bool = Field(False, description="Whether prompt is public or private")

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Comment body text")

# Authentication Dependencies
def get_current_user(
    request: Request,
    session_id_cookie: Optional[str] = Cookie(None, alias="session_id"),
    authorization: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
) -> Dict[str, Any]:
    """
    Dependency to resolve the currently logged-in user.
    Supports session cookies, Bearer tokens, custom headers, and a fallback development header.
    """
    session_id = session_id_cookie or x_session_id
    
    if not session_id and authorization:
        if authorization.lower().startswith("bearer "):
            session_id = authorization[7:]
        else:
            session_id = authorization

    if session_id and session_id in SESSIONS:
        return SESSIONS[session_id]

    # Development/Testing fallback: allow direct user identification via X-User-Id header
    if x_user_id:
        try:
            uid = int(x_user_id)
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (uid,))
            user = cursor.fetchone()
            conn.close()
            if user:
                return {
                    "user_id": user["id"],
                    "username": user["username"],
                    "email": user["email"]
                }
        except ValueError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in first."
    )

def get_current_user_optional(
    request: Request,
    session_id_cookie: Optional[str] = Cookie(None, alias="session_id"),
    authorization: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
) -> Optional[Dict[str, Any]]:
    """Dependency to retrieve the current user optionally, returning None if unauthenticated."""
    try:
        return get_current_user(request, session_id_cookie, authorization, x_session_id, x_user_id)
    except HTTPException:
        return None

# Endpoints
@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    # Validate email structure
    if not validate_email_format(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
        
    hashed_pwd = hash_password(user_data.password)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (user_data.username, user_data.email, hashed_pwd)
        )
        conn.commit()  # Persistent Guarantee
        user_id = cursor.lastrowid
        return {
            "success": True,
            "message": "User registered successfully",
            "user": {
                "id": user_id,
                "username": user_data.username,
                "email": user_data.email
            }
        }
    except sqlite3.IntegrityError as e:
        err_msg = str(e).lower()
        if "username" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )
        elif "email" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed. Username or email might be taken."
            )
    finally:
        conn.close()

@app.post("/api/auth/login")
def login(login_data: UserLogin, response: Response):
    if not validate_email_format(login_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, password_hash FROM users WHERE email = ?",
        (login_data.email,)
    )
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(user["password_hash"], login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create session
    session_id = secrets.token_hex(24)
    session_data = {
        "user_id": user["id"],
        "username": user["username"],
        "email": user["email"]
    }
    SESSIONS[session_id] = session_data

    # Set Session Cookie
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        max_age=3600 * 24,  # 24 hours
        samesite="lax",
        secure=False  # True in production HTTPS
    )

    return {
        "success": True,
        "message": "Login successful",
        "session": {
            "session_id": session_id,
            "user_id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }

@app.post("/api/prompts", status_code=status.HTTP_201_CREATED)
def create_prompt(prompt_data: PromptCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO prompts (user_id, title, content, category, difficulty, tags, is_public)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["user_id"],
                prompt_data.title,
                prompt_data.content,
                prompt_data.category,
                prompt_data.difficulty,
                prompt_data.tags,
                1 if prompt_data.is_public else 0
            )
        )
        conn.commit()  # Persistent Guarantee
        prompt_id = cursor.lastrowid
        
        # Fetch the created prompt details along with author's username
        cursor.execute(
            """
            SELECT prompts.*, users.username as author_username
            FROM prompts
            JOIN users ON prompts.user_id = users.id
            WHERE prompts.id = ?
            """,
            (prompt_id,)
        )
        prompt = cursor.fetchone()
        
        return {
            "success": True,
            "prompt": dict(prompt)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create prompt: {str(e)}"
        )
    finally:
        conn.close()

@app.get("/api/prompts")
def get_public_prompts():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT prompts.*, users.username as author_username
            FROM prompts
            JOIN users ON prompts.user_id = users.id
            WHERE prompts.is_public = 1
            ORDER BY prompts.created_at DESC
            """
        )
        prompts = cursor.fetchall()
        return {
            "success": True,
            "prompts": [dict(p) for p in prompts]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch public prompts: {str(e)}"
        )
    finally:
        conn.close()

@app.get("/api/prompts/{prompt_id}")
def get_prompt_by_id(prompt_id: int, current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT prompts.*, users.username as author_username
            FROM prompts
            JOIN users ON prompts.user_id = users.id
            WHERE prompts.id = ?
            """,
            (prompt_id,)
        )
        prompt = cursor.fetchone()
        
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prompt not found"
            )
            
        prompt_dict = dict(prompt)
        
        # Access control validation
        if not prompt_dict["is_public"]:
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view this private prompt."
                )
            if current_user["user_id"] != prompt_dict["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view this private prompt."
                )
                
        return {
            "success": True,
            "prompt": prompt_dict
        }
    finally:
        conn.close()

# ─── Comments Endpoints ────────────────────────────────────────────────────

@app.post("/api/prompts/{prompt_id}/comments", status_code=status.HTTP_201_CREATED)
def post_comment(
    prompt_id: int,
    comment_data: CommentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Allows an authenticated user to post a comment on a prompt."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Verify the prompt exists
        cursor.execute("SELECT id FROM prompts WHERE id = ?", (prompt_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prompt not found"
            )
        
        cursor.execute(
            """
            INSERT INTO comments (prompt_id, user_id, content)
            VALUES (?, ?, ?)
            """,
            (prompt_id, current_user["user_id"], comment_data.content)
        )
        conn.commit()  # Persistent Guarantee — writes instantly to disk
        comment_id = cursor.lastrowid
        
        # Return the newly created comment with author info
        cursor.execute(
            """
            SELECT comments.*, users.username as author_username
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.id = ?
            """,
            (comment_id,)
        )
        comment = cursor.fetchone()
        return {"success": True, "comment": dict(comment)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post comment: {str(e)}"
        )
    finally:
        conn.close()

@app.get("/api/prompts/{prompt_id}/comments")
def get_comments(
    prompt_id: int,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Fetches all comments for a given prompt, joined with author usernames."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Verify the prompt exists and check access
        cursor.execute(
            "SELECT id, is_public, user_id FROM prompts WHERE id = ?",
            (prompt_id,)
        )
        prompt = cursor.fetchone()
        if not prompt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prompt not found"
            )
        
        # Access control for private prompts
        if not prompt["is_public"]:
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view comments on a private prompt."
                )
            if current_user["user_id"] != prompt["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view these comments."
                )
        
        cursor.execute(
            """
            SELECT comments.*, users.username as author_username
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.prompt_id = ?
            ORDER BY comments.created_at ASC
            """,
            (prompt_id,)
        )
        comments = cursor.fetchall()
        return {"success": True, "comments": [dict(c) for c in comments]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch comments: {str(e)}"
        )
    finally:
        conn.close()

# Static File Routing to serve frontend directly
@app.get("/")
def get_index():
    frontend_dir = os.path.join(os.path.dirname(current_dir), "frontend")
    return FileResponse(os.path.join(frontend_dir, "index.html"))

@app.get("/styles.css")
def get_styles():
    frontend_dir = os.path.join(os.path.dirname(current_dir), "frontend")
    return FileResponse(os.path.join(frontend_dir, "styles.css"))

@app.get("/dashboard.js")
def get_dashboard():
    frontend_dir = os.path.join(os.path.dirname(current_dir), "frontend")
    return FileResponse(os.path.join(frontend_dir, "dashboard.js"))

if __name__ == "__main__":
    import uvicorn
    # Determine the module name dynamically depending on how it's executed
    module_name = "server"
    if os.path.basename(os.getcwd()) != "app":
        module_name = "app.server"
        
    print("Starting PromptVerse Backend Server...")
    uvicorn.run(f"{module_name}:app", host="127.0.0.1", port=5000, reload=True)
