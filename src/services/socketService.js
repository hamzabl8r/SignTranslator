import { io } from 'socket.io-client';

const SOCKET_URL = "https://backpfe-production.up.railway.app";

class SocketService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.listeners = new Map();
    }

    initialize(userId) {
        if (!userId) return null;

        const userIdStr = userId.toString();

        if (this.socket && this.socket.connected && this.userId === userIdStr) {
            console.log('✅ Socket already initialized and connected for user:', userIdStr);
            this.socket.emit('register', userIdStr);
            return this.socket;
        }

        if (this.socket) {
            console.log('♻️ Disconnecting old socket before reinitializing');
            this.disconnect();
        }

        this.userId = userIdStr;
        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            forceNew: true,
        });

        this.socket.on('connect', () => {
            console.log('✅ Global socket connected:', this.socket.id);
            this.socket.emit('register', userIdStr);
        });

        this.socket.on('reconnect', () => {
            console.log('🔄 Socket reconnected, re-registering user:', userIdStr);
            this.socket.emit('register', userIdStr);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected, reason:', reason);
        });

        return this.socket;
    }

    getSocket() {
        return this.socket;
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }

    on(event, callback) {
        if (!this.socket) return;
        
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const existing = this.listeners.get(event);
        if (existing.includes(callback)) {
            console.warn(`⚠️ Listener for "${event}" already registered, skipping duplicate`);
            return;
        }

        existing.push(callback);
        this.socket.on(event, callback);
    }

    off(event, callback) {
        if (!this.socket) return;
        
        if (callback) {
            this.socket.off(event, callback);
            const callbacks = this.listeners.get(event) || [];
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        } else {
            this.socket.off(event);
            this.listeners.delete(event);
        }
    }

    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
            console.log(`📡 Emitted ${event}:`, data);
        } else {
            console.warn(`⚠️ Socket not connected, cannot emit "${event}". Connected: ${this.socket?.connected}, Socket: ${!!this.socket}`);
        }
    }

    disconnect() {
        if (this.socket) {
            this.listeners.forEach((callbacks, event) => {
                callbacks.forEach(cb => {
                    this.socket.off(event, cb);
                });
            });
            this.listeners.clear();
            
            this.socket.disconnect();
            this.socket = null;
            this.userId = null;
        }
    }
}

export default new SocketService();
