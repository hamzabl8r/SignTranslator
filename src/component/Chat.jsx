import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getConversations,
  getMessages,
  getAllUsers,
  setCurrentConversation,
  addMessage,
  initializeSocket,
  sendMessageSocket,
  markReadSocket,
  markMessageRead,
} from '../redux/Slice/messageSlice';
import toast from 'react-hot-toast';
import VideoCall from './VideoCall';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import './Styles/Chat.css';

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [messageText, setMessageText] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );

  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.user);
  const { conversations, messages, users, sending } = useSelector((state) => state.message);

  const messagesEndRef = useRef(null);

 
  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const isMobile = () => window.innerWidth <= 768;

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  const handleUserSelect = (user) => {
    if (!user?._id) return;
    setSelectedUser(user);
    setShowUserList(false);
    closeSidebar();
    navigate(`/chat/${user._id}`, { replace: true });
  };

  const handleBack = () => {
    setSelectedUser(null);
    navigate('/chat', { replace: true });
  };

  const handleStartVideoCall = () => {
    if (!selectedUser) { toast.error('Please select a user first'); return; }
    setPendingIncomingCall(null);
    setShowVideoCall(true);
  };

  // Auto-select user from URL param once users are loaded
  useEffect(() => {
    if (!userId || !users?.length) return;
    const userFromUrl = users.find((u) => u._id === userId);
    if (userFromUrl && userFromUrl._id !== selectedUser?._id) {
      setSelectedUser(userFromUrl);
      if (isMobile()) setIsSidebarOpen(false);
    }
  }, [userId, users]);

  // Also check conversations if user not in users list
  useEffect(() => {
    if (!userId || !conversations?.length || selectedUser) return;
    const conv = conversations.find((c) => c.participant?._id === userId);
    if (conv?.participant) {
      setSelectedUser(conv.participant);
      if (isMobile()) setIsSidebarOpen(false);
    }
  }, [userId, conversations]);

  // Auto-open sidebar on mobile when no conversation selected
  useEffect(() => {
    if (isMobile() && !selectedUser) setIsSidebarOpen(true);
    if (isMobile() && selectedUser) setIsSidebarOpen(false);
  }, [selectedUser]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile()) setIsSidebarOpen(false);
      else if (!selectedUser) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedUser]);

  // FIX 2: Socket initialization — dispatch the thunk properly.
  // FIX 3: Remove selectedUser from the dependency array to avoid re-registering
  //         listeners on every user selection. Use selectedUserRef instead.
  useEffect(() => {
    if (!currentUser?._id) return;

    initializeSocket(currentUser._id);

    const handleNewMessage = (message) => {
      dispatch(addMessage(message));
      dispatch(getConversations());
      soundService.playMessageReceived();
      toast.success(`New message from ${message.sender?.firstName || 'Unknown'}`);
    };

    const handleMessageSent = (message) => {
      dispatch(addMessage(message));
      soundService.playMessageSent();
    };

    // FIX 4: Use selectedUserRef.current instead of stale selectedUser closure
    const handleMessagesRead = (data) => {
      if (selectedUserRef.current?._id === data.userId) {
        dispatch(markMessageRead({ conversationId: data.conversationId }));
      }
    };

    const handleIncomingCall = (data) => {
      if (data.fromUserId !== currentUser._id) {
        setPendingIncomingCall(data);
        setShowVideoCall(true);
        soundService.startRingtone();
        toast(`📞 Incoming call from ${data.callerInfo?.name || 'Someone'}`, {
          duration: 10000,
          icon: '📞',
        });
      }
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('message_sent', handleMessageSent);
    socketService.on('messages_read', handleMessagesRead);
    socketService.on('incoming_call', handleIncomingCall);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('message_sent', handleMessageSent);
      socketService.off('messages_read', handleMessagesRead);
      socketService.off('incoming_call', handleIncomingCall);
    };
  // selectedUser intentionally removed — using selectedUserRef to avoid stale closure
  // while preventing unnecessary listener re-registration
  }, [currentUser, dispatch]);

  // Load conversations and users
  useEffect(() => {
    if (currentUser) {
      dispatch(getConversations());
      dispatch(getAllUsers());
    }
  }, [dispatch, currentUser]);

  // Load messages when user is selected
  useEffect(() => {
    if (!selectedUser) return;
    const existingConv = conversations?.find(
      (conv) => conv.participant?._id === selectedUser._id
    );
    if (existingConv) {
      dispatch(setCurrentConversation(existingConv));
      dispatch(getMessages(existingConv._id));
      if (socketService.isConnected()) {
        // FIX 5: markReadSocket is a plain function — call directly, not dispatched
        markReadSocket({ conversationId: existingConv._id, userId: currentUser?._id });
      }
    } else {
      dispatch(setCurrentConversation({ participant: selectedUser }));
    }
  }, [selectedUser, conversations, dispatch, currentUser]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim()) { toast.error('Please enter a message'); return; }
    if (!selectedUser) { toast.error('Please select a user to chat with'); return; }
    // FIX 6: sendMessageSocket is a plain function — call directly, not dispatched
    sendMessageSocket({ senderId: currentUser._id, receiverId: selectedUser._id, text: messageText });
    setMessageText('');
  };

  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const getImageUrl = (path) =>
    path
      ? `https://backpfe-production-789f.up.railway.app${path}`
      : 'https://img.freepik.com/free-vector/user-blue-gradient_78370-4692.jpg?w=150';
  const getLastMessage = (conv) => conv?.lastMessage?.text || 'No messages yet';
  const getLastMessageTime = (conv) => formatTime(conv?.lastMessage?.createdAt);
  const filteredUsers = users?.filter((u) => u._id !== currentUser?._id) || [];

  if (!currentUser) {
    return <div className="loading-container"><div className="spinner"></div></div>;
  }

  return (
    <>
      <div className="chat-container">
        <button className="menu-btn" onClick={toggleSidebar} aria-label="Open sidebar">☰</button>

        {isSidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

        <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Messages</h3>
            <button className="new-chat-btn" onClick={() => setShowUserList((p) => !p)}>
              New Chat
            </button>
            <button className="close-sidebar-btn" onClick={closeSidebar} aria-label="Close">✕</button>
          </div>

          {showUserList && (
            <div className="user-list">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div key={user._id} className="user-item" onClick={() => handleUserSelect(user)}>
                    <img src={getImageUrl(user.profilePicture)} alt={user.firstName} width="44" height="44" />
                    <div><strong>{user.firstName} {user.lastName}</strong></div>
                  </div>
                ))
              ) : (
                <p style={{ padding: '12px', color: 'var(--text-dim)' }}>No other users found.</p>
              )}
            </div>
          )}

          <div className="conversations-list">
            {conversations?.length > 0 ? (
              conversations.map((conversation) => (
                <div
                  key={conversation._id}
                  className={`conversation-item ${
                    selectedUser?._id === conversation.participant?._id ? 'active' : ''
                  }`}
                  onClick={() => handleUserSelect(conversation.participant)}
                >
                  <img
                    src={getImageUrl(conversation.participant?.profilePicture)}
                    alt={conversation.participant?.firstName}
                    width="48" height="48"
                  />
                  <div className="conversation-content">
                    <div className="conversation-name">
                      <strong>{conversation.participant?.firstName} {conversation.participant?.lastName}</strong>
                    </div>
                    <div className="conversation-last-message">{getLastMessage(conversation)}</div>
                  </div>
                  <small className="conversation-time">{getLastMessageTime(conversation)}</small>
                </div>
              ))
            ) : (
              <div className="empty-sidebar-state">
                <p>No conversations yet</p>
                <p>Click "New Chat" to start messaging</p>
              </div>
            )}
          </div>
        </aside>

        <section className="chat-area">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <button className="back-btn" onClick={handleBack} aria-label="Back to conversations">
                  ←
                </button>
                <img src={getImageUrl(selectedUser.profilePicture)} alt={selectedUser.firstName} width="48" height="48" />
                <div className="chat-user-info">
                  <h4>{selectedUser.firstName} {selectedUser.lastName}</h4>
                </div>
                <button className="video-call-btn" onClick={handleStartVideoCall} aria-label="Start video call" title="Start video call">
                  📹
                </button>
              </div>

              <div className="messages-container">
                {messages?.length > 0 ? (
                  messages.map((message) => {
                    const isSent = message.sender === currentUser._id || message.sender?._id === currentUser._id;
                    return (
                      <div key={message._id} className={`message ${isSent ? 'sent' : 'received'}`}>
                        <img
                          className="message-avatar"
                          src={getImageUrl(isSent ? currentUser.profilePicture : selectedUser.profilePicture)}
                          alt="avatar" width="32" height="32"
                        />
                        <div>
                          <div className="message-text">{message.text}</div>
                          <small className="message-time">{formatTime(message.createdAt)}</small>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="no-chat-selected">
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                )}
                <div ref={messagesEndRef}></div>
              </div>

              <form className="message-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <button type="submit" disabled={sending}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <div>
                <h3>Select a conversation</h3>
                <p>Select a conversation or click "New Chat" to start messaging</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {showVideoCall && (
        <VideoCall
          incomingCall={pendingIncomingCall}
          selectedUser={selectedUser}
          currentUser={currentUser}
          onClose={() => {
            setShowVideoCall(false);
            setPendingIncomingCall(null);
            soundService.stopRingtone();
          }}
        />
      )}
    </>
  );
};

export default Chat;