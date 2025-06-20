from fastapi import FastAPI, Request, HTTPException, status, Depends, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
import sqlite3
import mysql.connector
import uuid
import datetime
from typing import TypedDict, Optional

MESSAGE_MAX_LENGTH = 250

load_dotenv()  # Load environment variables from .env
active_connections = {} # To keep track of active WebSocket connections

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    firebase_admin.initialize_app(cred)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://chitchat-ce06a.web.app"
    ],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Chatroom(TypedDict):
    id: str
    name: str
    created_by: str
    created_at: datetime.datetime
    members: list["ChatroomMember"]
    last_message: "Message" # For showing in the chatroom list
    chatroom_pic_url: Optional[str]  # Optional, can be None if not set

class User(TypedDict):
    id: str
    display_name: str
    email: str
    created_at: datetime.datetime
    profile_pic_url: Optional[str]  # Optional, can be None if not set

class ChatroomMember(TypedDict):
    id: int
    chatroom_id: str
    user_id: str
    joined_at: datetime.datetime

class Message(TypedDict):
    id: int
    chatroom_id: str
    user_id: str
    content: str
    created_at: datetime.datetime

async def verify_token(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

# WebSocket endpoint for chatrooms
@app.websocket("/ws/chat/{chatroom_id}")
async def websocket_endpoint(websocket: WebSocket, chatroom_id: str):
    await websocket.accept()
    if chatroom_id not in active_connections:
        active_connections[chatroom_id] = []
    active_connections[chatroom_id].append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast to all clients in this chatroom
            for conn in active_connections[chatroom_id]:
                if conn != websocket:
                    await conn.send_text(data)
    except WebSocketDisconnect:
        active_connections[chatroom_id].remove(websocket)

@app.post("/user/login")
async def handle_user_login(request: Request, decoded_token: dict = Depends(verify_token)):
    try:
        data = await request.json()
        user_id = data.get("user_id")
        firebase_uid = decoded_token.get("uid")

        if user_id != firebase_uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")

        user = firebase_auth.get_user(firebase_uid)
        username = user.display_name
        email = user.email
        photo_url = user.photo_url

        if not username or not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have a username or email")

        # Connect to MySQL database
        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor()
        # Check if user already exists in the database
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user_record = cursor.fetchone()
        
        # If user does not exist, insert new user record
        if not user_record:
            print("User does not exist, inserting new user record")
            current_time = datetime.datetime.utcnow().isoformat()
            cursor.execute(
                "INSERT INTO users (id, display_name, email, created_at) VALUES (%s, %s, %s, %s)",
                (user_id, username, email, current_time)
            )
            db_conn.commit()
        else:
            existing_photo_url = user_record[0]
            # Update profile_pic_url if it has changed
            if photo_url and photo_url != existing_photo_url:
                cursor.execute(
                    "UPDATE users SET profile_pic_url = %s WHERE email = %s",
                    (photo_url, email)
                )
                db_conn.commit()


        db_conn.close()

        return {"status": "success", "username": username, "profile_pic_url": photo_url}
    
    except HTTPException:
        raise  # Let FastAPI handle HTTPExceptions as usual
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/user/new-chat/search")
async def search_contacts(
    request: Request,
    decoded_token: dict = Depends(verify_token),
    body: dict = Body(...)
):
    try:
        user_id = body.get("user_id")
        search = body.get("search", "").strip()
        firebase_uid = decoded_token.get("uid")

        if user_id != firebase_uid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")

        if not search:
            return {"contacts": []}

        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor(dictionary=True)
        
        cursor.execute(
            """
            SELECT id, display_name, email FROM users
            WHERE (email = %s)
              AND id != %s
            """,
            (search, user_id)
        )
        contacts = cursor.fetchall()
        db_conn.close()

        return {"contacts": contacts}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    
@app.post("/chatroom/list")
async def get_chatrooms(request: Request, decoded_token: dict = Depends(verify_token), body: dict = Body(...)):
    user_id = body.get("user_id")
    firebase_uid = decoded_token.get("uid")

    if user_id != firebase_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")

    try:
        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor(dictionary=True)

        # 1. Fetch chatrooms with last message
        cursor.execute(
            """
            SELECT
                c.id,
                c.name,
                c.created_by,
                c.created_at,
                m.id AS last_message_id,
                m.chatroom_id AS last_message_chatroom_id,
                m.user_id AS last_message_user_id,
                m.content AS last_message_content,
                m.created_at AS last_message_created_at
            FROM chatrooms c
            JOIN chatroom_members cm ON c.id = cm.chatroom_id
            LEFT JOIN (
                SELECT t1.*
                FROM messages t1
                INNER JOIN (
                    SELECT chatroom_id, MAX(created_at) AS max_created_at
                    FROM messages
                    GROUP BY chatroom_id
                ) t2 ON t1.chatroom_id = t2.chatroom_id AND t1.created_at = t2.max_created_at
            ) m ON c.id = m.chatroom_id
            WHERE cm.user_id = %s
            ORDER BY c.created_at DESC
            """,
            (user_id,)
        )
        chatrooms_raw = cursor.fetchall()

        # 2. Get all chatroom IDs
        chatroom_ids = [c["id"] for c in chatrooms_raw]
        members_by_chatroom = {}

        if chatroom_ids:
            # 3. Fetch all members for these chatrooms
            format_strings = ','.join(['%s'] * len(chatroom_ids))
            cursor.execute(
                f"""
                SELECT cm.chatroom_id, u.id, u.display_name, u.email, u.profile_pic_url
                FROM chatroom_members cm
                JOIN users u ON cm.user_id = u.id
                WHERE cm.chatroom_id IN ({format_strings})
                """,
                tuple(chatroom_ids)
            )
            members_raw = cursor.fetchall()

            # 4. Group members by chatroom_id
            from collections import defaultdict
            members_by_chatroom = defaultdict(list)
            for m in members_raw:
                members_by_chatroom[m["chatroom_id"]].append({
                    "user_id": m["id"],
                    "display_name": m["display_name"],
                    "email": m["email"],
                    "profile_pic_url": m.get("profile_pic_url")  # Optional field
                })

        db_conn.close()

        # 5. Build response
        chatrooms: list[Chatroom] = []
        for c in chatrooms_raw:
            last_message = None
            if c["last_message_id"]:
                last_message = {
                    "id": c["last_message_id"],
                    "chatroom_id": c["last_message_chatroom_id"],
                    "user_id": c["last_message_user_id"],
                    "content": c["last_message_content"],
                    "created_at": c["last_message_created_at"],
                }

            # Find the other user (not the requesting user)
            members = members_by_chatroom.get(c["id"], [])
            other_member = next((m for m in members if m["user_id"] != user_id), None)
            chatroom_pic_url = other_member.get("profile_pic_url") if other_member else None

            print(other_member)
            print(chatroom_pic_url)

            chatrooms.append({
                "id": c["id"],
                "name": c["name"],
                "created_by": c["created_by"],
                "created_at": c["created_at"],
                "members": members_by_chatroom.get(c["id"], []),
                "last_message": last_message,
                "chatroom_pic_url": chatroom_pic_url
            })

        return {"chatrooms": chatrooms}
    except HTTPException:
        raise
    except Exception as e:
        print (f"Error fetching chatrooms: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/chatroom/create")
async def create_chatroom(request: Request, decoded_token: dict = Depends(verify_token), body: dict = Body(...)):
    user_id = body.get("user_id")
    contact_id = body.get("contact_id")
    firebase_uid = decoded_token.get("uid")

    if user_id != firebase_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")
    
    if not contact_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact ID is required")
    
    if user_id == contact_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create chatroom with self")
    
    try:
        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor()

        # Check if chatroom already exists
        # Checked in frontend, but also check here for safety
        cursor.execute(
            """
            SELECT c.id
            FROM chatrooms c
            JOIN chatroom_members m1 ON c.id = m1.chatroom_id AND m1.user_id = %s
            JOIN chatroom_members m2 ON c.id = m2.chatroom_id AND m2.user_id = %s
            WHERE (
                SELECT COUNT(*) FROM chatroom_members cm WHERE cm.chatroom_id = c.id
            ) = 2
            LIMIT 1
            """,
            (user_id, contact_id)
        )
        chatroom = cursor.fetchone()
        if chatroom:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chatroom already exists between these users"
            )

        # Create new chatroom
        chatroom_id = str(uuid.uuid4())
        chatroom_name = "" # Leave empty for now, can be set later when implementing group chat
        created_at = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            "INSERT INTO chatrooms (id, name, created_by, created_at) VALUES (%s, %s, %s, %s)",
            (chatroom_id, chatroom_name, user_id, created_at)
        )
        # Add both users to chatroom_members
        cursor.execute(
            "INSERT INTO chatroom_members (chatroom_id, user_id) VALUES (%s, %s)",
            (chatroom_id, user_id)
        )
        cursor.execute(
            "INSERT INTO chatroom_members (chatroom_id, user_id) VALUES (%s, %s)",
            (chatroom_id, contact_id)
        )
        db_conn.commit()
        db_conn.close()

        # Create Chatroom instance
        chatroom: Chatroom = {
            "id": chatroom_id,
            "name": chatroom_name,
            "created_by": user_id,
            "created_at": created_at,
            "members": [
                {"user_id": user_id},
                {"user_id": contact_id}
            ],
            "last_message": None 
        }

        return {"status": "success", "chatroom": chatroom}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    
