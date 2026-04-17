import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import socketService from '../../services/socketService';

const API_URL = "https://backpfe-production.up.railway.app/api/messages";

export const initializeSocket = (userId) => {
    if (userId) {
        return socketService.initialize(userId);
    }
    return socketService.getSocket();
};

export const disconnectSocket = () => {
    socketService.disconnect();
};

export const sendMessageSocket = ({ senderId, receiverId, text }) => {
    socketService.emit('send_message', { senderId, receiverId, text });
};

export const markReadSocket = ({ conversationId, userId }) => {
    socketService.emit('mark_read', { conversationId, userId });
};

export const getAllUsers = createAsyncThunk(
    "message/getAllUsers",
    async (_, thunkAPI) => {
        try {
            const token = localStorage.getItem("token");
            const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
            
            const response = await axios.get(`${API_URL}/users`, {
                headers: { Authorization: authHeader }
            });
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data || "Failed to fetch users");
        }
    }
);

// Récupérer les conversations
export const getConversations = createAsyncThunk(
    "message/getConversations",
    async (_, thunkAPI) => {
        try {
            const token = localStorage.getItem("token");
            const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
            
            const response = await axios.get(`${API_URL}/conversations`, {
                headers: { Authorization: authHeader }
            });
            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data || "Failed to fetch conversations");
        }
    }
);

export const getMessages = createAsyncThunk(
    "message/getMessages",
    async (conversationId, thunkAPI) => {
        try {
            const token = localStorage.getItem("token");
            const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
            
            const response = await axios.get(`${API_URL}/conversation/${conversationId}`, {
                headers: { Authorization: authHeader }
            });
            return { conversationId, messages: response.data };
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data || "Failed to fetch messages");
        }
    }
);

const initialState = {
    conversations: [],
    currentConversation: null,
    messages: [],
    users: [],
    status: "idle",
    error: null,
    sending: false
};

const messageSlice = createSlice({
    name: "message",
    initialState,
    reducers: {
        setCurrentConversation: (state, action) => {
            state.currentConversation = action.payload;
        },
        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },
        clearMessages: (state) => {
            state.messages = [];
        },
        updateUnreadCount: (state, action) => {
            const { conversationId, count } = action.payload;
            const conv = state.conversations.find(c => c._id === conversationId);
            if (conv) {
                conv.unreadCount = count;
            }
        },
        markMessageRead: (state, action) => {
            const { conversationId } = action.payload;
            state.messages.forEach(msg => {
                if (msg.conversationId === conversationId && !msg.read) {
                    msg.read = true;
                }
            });
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(getConversations.fulfilled, (state, action) => {
                state.status = "success";
                state.conversations = action.payload;
            })
            .addCase(getMessages.fulfilled, (state, action) => {
                state.status = "success";
                state.messages = action.payload.messages;
            })
            .addCase(getAllUsers.fulfilled, (state, action) => {
                state.users = action.payload;
            })
            .addCase(getConversations.rejected, (state) => {
                state.status = "failed";
            })
            .addCase(getMessages.rejected, (state) => {
                state.status = "failed";
            })
            .addCase(getAllUsers.rejected, (state) => {
                state.status = "failed";
            });
    }
});

export const { 
    setCurrentConversation, 
    addMessage, 
    clearMessages, 
    updateUnreadCount,
    markMessageRead 
} = messageSlice.actions;

export default messageSlice.reducer;