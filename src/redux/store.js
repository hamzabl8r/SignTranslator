// redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './Slice/userSlice';
import messageReducer from './Slice/messageSlice';

export const store = configureStore({
    reducer: {
        user: userReducer,
        message: messageReducer  
    }
});