import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "https://backpfe-production.up.railway.app";

// --- Actions (Async Thunks) ---

export const userRegister = createAsyncThunk(
  "user/register",
  async (user, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/user/register`, user);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Registration failed");
    }
  }
);

export const userLogin = createAsyncThunk(
  "user/login",
  async (user, thunkAPI) => {
    try {
      const response = await axios.post(`${API_URL}/user/login`, user);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Login failed");
    }
  }
);

export const userCurrent = createAsyncThunk(
  "user/current",
  async (_, thunkAPI) => {
    try {
      let token = localStorage.getItem("token");
      if (!token) {
        return thunkAPI.rejectWithValue("No token found");
      }
      const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

      const response = await axios.get(`${API_URL}/user/current`, {
        headers: {
          Authorization: authHeader,
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Session expired");
    }
  }
);

export const editUser = createAsyncThunk(
  "user/update",
  async ({ id, editprofil }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/user/${id}`, editprofil);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to update user");
    }
  }
);

export const deleteUser = createAsyncThunk(
  "user/delete",
  async (id, thunkAPI) => {
    try {
      const response = await axios.delete(`${API_URL}/user/${id}`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Delete failed");
    }
  }
);

export const getAllUsers = createAsyncThunk(
  "user/getAll",
  async (_, thunkAPI) => {
    try {
      const response = await axios.get(`${API_URL}/user`);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Failed to fetch users");
    }
  }
);

export const forgotPassword = createAsyncThunk(
  "user/forgotPassword",
  async (email, { rejectWithValue }) => {  
    try {
      console.log("Sending forgot password request for:", email); 
      
      const response = await axios.post(`http://localhost:5000/user/forgot-password`, { email });
      
      console.log("Response:", response.data); 
      return response.data;
    } catch (error) {
      console.error("Forgot password error:", error.response?.data || error.message);
      
      if (error.response?.data?.msg) {
        return rejectWithValue(error.response.data.msg);
      }
      return rejectWithValue("Failed to send reset link. Please try again.");
    }
  }
);

export const resetPassword = createAsyncThunk(
  "user/resetPassword",
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/user/reset-password/${token}`, { password });
      return { msg: response.data.msg || "Password reset successfully" };
    } catch (error) {
      const errorMsg = error.response?.data?.msg || error.response?.data?.message || "Reset failed";
      return rejectWithValue({ msg: errorMsg });
    }
  }
);

export const updateProfilePic = createAsyncThunk(
  "user/updatePic",
  async ({ formData }, thunkAPI) => {
    try {
      let token = localStorage.getItem("token");
      if (!token) return thunkAPI.rejectWithValue("No token found");
      
      const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      
      const response = await axios.put(`${API_URL}/user/update-pic`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": authHeader
        }
      });
      
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Update failed");
    }
  }
);
export const fetchHistory = createAsyncThunk('user/fetchHistory', async (_, thunkAPI) => {
    try {
        const response = await axios.get('/user/history'); 
        return response.data; 
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response.data);
    }
});

// --- Initial State ---

export const initialState = {
  user: null,
  token: localStorage.getItem("token") || null,
  status: "idle",
  error: null,
  message: null,
  userList: [],
};

// --- Redux Slice ---

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.status = "idle";
      localStorage.removeItem("token");
    },
    clearMessage: (state) => {
      state.message = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(userRegister.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(userRegister.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        if (action.payload.token) {
          state.token = action.payload.token;
          localStorage.setItem("token", action.payload.token);
        }
      })
      .addCase(userRegister.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(userLogin.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(userLogin.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem("token", action.payload.token);
      })
      .addCase(userLogin.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(userCurrent.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(userCurrent.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
      })
      .addCase(userCurrent.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(editUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(editUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.result;
      })
      .addCase(editUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(getAllUsers.pending, (state) => {
        state.status = "loading";
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.userList = action.payload.users;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(deleteUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      .addCase(resetPassword.pending, (state) => {
        state.status = "loading";
        state.error = null;
        state.message = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.message = action.payload?.msg || "Password reset successfully!";
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.msg || "Failed to reset password";
        state.message = null;
      })

      .addCase(forgotPassword.pending, (state) => {
        state.status = "loading";
        state.error = null;
        state.message = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.message = action.payload?.msg || "Reset link sent to your email";
        state.error = null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload?.msg || "Failed to send reset link";
        state.message = null;
      })

      .addCase(updateProfilePic.pending, (state) => {
        state.status = "loading";
      })
      .addCase(updateProfilePic.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user || action.payload;
      })
      .addCase(updateProfilePic.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      });
  },
});

export const { logout, clearMessage } = userSlice.actions;
export default userSlice.reducer;