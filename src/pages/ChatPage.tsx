import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Menu, MenuItem, IconButton, ListItemText, Dialog, DialogTitle, DialogContent, TextField, List, ListItem, Box, ListItemButton, Button } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"; // Add this import
import useMediaQuery from "@mui/material/useMediaQuery";

const ChatPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Responsive state
  const [showSidebar, setShowSidebar] = useState(false);
  const isSmallScreen = useMediaQuery("(max-width: 768px)");
  // New chat dialog state
  const [openNewChat, setOpenNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [newChatSearchResult, setNewChatSearchResult] = useState<any[]>([]);
  const [newChatSearchError, setNewChatSearchError] = useState<string | null>(null);
  const [newChatSelectError, setNewChatSelectError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  // Chatroom column state
  const [chatrooms, setChatrooms] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [selectedChatroom, setSelectedChatroom] = useState<any | null>(null);
  const [chatroomPicError, setChatroomPicError] = useState<{ [chatroomId: string]: boolean }>({});
  const [newChatroomFetchError, setChatroomFetchError] = useState<string | null>(null);
  // Chat area state
  const MESSAGE_MAX_LENGTH = 250; // Example max length for messages
  const wsRef = useRef<WebSocket | null>(null);
  const [inNewChatMode, setInNewChatMode] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [fetchMessagesError, setFetchMessagesError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // Chat area state: scroll management 
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Profile picture error state
  const [profilePicError, setProfilePicError] = useState(false);

  // --------------------------------------------------------------------
  // Handle profile menu

  useEffect(() => {
    setProfilePicError(false);
  }, [user?.photoURL]);
  
  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await signOut();
    handleMenuClose();
  };

  // --------------------------------------------------------------------
  // Handle chatrooms 

  // Fetch chatrooms when user changes or on initial load
  useEffect(() => {
    const fetchChatrooms = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.REACT_APP_API_URL}chatroom/list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: user.uid }),
        });
        if (!response.ok) throw new Error("Failed to fetch chatrooms");
        const data = await response.json();
        setChatrooms(data.chatrooms || []);
      } catch (err) {
        console.error("Error fetching chatrooms:", err);
        setChatroomFetchError("Failed to fetch chatrooms. Please try again.");
      }
    };
    fetchChatrooms();
  }, [user]);

  // After your state declarations
  useEffect(() => {
    if (isSmallScreen && !selectedChatroom && !showSidebar) {
      setShowSidebar(true);
    }
    // Optionally, close sidebar if a chatroom is selected
    if (isSmallScreen && selectedChatroom && showSidebar) {
      setShowSidebar(false);
    }
    // eslint-disable-next-line
  }, [isSmallScreen, selectedChatroom]);

  // --------------------------------------------------------------------
  // Handle new chat dialog

  const handleOpenNewChat = () => setOpenNewChat(true);
  const handleCloseNewChat = () => setOpenNewChat(false);

  // Search function
  // Only execute the search after 2 seconds of inactivity
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (newChatSearch.trim() === "") {
      setSearching(false);
      setNewChatSearchError(null);
      return;
    }

    setSearching(true);
    setNewChatSearchError(null);

    searchTimeout.current = setTimeout(async () => {
      // Search
      try {
        // Get token from Firebase Auth
        const token = await user?.getIdToken?.();
        if (!token) throw new Error("No auth token");

        // Send request to backend
        const response = await fetch(`${process.env.REACT_APP_API_URL}user/new-chat/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: user?.uid,
            search: newChatSearch.trim(),
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to search contacts");
        }

        // Show results
        const data = await response.json();
        setNewChatSearchResult(data.contacts || []);
        setSearching(false);
      }
      catch (error) {
        setNewChatSearchError("Failed to search contacts");
        setNewChatSearchResult([]);
        setSearching(false);
      }
    }, 500);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [newChatSearch]);

  // Handle selecting a contact to start a new chat
  const handleSelectContact = async (contact: any) => {
    setSelectedContact(contact);
    setInNewChatMode(true);
    setOpenNewChat(false);

    // Create or get chatroom from backend
    try {
      const token = await user?.getIdToken?.();
      const response = await fetch(`${process.env.REACT_APP_API_URL}chatroom/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user?.uid,
          contact_id: contact.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to create chatroom");
      const data = await response.json();

      // Add new chatroom to chatrooms state
      setChatrooms((prev) => [...prev, data.chatroom]);
      setSelectedChatroom(data.chatroom);
    } catch (err) {
      setNewChatSelectError("Failed to create chatroom. Please try again.");
    }
  };

  // --------------------------------------------------------------------
  // Handle chat area

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim().slice(0, MESSAGE_MAX_LENGTH);
    if (!selectedChatroom || !user || !trimmedMessage) return;

    // Send to backend
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}message/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatroom_id: selectedChatroom.id,
          user_id: user.uid,
          content: trimmedMessage,
        }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      // Optionally, you can get the saved message from the backend here
    } catch (err) {
      // Optionally: show error to user
      return;
    }

    // Send via WebSocket for real-time update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        chatroom_id: selectedChatroom.id,
        user_id: user.uid,
        content: trimmedMessage,
        created_at: new Date().toISOString(),
      }));
    }

    setMessage("");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        chatroom_id: selectedChatroom.id,
        user_id: user.uid,
        content: trimmedMessage,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  // WebSocket connection for real-time messaging
  // Create new WS connection when chatroom changes
  useEffect(() => {
    if (!selectedChatroom) return;

    // Connect to WebSocket
    const ws = new WebSocket(`${process.env.REACT_APP_API_URL?.replace(/^https?/, 'wss')}ws/chat/${selectedChatroom.id}`);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [selectedChatroom]);

  // Fetch messages when chatroom changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChatroom || !user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.REACT_APP_API_URL}message/list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            chatroom_id: selectedChatroom.id,
            user_id: user.uid,
          }),
        });
        if (!response.ok) throw new Error("Failed to fetch messages");
        const data = await response.json();
        setMessages(data.messages || []);
        setFetchMessagesError(null);
      } catch (err) {
        setMessages([]);
        setFetchMessagesError("Failed to load messages. Please try again.");
      }
    };
    fetchMessages();
  }, [selectedChatroom]);

  // Scroll to bottom if at bottom when messages change
  useEffect(() => {
    if (isAtBottom && chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  // Track scroll position
  const handleChatAreaScroll = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
  };

  return (
    <div className="min-h-screen flex bg-gray-50 relative">
      {/* Sidebar for small screens: Full width overlay */}
      {isSmallScreen && (
        <div
          className={`
            fixed inset-0 z-50 bg-white flex flex-col transition-transform duration-300
            ${showSidebar ? "translate-x-0" : "-translate-x-full"}
          `}
          style={{ willChange: "transform" }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <span className="text-2xl font-bold font-pacifico orange-purple-gradient-text">Chit-Chat</span>
            <IconButton onClick={handleProfileClick}>
              {user?.photoURL && !profilePicError ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                  onError={() => setProfilePicError(true)}
                />
              ) : (
                <AccountCircleIcon fontSize="large" />
              )}
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem disabled>
                <ListItemText
                  primary={`Hi, ${user?.displayName || "User"}!`}
                  primaryTypographyProps={{ fontWeight: "bold" }}
                />
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </div>
          <div className="flex-1 overflow-y-auto">
            <List>
              {chatrooms.length === 0 ? (
                <ListItem className="text-gray-400 text-center justify-center">No chatrooms yet</ListItem>
              ) : (
                chatrooms.map((chatroom) => (
                  <ListItem
                    key={chatroom.id}
                    className="w-full"
                    disablePadding
                  >
                    <ListItemButton
                      className={`w-full ${
                        isSmallScreen
                          ? "" // No highlight on small screens
                          : selectedChatroom?.id === chatroom.id
                            ? "bg-blue-100"
                            : ""
                      }`}
                      selected={!isSmallScreen && selectedChatroom?.id === chatroom.id}
                      onClick={() => {
                        setSelectedChatroom(chatroom);
                        setInNewChatMode(false);
                        if (isSmallScreen) setShowSidebar(false);
                      }}
                    >
                      <Box className="flex flex-row items-center w-full gap-2">
                        {chatroom.chatroom_pic_url && !chatroomPicError[chatroom.id] ? (
                          <img
                            src={chatroom.chatroom_pic_url}
                            alt="Profile"
                            style={{ width: 40, height: 40, borderRadius: "50%" }}
                            onError={() =>
                              setChatroomPicError(prev => ({ ...prev, [chatroom.id]: true }))
                            }
                          />
                        ) : (
                          <AccountCircleIcon className="text-gray-400" />
                        )}
                        <Box className="flex flex-col items-start w-full">
                          <span className="font-medium text-left w-full">
                            {chatroom.name && chatroom.name.trim()
                              ? chatroom.name
                              : (() => {
                                  if (chatroom.members && Array.isArray(chatroom.members)) {
                                    const other = chatroom.members.find((m: any) => m.user_id !== user?.uid);
                                    return other?.display_name || "Unnamed Chat";
                                  }
                                  return "Unnamed Chat";
                                })()
                            }
                          </span>
                          <span className="text-xs text-gray-400 text-left w-full">
                            {chatroom.last_message
                              ? chatroom.last_message.content
                              : <span style={{ fontStyle: "italic", color: "#9ca3af" }}>Draft</span>
                            }
                          </span>
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          </div>
          <button
            className="w-full bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 transition"
            onClick={handleOpenNewChat}
          >
            New Chat
          </button>
        </div>
      )}

      {/* Sidebar for large screens */}
      {!isSmallScreen && (
        <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <span className="text-2xl font-bold font-pacifico orange-purple-gradient-text">Chit-Chat</span>
            <IconButton onClick={handleProfileClick}>
              {user?.photoURL && !profilePicError ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                  onError={() => setProfilePicError(true)}
                />
              ) : (
                <AccountCircleIcon fontSize="large" />
              )}
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem disabled>
                <ListItemText
                  primary={`Hi, ${user?.displayName || "User"}!`}
                  primaryTypographyProps={{ fontWeight: "bold" }}
                />
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </div>
          {/* Chatroom list */}
          <div className="flex-1 overflow-y-auto">
            <List>
              {chatrooms.length === 0 ? (
                <ListItem className="text-gray-400 text-center justify-center">No chatrooms yet</ListItem>
              ) : (
                chatrooms.map((chatroom) => (
                  <ListItem
                    key={chatroom.id}
                    className="w-full"
                    disablePadding
                  >
                    <ListItemButton
                      className="w-full"
                      selected={selectedChatroom?.id === chatroom.id}
                      onClick={() => {
                        setSelectedChatroom(chatroom);
                        setInNewChatMode(false);
                      }}
                    >
                      <Box className="flex flex-row items-center w-full gap-2">
                        {chatroom.chatroom_pic_url && !chatroomPicError[chatroom.id] ? (
                          <img
                            src={chatroom.chatroom_pic_url}
                            alt="Profile"
                            style={{ width: 40, height: 40, borderRadius: "50%" }}
                            onError={() =>
                              setChatroomPicError(prev => ({ ...prev, [chatroom.id]: true }))
                            }
                          />
                        ) : (
                          <AccountCircleIcon className="text-gray-400" />
                        )}
                        <Box className="flex flex-col items-start w-full">
                          <span className="font-medium text-left w-full">
                            {chatroom.name && chatroom.name.trim()
                              ? chatroom.name
                              : (() => {
                                  // Find the other member's display name if available
                                  if (chatroom.members && Array.isArray(chatroom.members)) {
                                    // Exclude current user
                                    const other = chatroom.members.find((m: any) => m.user_id !== user?.uid);
                                    return other?.display_name || "Unnamed Chat";
                                  }
                                  return "Unnamed Chat";
                                })()
                            }
                          </span>
                          <span className="text-xs text-gray-400 text-left w-full">
                            {chatroom.last_message
                              ? chatroom.last_message.content
                              : <span style={{ fontStyle: "italic", color: "#9ca3af" }}>Draft</span>
                            }
                          </span>
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          </div>
          <button
            className="w-full bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 transition"
            onClick={handleOpenNewChat}
          >
            New Chat
          </button>
        </div>
      )}

      {/* Right column: Chatroom content */}
      <div className="flex-1 flex items-center justify-center bg-white">
        {selectedChatroom || inNewChatMode ? (
          <div className="w-full flex flex-col h-[100vh]">
            {/* Header: Back icon (small screens) + Profile icon + Display name */}
            <div className="flex items-center gap-3 px-6 py-4">
              {isSmallScreen && (
                <IconButton onClick={() => setShowSidebar(true)}>
                  <ArrowBackIosNewIcon />
                </IconButton>
              )}
              {selectedChatroom.chatroom_pic_url && !chatroomPicError[selectedChatroom.id] ? (
                <img
                  src={selectedChatroom.chatroom_pic_url}
                  alt="Profile"
                  style={{ width: 40, height: 40, borderRadius: "50%" }}
                  onError={() =>
                    setChatroomPicError(prev => ({ ...prev, [selectedChatroom.id]: true }))
                  }
                />
              ) : (
                <AccountCircleIcon className="text-gray-400" />
              )}
              <span className="font-semibold text-lg">
                {inNewChatMode && selectedContact
                  ? selectedContact.display_name
                  : selectedChatroom && selectedChatroom.members && Array.isArray(selectedChatroom.members)
                    ? (() => {
                        const other = selectedChatroom.members.find((m: any) => m.user_id !== user?.uid);
                        return other?.display_name || "User";
                      })()
                    : "User"
                }
              </span>
            </div>
            {/* Chat area */}
            <div
              ref={chatAreaRef}
              onScroll={handleChatAreaScroll}
              className="flex-1 px-6 py-4 overflow-y-auto flex flex-col gap-2"
            >
              {inNewChatMode && !selectedChatroom ? (
                <span className="text-gray-400 text-center text-base self-center">
                  Casual greeting? Some gossip you just can't keep to yourself?<br />Start chit-chatting!
                </span>
              ) : fetchMessagesError ? (
                <span className="text-red-500 text-center self-center">{fetchMessagesError}</span>
              ) : messages.length === 0 ? (
                <span className="text-gray-400 text-center self-center">No messages yet</span>
              ) : (
                messages.map((msg, idx) => (
                  <Box
                    key={msg.id || idx}
                    className={`px-4 py-2 rounded-lg max-w-[70%] mb-2 ${
                      msg.user_id === user?.uid
                        ? "bg-blue-100 self-end"
                        : "bg-gray-100 self-start"
                    }`}
                  >
                    <span className="block text-sm font-medium text-gray-700">
                      {msg.user_id === user?.uid ? "You" : (() => {
                        const sender = selectedChatroom?.members?.find((m: any) => m.user_id === msg.user_id);
                        return sender?.display_name || "Other";
                      })()}
                    </span>
                    <span className="block">{msg.content}</span>
                    <span className="block text-xs text-gray-400 mt-1">
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleString(undefined, {
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </Box>
                ))
              )}
            </div>
            {/* Message input */}
            <form className="flex items-center gap-2 px-6 py-4" onSubmit={handleSendMessage}>
              <TextField
              variant="outlined"
              placeholder="Type a message..."
              fullWidth
              size="small"
              value={message}
              onChange={e => {
                if (e.target.value.length <= MESSAGE_MAX_LENGTH) {
                  setMessage(e.target.value);
                  }
                }}
              />
              <Button
              variant="contained"
              color="primary"
              disabled={message.trim() === ""}
              type="submit"
              >
              Send
              </Button>
            </form>
          </div>
        ) : (
          <span className="text-gray-400 text-lg">
            Select a chatroom to start chatting
          </span>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog
        open={openNewChat}
        onClose={handleCloseNewChat}
        PaperProps={{
          className: "rounded-lg",
          style: { minHeight: 400, minWidth: 320, display: "flex", flexDirection: "column" },
        }}
      >
        <DialogTitle>Start a new chit-chat!</DialogTitle>
        <DialogContent className="flex flex-col flex-1">
          <TextField
            label="Search contacts"
            variant="standard"
            fullWidth
            value={newChatSearch}
            onChange={e => setNewChatSearch(e.target.value)}
            helperText="Search by full email address of a registered user"
            className="mb-4"
          />
          <Box className="flex-1 flex flex-col justify-start">
            <List>
              {searching ? (
                <ListItem className="text-gray-400 text-center justify-center">Searching...</ListItem>
              ) : newChatSearchError ? (
                <ListItem className="text-red-500 text-center justify-center">{newChatSearchError}</ListItem>
              ) : newChatSearchResult.length === 0 ? (
                <ListItem className="text-gray-400 text-center justify-center">No contact</ListItem>
              ) : (
                newChatSearchResult.map((contact) => (
                  <ListItem
                    key={contact.id}
                    alignItems="flex-start"
                    className="w-full"
                    disablePadding
                  >
                    <ListItemButton
                      className="w-full"
                      onClick={() => handleSelectContact(contact)}
                    >
                      <Box className="flex flex-col items-start w-full">
                        <span className="font-medium text-left w-full">{contact.display_name}</span>
                        <span className="text-sm text-gray-500 text-left w-full">{contact.email}</span>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          </Box>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;