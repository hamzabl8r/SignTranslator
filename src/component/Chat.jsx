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
import './Styles/Chat.css';

const Chat = () => {
    const [messageText, setMessageText] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserList, setShowUserList] = useState(false);
    const [showVideoCall, setShowVideoCall] = useState(false);
    
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector((state) => state.user);
    const { conversations, messages, users, sending } = useSelector((state) => state.message);
    
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);

    // Initialiser Socket.IO
    // Chat.jsx - Ajoute ceci dans le useEffect principal
useEffect(() => {
    if (currentUser?._id) {
        console.log('🔌 Initializing socket for chat...');
        const socket = initializeSocket(currentUser._id);
        socketRef.current = socket;
        
        if (socket) {
            // Écouter la confirmation d'enregistrement
            socket.on('registered', (data) => {
                console.log('✅ Socket registered:', data);
            });
            
            // Écouter les messages (déjà existant)
            socket.on('new_message', (message) => {
                console.log('New message received:', message);
                dispatch(addMessage(message));
                dispatch(getConversations());
                toast.success(`New message from ${message.sender.firstName}`);
            });
            
            socket.on('message_sent', (message) => {
                console.log('Message sent:', message);
                dispatch(addMessage(message));
            });
            
            socket.on('messages_read', (data) => {
                console.log('Messages read:', data);
                if (selectedUser?._id === data.userId) {
                    dispatch(markMessageRead({ conversationId: data.conversationId }));
                }
            });
        }
        
        return () => {
            if (socket) {
                socket.off('registered');
                socket.off('new_message');
                socket.off('message_sent');
                socket.off('messages_read');
            }
        };
    }
}, [currentUser]);

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
                // Marquer comme lu via Socket.IO
                if (socketRef.current) {
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

    // Scroll automatique vers le bas quand nouveaux messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Envoyer un message
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

        // Envoyer via Socket.IO
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
                {/* Sidebar - Conversations */}
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

                    {/* User List for new chat */}
                    {showUserList && (
                        <div className="user-list">
                            <h4>Select a user to chat with</h4>
                            {users && users.length > 0 ? (
                                users.map(user => (
                                    <div 
                                        key={user._id}
                                        className="user-item"
                                        onClick={() => handleUserSelect(user)}
                                    >
                                        <img 
                                            src={user.profilePic ? `https://backpfe-production.up.railway.app${user.profilePic}` : "https://via.placeholder.com/40"}
                                            alt={user.firstName}
                                            onError={(e) => { e.target.src = "https://via.placeholder.com/40"; }}
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
                                    <p>Create another account to start chatting!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Conversations List */}
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
                                        src={conv.participant?.profilePic ? `https://backpfe-production.up.railway.app${conv.participant.profilePic}` : "https://via.placeholder.com/50"}
                                        alt={conv.participant?.firstName}
                                        onError={(e) => { e.target.src = "https://via.placeholder.com/50"; }}
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

                {/* Chat Area */}
                <div className="chat-area">
                    {selectedUser ? (
                        <>
                            {/* Chat Header */}
                            <div className="chat-header">
                                <img 
                                    src={selectedUser.profilePic ? `https://backpfe-production.up.railway.app${selectedUser.profilePic}` : "https://via.placeholder.com/50"}
                                    alt={selectedUser.firstName}
                                    onError={(e) => { e.target.src = "https://via.placeholder.com/50"; }}
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

                            {/* Messages */}
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
                                                    src={msg.sender?.profilePic ? `https://backpfe-production.up.railway.app${msg.sender.profilePic}` : "https://via.placeholder.com/35"}
                                                    alt={msg.sender?.firstName}
                                                    className="message-avatar"
                                                    onError={(e) => { e.target.src = "https://via.placeholder.com/35"; }}
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

                            {/* Message Input */}
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

            {/* Video Call Modal */}
            {showVideoCall && (
                <VideoCall
                    currentUser={currentUser}
                    selectedUser={selectedUser}
                    onClose={() => setShowVideoCall(false)}
                />
            )}
        </>
    );
};

export default Chat;