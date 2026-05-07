import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "https://backpfe-production-789f.up.railway.app";

// ── Auth header helper (used inside thunks) ──────────────────────────────────
function getAuthHeader() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return { Authorization: authHeader };
}

// ── Thunks ───────────────────────────────────────────────────────────────────

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
      const response = await axios.get(`${API_URL}/user/current`, {
        headers: getAuthHeader(),
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
      const response = await axios.put(`${API_URL}/user/${id}`, editprofil, {
        headers: getAuthHeader(), // FIXED: was missing auth header
      });
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
      const response = await axios.delete(`${API_URL}/user/${id}`, {
        headers: getAuthHeader(), // FIXED: was missing auth header
      });
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
      const response = await axios.get(`${API_URL}/user`, {
        headers: getAuthHeader(), // FIXED: was missing auth header (now required after security fix)
      });
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
      return response.data;
    } catch (error) {
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
      const response = await axios.put(`${API_URL}/user/update-pic`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...getAuthHeader(),
        },
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || "Update failed");
    }
  }
);

// FETCH HISTORY
export const fetchHistory = createAsyncThunk(
  "user/fetchHistory",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/history`, {
        headers: {
          ...getAuthHeader(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        params: { _t: Date.now() },
      });

      // FIXED: response shape is { success: true, history: [...] }
      // All cases handled in order of likelihood:
      if (Array.isArray(response.data?.history)) return response.data.history;
      if (Array.isArray(response.data?.data))    return response.data.data;
      if (Array.isArray(response.data))           return response.data;
      return [];
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.msg || error.message || "Erreur lors du chargement"
      );
    }
  }
);

// FETCH STATS — computes stats from /dataset/all
// FIXED: response is { success, datasets } not { data }
export const fetchStats = createAsyncThunk(
  "user/fetchStats",
  async (_, thunkAPI) => {
    try {
      const response = await axios.get(`${API_URL}/dataset/all`, {
        headers: getAuthHeader(),
      });

      // FIXED: backend returns `datasets`, not `data`
      const datasets = response.data.datasets || [];

      const stats = {
        totalDatasets: datasets.length,
        totalSize: datasets.reduce((sum, d) => sum + (d.size || 0), 0),
        totalRecords: datasets.reduce((sum, d) => sum + (d.recordsCount || 0), 0),
        averageRecords:
          datasets.length > 0
            ? Number(
                (
                  datasets.reduce((sum, d) => sum + (d.recordsCount || 0), 0) /
                  datasets.length
                ).toFixed(0)
              )
            : 0,
        byType: datasets.reduce((acc, d) => {
          acc[d.type] = (acc[d.type] || 0) + 1;
          return acc;
        }, {}),
        lastWeekActivity: datasets.filter((d) => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(d.createdAt) > weekAgo;
        }).length,
        averageSize:
          datasets.length > 0
            ? Number(
                (
                  datasets.reduce((sum, d) => sum + (d.size || 0), 0) /
                  datasets.length
                ).toFixed(2)
              )
            : 0,
      };

      return stats;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch stats"
      );
    }
  }
);

// FETCH ACTIVITY — builds activity feed from /dataset/all
// FIXED: response is { success, datasets } not { data }
export const fetchActivity = createAsyncThunk(
  "user/fetchActivity",
  async (_, thunkAPI) => {
    try {
      const response = await axios.get(`${API_URL}/dataset/all`, {
        headers: getAuthHeader(),
      });

      // FIXED: backend returns `datasets`, not `data`
      const datasets = response.data.datasets || [];

      const activity = datasets.map((dataset) => ({
        id: dataset._id,
        action: "Dataset soumis",
        timestamp: dataset.createdAt,
        // FIXED: populated field is `user`, not `createdBy`
        user: dataset.user
          ? `${dataset.user.firstName || ""} ${dataset.user.lastName || ""}`.trim()
          : "Utilisateur",
        details: {
          type: dataset.type,
          size: dataset.size,
          records: dataset.recordsCount,
        },
      }));

      return activity
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch activity"
      );
    }
  }
);

// ── Initial State ─────────────────────────────────────────────────────────────

export const initialState = {
  user: null,
  token: localStorage.getItem("token") || null,
  status: "idle",
  error: null,
  message: null,
  userList: [],
  history: [],
  stats: {
    totalDatasets: 0,
    totalSize: 0,
    totalRecords: 0,
    averageRecords: 0,
    averageSize: 0,
    byType: {},
    lastWeekActivity: 0,
  },
  activity: [],
  loading: false,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.status = "idle";
      state.history = [];
      state.stats = initialState.stats;
      state.activity = [];
      state.error = null;
      state.message = null;
      localStorage.removeItem("token");
    },
    clearMessage: (state) => {
      state.message = null;
      state.error = null;
    },
    clearHistory: (state) => {
      state.history = [];
    },
    clearActivity: (state) => {
      state.activity = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Register ──────────────────────────────────────────────────────────
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

      // ── Login ─────────────────────────────────────────────────────────────
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

      // ── Current ───────────────────────────────────────────────────────────
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

      // ── Edit User ─────────────────────────────────────────────────────────
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

      // ── Get All Users ─────────────────────────────────────────────────────
      .addCase(getAllUsers.pending, (state) => {
        state.status = "loading";
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.userList = action.payload.users || [];
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      // ── Delete User ───────────────────────────────────────────────────────
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

      // ── Reset Password ────────────────────────────────────────────────────
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

      // ── Forgot Password ───────────────────────────────────────────────────
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

      // ── Update Profile Pic ────────────────────────────────────────────────
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

      // ── Fetch Stats ───────────────────────────────────────────────────────
      .addCase(fetchStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.status = "failed";
      })

      // ── Fetch Activity ────────────────────────────────────────────────────
      .addCase(fetchActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.activity = action.payload;
        state.status = "succeeded";
      })
      .addCase(fetchActivity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.status = "failed";
      })

      // ── Fetch History ─────────────────────────────────────────────────────
      .addCase(fetchHistory.pending, (state) => {
        state.loading = true;
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.status = "succeeded";
        state.history = action.payload;
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.loading = false;
        state.status = "failed";
        state.error = action.payload;
        state.history = [];
      });
  },
});

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectUser          = (state) => state.user.user;
export const selectHistory       = (state) => state.user.history;
export const selectHistoryStatus = (state) => state.user.status;

export const { logout, clearMessage, clearHistory, clearActivity } = userSlice.actions;
export default userSlice.reducer;