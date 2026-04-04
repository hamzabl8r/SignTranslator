// component/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
    getConversations, 
    getMessages, 
    getAllUsers,
    setCurrentConversation,
    addMessage,
    initializeSocket,
    disconnectSocket,
    sendMessageSocket,
    markReadSocket,
    markMessageRead
} from '../redux/Slice/messageSlice';
import toast from 'react-hot-toast';
import VideoCall from './VideoCall';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import './Styles/Chat.css';

const Chat = () => {
    const [messageText, setMessageText] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserList, setShowUserList] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    // ✅ FIX: Track incoming call at Chat level so VideoCall can be shown automatically
    const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
    
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.user);
    const { conversations, messages, users, sending } = useSelector((state) => state.message);
    
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    // Initialiser Socket.IO
    useEffect(() => {
        if (currentUser?._id) {
            console.log('🔌 Initializing socket for chat...');
            const socket = initializeSocket(currentUser._id);
            socketRef.current = socket;
            
            if (socket) {
                socketService.on('registered', (data) => {
                    console.log('✅ Socket registered:', data);
                });
                
                socketService.on('new_message', (message) => {
                    console.log('New message received:', message);
                    dispatch(addMessage(message));
                    dispatch(getConversations());
                    soundService.playMessageReceived(); // 🔔 son message reçu
                    toast.success(`New message from ${message.sender?.firstName || 'Unknown'}`);
                });
                
                socketService.on('message_sent', (message) => {
                    console.log('Message sent:', message);
                    dispatch(addMessage(message));
                    soundService.playMessageSent(); // 📤 son message envoyé
                });
                
                socketService.on('messages_read', (data) => {
                    console.log('Messages read:', data);
                    if (selectedUser?._id === data.userId) {
                        dispatch(markMessageRead({ conversationId: data.conversationId }));
                    }
                });

                // ✅ FIX: Listen for incoming_call HERE (Chat is always mounted)
                // This ensures the listener is active even when VideoCall is not open
                socketService.on('incoming_call', (data) => {
                    console.log('📞 INCOMING CALL received in Chat.jsx:', data);
                    
                    if (data.fromUserId !== currentUser._id) {
                        // Save the incoming call data and open VideoCall component
                        setPendingIncomingCall(data);
                        setShowVideoCall(true);
                        soundService.startRingtone(); // 📞 sonnerie appel entrant

                        // Show a toast notification as backup
                        toast(`📞 Incoming call from ${data.callerInfo?.name || 'Someone'}`, {
                            duration: 10000,
                            icon: '📞',
                        });

                        // Request notification permission and show browser notification
                        if ('Notification' in window) {
                            if (Notification.permission === 'granted') {
                                new Notification('📞 Incoming Video Call', {
                                    body: `${data.callerInfo?.name || 'Someone'} is calling you...`,
                                    icon: data.callerInfo?.profilePic || '/default-avatar.png',
                                });
                            } else if (Notification.permission !== 'denied') {
                                Notification.requestPermission().then(permission => {
                                    if (permission === 'granted') {
                                        new Notification('📞 Incoming Video Call', {
                                            body: `${data.callerInfo?.name || 'Someone'} is calling you...`,
                                        });
                                    }
                                });
                            }
                        }
                    }
                });
            }
            
            return () => {
                socketService.off('registered');
                socketService.off('new_message');
                socketService.off('message_sent');
                socketService.off('messages_read');
                socketService.off('incoming_call'); // ✅ Cleanup
            };
        }
    }, [currentUser, dispatch, selectedUser]);

    // Charger les conversations et utilisateurs
    useEffect(() => {
        if (currentUser) {
            dispatch(getConversations());
            dispatch(getAllUsers());
        }
    }, [dispatch, currentUser]);

    // Quand un utilisateur est sélectionné
    useEffect(() => {
        if (selectedUser) {
            const existingConv = conversations?.find(
                conv => conv.participant?._id === selectedUser._id
            );
            if (existingConv) {
                dispatch(setCurrentConversation(existingConv));
                dispatch(getMessages(existingConv._id));
                if (socketService.isConnected()) {
                    markReadSocket({ 
                        conversationId: existingConv._id, 
                        userId: currentUser?._id 
                    });
                }
            } else {
                dispatch(setCurrentConversation({ participant: selectedUser }));
            }
        }
    }, [selectedUser, conversations, dispatch, currentUser]);

    // Scroll automatique
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageText.trim()) {
            toast.error("Please enter a message");
            return;
        }
        if (!selectedUser) {
            toast.error("Please select a user to chat with");
            return;
        }

        sendMessageSocket({
            senderId: currentUser._id,
            receiverId: selectedUser._id,
            text: messageText
        });
        
        setMessageText('');
        scrollToBottom();
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user);
        setShowUserList(false);
    };

    const formatTime = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // ✅ FIX: When VideoCall closes, clear pending call data
    const handleVideoCallClose = () => {
        setShowVideoCall(false);
        setPendingIncomingCall(null);
        soundService.stopRingtone(); // arrêter la sonnerie si on ferme
    };

    if (!currentUser) {
        return (
            <div className="chat-container">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="chat-container">
                <div className="chat-sidebar">
                    <div className="sidebar-header">
                        <h3>Messages</h3>
                        <button 
                            className="new-chat-btn"
                            onClick={() => setShowUserList(!showUserList)}
                        >
                            New Chat
                        </button>
                    </div>

                    {showUserList && (
                        <div className="user-list">
                            <h4>Select a user to chat with</h4>
                            {users && users.length > 0 ? (
                                users.filter(u => u._id !== currentUser._id).map(user => (
                                    <div 
                                        key={user._id}
                                        className="user-item"
                                        onClick={() => handleUserSelect(user)}
                                    >
                                        <img 
                                            src={user.profilePic ? `https://backpfe-production.up.railway.app${user.profilePic}` : "/default-avatar.png"}
                                            alt={user.firstName}
                                            onError={(e) => { e.target.src = "/default-avatar.png"; }}
                                        />
                                        <div className="user-info">
                                            <span className="user-name">{user.firstName} {user.lastName}</span>
                                            <span className="user-email">{user.email}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-users">
                                    <p>No other users found.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="conversations-list">
                        <h4>Recent Chats</h4>
                        {conversations && conversations.length > 0 ? (
                            conversations.map(conv => (
                                <div 
                                    key={conv._id}
                                    className={`conversation-item ${selectedUser?._id === conv.participant?._id ? 'active' : ''}`}
                                    onClick={() => handleUserSelect(conv.participant)}
                                >
                                    <img 
                                        src={conv.participant?.profilePic ? `https://backpfe-production.up.railway.app${conv.participant.profilePic}` : "/default-avatar.png"}
                                        alt={conv.participant?.firstName}
                                        onError={(e) => { e.target.src = "/default-avatar.png"; }}
                                    />
                                    <div className="conversation-info">
                                        <div className="conversation-name">
                                            {conv.participant?.firstName} {conv.participant?.lastName}
                                        </div>
                                        <div className="last-message">{conv.lastMessage || "No messages yet"}</div>
                                    </div>
                                    <div className="conversation-meta">
                                        <div className="message-time">
                                            {formatTime(conv.lastMessageTime)}
                                        </div>
                                        {conv.unreadCount > 0 && (
                                            <div className="unread-badge">{conv.unreadCount}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-conversations">
                                <p>No conversations yet</p>
                                <p>Click "New Chat" to start messaging</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="chat-area">
                    {selectedUser ? (
                        <>
                            <div className="chat-header">
                                <img 
                                    src={selectedUser.profilePic ? `https://backpfe-production.up.railway.app${selectedUser.profilePic}` : "/default-avatar.png"}
                                    alt={selectedUser.firstName}
                                    onError={(e) => { e.target.src = "/default-avatar.png"; }}
                                />
                                <div className="chat-header-info">
                                    <h3>{selectedUser.firstName} {selectedUser.lastName}</h3>
                                    <span>{selectedUser.email}</span>
                                </div>
                                <button 
                                    onClick={() => setShowVideoCall(true)} 
                                    className="video-call-btn"
                                    title="Video Call"
                                >
                                    📹
                                </button>
                            </div>

                            <div className="messages-container">
                                {messages && messages.length === 0 ? (
                                    <div className="no-messages">
                                        <p>No messages yet. Start a conversation!</p>
                                    </div>
                                ) : (
                                    messages && messages.map((msg, index) => (
                                        <div 
                                            key={msg._id || index}
                                            className={`message ${msg.sender?._id === currentUser?._id ? 'sent' : 'received'}`}
                                        >
                                            {msg.sender?._id !== currentUser?._id && (
                                                <img 
                                                    src={msg.sender?.profilePic ? `https://backpfe-production.up.railway.app${msg.sender.profilePic}` : "/default-avatar.png"}
                                                    alt={msg.sender?.firstName}
                                                    className="message-avatar"
                                                    onError={(e) => { e.target.src = "/default-avatar.png"; }}
                                                />
                                            )}
                                            <div className="message-content">
                                                <div className="message-text">{msg.text}</div>
                                                <div className="message-time">
                                                    {formatTime(msg.createdAt)}
                                                    {msg.sender?._id === currentUser?._id && (
                                                        <span className="message-status">
                                                            {msg.read ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="message-input-form" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    disabled={sending}
                                />
                                <button type="submit" disabled={sending || !messageText.trim()}>
                                    {sending ? 'Sending...' : 'Send'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="no-chat-selected">
                            <div className="no-chat-content">
                                <div className="chat-icon">💬</div>
                                <h3>Welcome to Messages!</h3>
                                <p>Select a conversation from the sidebar or click "New Chat" to start messaging</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showVideoCall && (
                <VideoCall
                    currentUser={currentUser}
                    selectedUser={selectedUser}
                    // ✅ FIX: Pass the pending incoming call data to VideoCall
                    initialIncomingCall={pendingIncomingCall}
                    onClose={handleVideoCallClose}
                />
            )}
        </>
    );
};

export default Chat;