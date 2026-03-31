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
      const response = await axios.post(`${API_URL}/user/forgot-password`, { email });
      return response.data.message;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Erreur envoi email");
    }
  }
);

export const resetPassword = createAsyncThunk(
  "user/resetPassword",
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/user/reset-password/${token}`, { password });
      // S'assurer que response.data est bien un objet avec msg
      return { msg: response.data.msg || "Password reset successfully" };
    } catch (error) {
      // S'assurer que l'erreur est un objet avec msg
      const errorMsg = error.response?.data?.msg || error.response?.data?.message || "Reset failed";
      return rejectWithValue({ msg: errorMsg });
    }
  }
);
export const updateProfilePic = createAsyncThunk(
  "user/updatePic",
  async ({ formData }, thunkAPI) => {  // Plus besoin de id
    try {
      let token = localStorage.getItem("token");
      if (!token) return thunkAPI.rejectWithValue("No token found");
      
      const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      
      // Enlever l'ID de l'URL
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

// --- Initial State ---

export const initialState = {
  user: null,
  token: localStorage.getItem("token") || localStorage.getItem("Bearer") || null,
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
      localStorage.removeItem("Bearer");
    },
    clearMessage: (state) => {
      state.message = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* --- Success Handlers (addCase) --- */
      // .addCase(userRegister.fulfilled, (state, action) => {
      //   state.status = "success";
      //   state.user = action.payload.user;
      //   state.token = action.payload.token;
      //   localStorage.setItem("token", action.payload.token);
      // })
      // .addCase(userLogin.fulfilled, (state, action) => {
      //   state.status = "success";
      //   state.user = action.payload.user;
      //   state.token = action.payload.token;
      //   localStorage.setItem("token", action.payload.token);
      // })
      // .addCase(userCurrent.fulfilled, (state, action) => {
      //   state.status = "success";
      //   state.user = action.payload.user;
      // })
      // User Registration
            .addCase(userRegister.pending, (state) => {
              state.status = "pending";
              state.error = null;
            })
            .addCase(userRegister.fulfilled, (state, action) => {
              state.status = "success";
              state.user = action.payload.user;
              localStorage.setItem("token", action.payload.token);
            })
            .addCase(userRegister.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
      
            // User Login
            .addCase(userLogin.pending, (state) => {
              state.status = "pending";
              state.error = null;
            })
            .addCase(userLogin.fulfilled, (state, action) => {
              state.status = "success";
              state.user = action.payload.user;
              state.token = action.payload.token;
              localStorage.setItem("token", action.payload.token);
              console.log("Token saved:", action.payload.token); 
            })
            .addCase(userLogin.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
      
            // Get Current User
            .addCase(userCurrent.pending, (state) => {
              state.status = "pending";
              state.error = null;
            })
            .addCase(userCurrent.fulfilled, (state, action) => {
              state.status = "success";
              state.user = action.payload.user;
            })
            .addCase(userCurrent.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
      // Edit User
            .addCase(editUser.pending, (state) => {
              state.status = "pending";
              state.error = null;
            })
            .addCase(editUser.fulfilled, (state, action) => {
              state.status = "success";
              state.user = action.payload;
            })
            .addCase(editUser.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
            
            // Get all users
            .addCase(getAllUsers.pending, (state) => {
              state.status = "pending";
            })
            .addCase(getAllUsers.fulfilled, (state, action) => {
              state.status = "success";
              state.userList = action.payload.users;
            })
            .addCase(getAllUsers.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
      
            // Delete user
            .addCase(deleteUser.pending, (state) => {
              state.status = "pending";
              state.error = null;
            })
            .addCase(deleteUser.fulfilled, (state, action) => {
              state.status = "success";
              state.userList = action.payload.data;
            })
            .addCase(deleteUser.rejected, (state, action) => {
              state.status = "fail";
              state.error = action.payload;
            })
      .addCase(resetPassword.fulfilled, (state, action) => {
    state.status = "succeeded";
    if (action.payload?.msg) {
      state.message = action.payload.msg;  // Extraire la propriété msg
    } else if (typeof action.payload === 'string') {
      state.message = action.payload;
    } else {
      state.message = "Password reset successfully!";
    }
    state.error = null;
  })
  .addCase(resetPassword.rejected, (state, action) => {
    state.status = "failed";
    // S'assurer que error est une string, pas un objet
    const payload = action.payload;
    if (payload?.msg) {
      state.error = payload.msg;  // Extraire la propriété msg
    } else if (typeof payload === 'string') {
      state.error = payload;
    } else {
      state.error = "Failed to reset password";
    }
    state.message = null;
  })
      .addCase(forgotPassword.fulfilled, (state, action) => {
    state.status = "success";
    if (action.payload?.msg) {
      state.message = action.payload.msg;
    } else if (typeof action.payload === 'string') {
      state.message = action.payload;
    } else {
      state.message = "Reset link sent to your email";
    }
    state.error = null;
  })
  .addCase(forgotPassword.rejected, (state, action) => {
    state.status = "fail";
    if (action.payload?.msg) {
      state.error = action.payload.msg;
    } else if (typeof action.payload === 'string') {
      state.error = action.payload;
    } else {
      state.error = "Failed to send reset link";
    }
    state.message = null;
  })
      // add photo
      .addCase(updateProfilePic.fulfilled, (state, action) => {
        state.status = "success";
        state.user = action.payload.user || action.payload; 
      })

      /* --- Pending & Rejected Handlers (addMatcher) --- */
      .addMatcher(
        (action) => action.type.endsWith("/pending"),
        (state) => {
          state.status = "pending";
          state.error = null;
        }
      )
      .addMatcher(
        (action) => action.type.endsWith("/rejected"),
        (state, action) => {
          state.status = "fail";
          state.error = action.payload;
        }
      );
  },
});

export const { logout, clearMessage } = userSlice.actions;
export default userSlice.reducer;