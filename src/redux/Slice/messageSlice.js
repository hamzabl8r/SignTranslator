import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import socketService from "../../services/socketService";

const API_URL = "https://backpfe-production-789f.up.railway.app/api/messages";

export const initializeSocket = (userId) => {
  if (userId) {
    return socketService.initialize(userId);
  }

  return socketService.getSocket();
};

export const disconnectSocket = () => {
  socketService.disconnect();
};

export const sendMessageSocket = ({ senderId, receiverId, text }, callback) => {
  socketService.emit("send_message", { senderId, receiverId, text }, callback);
};

export const markReadSocket = ({ conversationId, userId }) => {
  socketService.emit("mark_read", { conversationId, userId });
};

export const getAllUsers = createAsyncThunk(
  "message/getAllUsers",
  async (_, thunkAPI) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return thunkAPI.rejectWithValue("No token found");
      }

      const authHeader = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await axios.get(`${API_URL}/users`, {
        headers: {
          Authorization: authHeader,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || "Failed to fetch users"
      );
    }
  }
);

export const getConversations = createAsyncThunk(
  "message/getConversations",
  async (_, thunkAPI) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return thunkAPI.rejectWithValue("No token found");
      }

      const authHeader = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await axios.get(`${API_URL}/conversations`, {
        headers: {
          Authorization: authHeader,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || "Failed to fetch conversations"
      );
    }
  }
);

export const getMessages = createAsyncThunk(
  "message/getMessages",
  async (conversationId, thunkAPI) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return thunkAPI.rejectWithValue("No token found");
      }

      const authHeader = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await axios.get(
        `${API_URL}/conversation/${conversationId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      return {
        conversationId,
        messages: response.data,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || "Failed to fetch messages"
      );
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
  sending: false,
};

const messageSlice = createSlice({
  name: "message",
  initialState,

  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },

    addMessage: (state, action) => {
      const incoming = action.payload;

      if (!incoming) return;

      const incomingId = incoming._id;

      if (incomingId) {
        const exists = state.messages.some((msg) => msg._id === incomingId);
        if (exists) return;
      }

      state.messages.push(incoming);
    },

    replaceTempMessage: (state, action) => {
      const { tempId, realMessage } = action.payload;

      const index = state.messages.findIndex((msg) => msg._id === tempId);

      if (index !== -1) {
        state.messages[index] = realMessage;
      } else {
        const exists = state.messages.some(
          (msg) => msg._id === realMessage?._id
        );

        if (!exists && realMessage) {
          state.messages.push(realMessage);
        }
      }
    },

    removeMessage: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter((msg) => msg._id !== messageId);
    },

    clearMessages: (state) => {
      state.messages = [];
    },

    updateUnreadCount: (state, action) => {
      const { conversationId, count } = action.payload;

      const conv = state.conversations.find((c) => c._id === conversationId);

      if (conv) {
        conv.unreadCount = count;
      }
    },

    markMessageRead: (state, action) => {
      const { conversationId } = action.payload;

      state.messages.forEach((msg) => {
        if (msg.conversationId === conversationId && !msg.read) {
          msg.read = true;
        }
      });
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getConversations.pending, (state) => {
        state.status = "loading";
      })

      .addCase(getConversations.fulfilled, (state, action) => {
        state.status = "success";
        state.conversations = action.payload;
      })

      .addCase(getConversations.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(getMessages.pending, (state) => {
        state.status = "loading";
      })

      .addCase(getMessages.fulfilled, (state, action) => {
        state.status = "success";
        state.messages = action.payload.messages;
      })

      .addCase(getMessages.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.users = action.payload;
      })

      .addCase(getAllUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const {
  setCurrentConversation,
  addMessage,
  replaceTempMessage,
  removeMessage,
  clearMessages,
  updateUnreadCount,
  markMessageRead,
} = messageSlice.actions;

export default messageSlice.reducer;