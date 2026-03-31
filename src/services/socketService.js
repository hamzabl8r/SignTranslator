// services/socketService.js
import { io } from 'socket.io-client';

const SOCKET_URL = "https://backpfe-production.up.railway.app";

class SocketService {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.listeners = new Map();
    }

   initialize(userId) {
    if (this.socket && this.userId === userId) {
        return this.socket;
    }

    if (this.socket) {
        this.disconnect();
    }

    this.userId = userId;
    this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
        console.log('✅ Global socket connected:', this.socket.id);
        // IMPORTANT: Envoyer l'enregistrement après la connexion
        this.socket.emit('register', userId);
    });

    this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
    });

    return this.socket;
}

    getSocket() {
        return this.socket;
    }

    // Écouter un événement
    on(event, callback) {
        if (!this.socket) return;
        
        // Stocker pour pouvoir supprimer plus tard
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        this.socket.on(event, callback);
    }

    // Supprimer un écouteur
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

    // Émettre un événement
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn(`Socket not connected, cannot emit ${event}`);
        }
    }

    disconnect() {
        if (this.socket) {
            // Supprimer tous les écouteurs
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