@app.post("/message/list")
async def get_messages(request: Request, decoded_token: dict = Depends(verify_token), body: dict = Body(...)):
    chatroom_id = body.get("chatroom_id")
    user_id = body.get("user_id")
    firebase_uid = decoded_token.get("uid")

    if user_id != firebase_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")
    
    if not chatroom_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing chatroom_id")

    try:
        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor(dictionary=True)
        
        # Check if user is a member of the chatroom
        cursor.execute(
            "SELECT 1 FROM chatroom_members WHERE chatroom_id = %s AND user_id = %s LIMIT 1",
            (chatroom_id, user_id)
        )
        membership = cursor.fetchone()
        if not membership:
            db_conn.close()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a member of this chatroom")
        
        # Fetch messages for the chatroom
        cursor.execute(
            """
            SELECT id, chatroom_id, user_id, content, created_at
            FROM messages
            WHERE chatroom_id = %s
            ORDER BY created_at ASC
            """,
            (chatroom_id,)
        )
        messages = cursor.fetchall()
        db_conn.close()
        
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    
@app.post("/message/send")
async def send_message(request: Request, decoded_token: dict = Depends(verify_token), body: dict = Body(...)):
    chatroom_id = body.get("chatroom_id")
    user_id = body.get("user_id")
    content = (body.get("content") or "").strip()
    firebase_uid = decoded_token.get("uid")

    if user_id != firebase_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ID does not match token")
    
    if not chatroom_id or not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing chatroom_id or content")
    
    if len(content) > MESSAGE_MAX_LENGTH:
        content = content[:MESSAGE_MAX_LENGTH]

    try:
        db_conn = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
        )
        cursor = db_conn.cursor()
        cursor.execute(
            "INSERT INTO messages (chatroom_id, user_id, content, created_at) VALUES (%s, %s, %s, %s)",
            (chatroom_id, user_id, content, datetime.datetime.utcnow())
        )
        db_conn.commit()
        db_conn.close()

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")