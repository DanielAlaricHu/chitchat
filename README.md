# Chit-Chat

Chit-Chat is a real-time chat application built with React, FastAPI, and hosted on Firebase Hosting (frontend) and Google Cloud Run (backend). It supports WebSocket-based messaging for real-time communication and integrates with Firebase Authentication for user management.

## Live Demo
The project can be tested at:  
[https://chitchat-ce06a.web.app](https://chitchat-ce06a.web.app)

## Features
- **Real-time messaging** using WebSockets
- **Google login** via Firebase Authentication
- **Chatroom** creation and joining
- **Responsive UI** for desktop and mobile
- Frontend hosted on **Firebase Hosting**
- Backend hosted on **Google Cloud Run**
- MySQL database hosted on **Google Cloud SQL**

## Technologies Used

### Frontend
- React with TypeScript
- Material UI (MUI)
- Tailwind CSS (optional for utility classes)
- Firebase Authentication
- Firebase Hosting

### Backend
- FastAPI (Python)
- WebSockets
- REST APIs
- Firebase Admin SDK
- Google Cloud Run
- MySQL (Google Cloud SQL)

## Usage
1. Visit the frontend (Firebase Hosting)
2. Log in with Google
3. Create a chatroom by clicking "New Chat" (Search by complete email address of another existing user)
4. Start messaging in real time

## Known Limitations
- New chatrooms may not appear until refresh
- WebSocket connection has a timeout of 3600s on Cloud Run

## Future Improvements
- Typing indicators
- Read receipts
- Push notifications
- Pagination
- Real-time chatroom list updates
- Search and sorting
- Contact management

## License
This project is licensed under the MIT License.