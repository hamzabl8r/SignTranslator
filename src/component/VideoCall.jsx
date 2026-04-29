import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import { sendMessageSocket } from '../redux/Slice/messageSlice';
import { Hands } from '@mediapipe/hands';
import axios from 'axios';
import './Styles/VideoCall.css';

const AI_SERVER_URL = 'https://zen-footing-depravity.ngrok-free.dev';

const VideoCall = ({ currentUser, selectedUser, initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState(initialIncomingCall ? 'ringing' : 'idle');
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
    const [localPrediction, setLocalPrediction] = useState("");
    const [remotePrediction, setRemotePrediction] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [isAIActive, setIsAIActive] = useState(false); // AI activé manuellement
    const [isCapturing, setIsCapturing] = useState(false); // Pour éviter les envois multiples

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const requestRef = useRef(null);
    const handsRef = useRef(null);
    const isHandsActiveRef = useRef(false);
    const lastPredictionRef = useRef(""); // Pour éviter les répétitions
    const chatEndRef = useRef(null);
    const detectionTimeoutRef = useRef(null); // Timeout pour la détection

    // Scroll to bottom of chat
    const scrollChatToBottom = useCallback(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollChatToBottom();
    }, [chatMessages, scrollChatToBottom]);

    // Clean up hands instance safely
    const cleanupHands = useCallback(async () => {
        // Cancel animation frame first
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }

        // Clear detection timeout
        if (detectionTimeoutRef.current) {
            clearTimeout(detectionTimeoutRef.current);
            detectionTimeoutRef.current = null;
        }

        // Close and clean up hands instance
        if (handsRef.current) {
            isHandsActiveRef.current = false;
            try {
                handsRef.current.onResults = null;
                await handsRef.current.close();
            } catch (error) {
                console.warn('Error closing hands:', error);
            }
            handsRef.current = null;
        }
    }, []);

    // Save message to DB
    const saveMessageToDB = useCallback((text, isLocal) => {
        if (!selectedUser?._id) return;
        sendMessageSocket({
            senderId: isLocal ? currentUser._id : selectedUser._id,
            receiverId: isLocal ? selectedUser._id : currentUser._id,
            text: `[Sign] ${text}`,
        });
    }, [currentUser._id, selectedUser?._id]);

    // Add message to local chat
    const addChatMessage = useCallback((text, isLocal, isSign = false) => {
        const msg = {
            id: Date.now() + Math.random(),
            text,
            isLocal,
            isSign,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages(prev => [...prev, msg]);
        if (isSign) saveMessageToDB(text, isLocal);
    }, [saveMessageToDB]);

    // Send text message manually
    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        addChatMessage(chatInput.trim(), true, false);

        sendMessageSocket({
            senderId: currentUser._id,
            receiverId: selectedUser?._id,
            text: chatInput.trim(),
        });

        socketService.emit('send_translation', {
            text: chatInput.trim(),
            toUserId: selectedUser?._id,
            fromUserId: currentUser._id,
            isSign: false,
        });

        setChatInput('');
    };

    // Toggle AI detection manually
    const toggleAIDetection = useCallback(async () => {
        if (isAIActive) {
            // Désactiver l'AI
            setIsAIActive(false);
            setIsCapturing(false);
            await cleanupHands();
            setLocalPrediction("");
            lastPredictionRef.current = "";
        } else {
            // Activer l'AI
            setIsAIActive(true);
            await startAI();
        }
    }, [isAIActive, cleanupHands]);

    // AI Logic with manual activation
    const startAI = useCallback(async () => {
        // Clean up any existing hands instance first
        if (handsRef.current) {
            await cleanupHands();
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        if (!localVideoRef.current || !isAIActive) {
            return;
        }

        isHandsActiveRef.current = true;

        try {
            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });
            handsRef.current = hands;

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7, // Augmenté pour plus de précision
                minTrackingConfidence: 0.7,
            });

            hands.onResults(async (results) => {
                if (!isHandsActiveRef.current || !handsRef.current || !isAIActive) return;

                // Vérifier si des mains sont détectées
                const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
                
                if (!hasHands) {
                    // Pas de main détectée, réinitialiser
                    setIsCapturing(false);
                    if (detectionTimeoutRef.current) {
                        clearTimeout(detectionTimeoutRef.current);
                        detectionTimeoutRef.current = null;
                    }
                    return;
                }

                // Si des mains sont détectées, attendre un court instant pour éviter les faux positifs
                if (detectionTimeoutRef.current) {
                    clearTimeout(detectionTimeoutRef.current);
                }

                detectionTimeoutRef.current = setTimeout(async () => {
                    if (!isHandsActiveRef.current || !isAIActive) return;

                    let data_aux = [];

                    for (let i = 0; i < 2; i++) {
                        if (results.multiHandLandmarks && results.multiHandLandmarks[i]) {
                            results.multiHandLandmarks[i].forEach(lm => {
                                data_aux.push(lm.x);
                                data_aux.push(lm.y);
                            });
                        } else {
                            for (let j = 0; j < 42; j++) data_aux.push(0);
                        }
                    }

                    if (data_aux.length === 84 && !isCapturing) {
                        setIsCapturing(true);
                        
                        try {
                            const res = await axios.post(`${AI_SERVER_URL}/predict`,
                                { landmarks: data_aux },
                                { headers: { "ngrok-skip-browser-warning": "69420" } }
                            );

                            const predictedWord = res.data.res;

                            if (predictedWord && 
                                predictedWord !== "error" && 
                                predictedWord !== "..." &&
                                predictedWord !== lastPredictionRef.current) { // Éviter les répétitions
                                
                                setLocalPrediction(predictedWord);
                                lastPredictionRef.current = predictedWord;
                                
                                addChatMessage(predictedWord, true, true);

                                socketService.emit('send_translation', {
                                    text: predictedWord,
                                    toUserId: selectedUser?._id,
                                    fromUserId: currentUser._id,
                                    isSign: true,
                                });

                                // Effacer la prédiction après 2 secondes
                                setTimeout(() => {
                                    if (lastPredictionRef.current === predictedWord) {
                                        setLocalPrediction("");
                                    }
                                }, 2000);
                            }
                        } catch (err) {
                            console.error("AI Prediction Error:", err);
                        } finally {
                            setTimeout(() => {
                                setIsCapturing(false);
                            }, 500); // Délai avant la prochaine capture
                        }
                    }
                }, 300); // Attendre 300ms pour confirmer le geste
            });

            // Start detection loop
            const detectFrame = async () => {
                if (!isHandsActiveRef.current || !handsRef.current || !localVideoRef.current || !isAIActive) {
                    return;
                }
                
                try {
                    if (localVideoRef.current.readyState >= 2) {
                        await hands.send({ image: localVideoRef.current });
                    }
                } catch (error) {
                    if (isHandsActiveRef.current) {
                        console.error('Hand detection error:', error);
                    }
                }
                
                if (isHandsActiveRef.current && isAIActive) {
                    requestRef.current = requestAnimationFrame(detectFrame);
                }
            };
            
            detectFrame();
        } catch (error) {
            console.error('Failed to initialize MediaPipe Hands:', error);
            isHandsActiveRef.current = false;
            setIsAIActive(false);
        }
    }, [addChatMessage, cleanupHands, currentUser._id, isAIActive, isCapturing, selectedUser?._id]);

    // End call with proper cleanup
    const endCall = useCallback(async () => {
        // Stop all detection and close hands first
        setIsAIActive(false);
        isHandsActiveRef.current = false;
        
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
        
        if (detectionTimeoutRef.current) {
            clearTimeout(detectionTimeoutRef.current);
            detectionTimeoutRef.current = null;
        }
        
        await cleanupHands();
        
        // Stop media tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }
        
        // Clean up peer connection
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        // Clear video elements
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        
        // Notify other party and close
        socketService.emit('end_call', { toUserId: selectedUser?._id, fromUserId: currentUser._id });
        onClose();
    }, [currentUser._id, selectedUser?._id, onClose, cleanupHands]);

    const setupMedia = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        return stream;
    };

    const startCall = async () => {
        setCallStatus('calling');
        const stream = await setupMedia();
        const peer = new Peer({ initiator: true, trickle: false, stream });

        peer.on('signal', (signal) => {
            socketService.emit('call_user', {
                fromUserId: currentUser._id,
                toUserId: selectedUser._id,
                signal,
                callerInfo: { name: currentUser.firstName }
            });
        });

        peer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setCallStatus('connected');
            // Ne pas démarrer AI automatiquement
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            endCall();
        });

        peerRef.current = peer;
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        
        const stream = await setupMedia();
        const peer = new Peer({ initiator: false, trickle: false, stream });

        peer.on('signal', (signal) => {
            socketService.emit('accept_call', {
                fromUserId: incomingCall.fromUserId,
                toUserId: currentUser._id,
                signal
            });
        });

        peer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            setCallStatus('connected');
            // Ne pas démarrer AI automatiquement
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            endCall();
        });

        peer.signal(incomingCall.signal);
        peerRef.current = peer;
        setIncomingCall(null);
    };

    // Nettoyer quand le composant est démonté
    useEffect(() => {
        return () => {
            setIsAIActive(false);
            isHandsActiveRef.current = false;
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
            if (detectionTimeoutRef.current) {
                clearTimeout(detectionTimeoutRef.current);
            }
            cleanupHands();
        };
    }, [cleanupHands]);

    // Socket listeners
    useEffect(() => {
        socketService.on('receive_translation', (data) => {
            setRemotePrediction(data.text);
            addChatMessage(data.text, false, data.isSign ?? true);
            
            // Effacer la prédiction après 2 secondes
            setTimeout(() => {
                setRemotePrediction("");
            }, 2000);
        });

        socketService.on('call_accepted', (data) => {
            if (peerRef.current) {
                peerRef.current.signal(data.signal);
            }
            setCallStatus('connected');
        });

        socketService.on('call_ended', () => {
            endCall();
        });

        return () => {
            socketService.off('receive_translation');
            socketService.off('call_accepted');
            socketService.off('call_ended');
        };
    }, [addChatMessage, endCall]);

    return (
        <div className="video-call-overlay">
            <div className="video-call-layout">
                {/* LEFT: CHAT PANEL */}
                <div className={`call-chat-panel ${isChatOpen ? 'open' : 'closed'}`}>
                    <div className="call-chat-header">
                        <div className="call-chat-header-info">
                            <img
                                src={selectedUser?.profilePic
                                    ? `https://backpfe-production.up.railway.app${selectedUser.profilePic}`
                                    : "/default-avatar.png"}
                                alt={selectedUser?.firstName}
                                onError={(e) => { e.target.src = "/default-avatar.png"; }}
                            />
                            <div>
                                <span className="call-chat-name">{selectedUser?.firstName} {selectedUser?.lastName}</span>
                                <span className="call-chat-status">
                                    {callStatus === 'connected' ? '🟢 Connected' : callStatus === 'calling' ? '⏳ Calling...' : callStatus === 'ringing' ? '📞 Ringing' : '⚪ Idle'}
                                </span>
                            </div>
                        </div>
                        <button className="toggle-chat-btn" onClick={() => setIsChatOpen(v => !v)} title="Toggle chat">
                            {isChatOpen ? '◀' : '▶'}
                        </button>
                    </div>

                    {isChatOpen && (
                        <>
                            <div className="call-chat-messages">
                                {chatMessages.length === 0 && (
                                    <div className="call-chat-empty">
                                        <span>🤟</span>
                                        <p>Les traductions gestuelles et messages apparaîtront ici</p>
                                        <p style={{ fontSize: '0.7rem', marginTop: '5px' }}>
                                            {isAIActive ? '🟢 Reconnaissance active' : '⚪ Reconnaissance désactivée'}
                                        </p>
                                    </div>
                                )}
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`call-chat-msg ${msg.isLocal ? 'local' : 'remote'}`}>
                                        <div className="call-chat-bubble">
                                            {msg.isSign && <span className="sign-badge">🤟</span>}
                                            <span className="call-chat-text">{msg.text}</span>
                                        </div>
                                        <div className="call-chat-time">{msg.time}</div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <form className="call-chat-input-form" onSubmit={handleSendChat}>
                                <input
                                    type="text"
                                    className="call-chat-input"
                                    placeholder="Écrire un message..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="call-chat-send-btn"
                                    disabled={!chatInput.trim()}
                                >
                                    ➤
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {/* RIGHT: VIDEO AREA */}
                <div className="video-call-container">
                    <div className="video-grid">
                        <div className="video-box">
                            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                            {remotePrediction && (
                                <div className="prediction-overlay peer-tag">🤟 {remotePrediction}</div>
                            )}
                        </div>
                        <div className="video-box local-small">
                            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                            {localPrediction && (
                                <div className="prediction-overlay my-tag">🤟 {localPrediction}</div>
                            )}
                            {/* Bouton pour activer/désactiver l'AI */}
                            <button
                                onClick={toggleAIDetection}
                                style={{
                                    position: 'absolute',
                                    bottom: '-30px',
                                    left: '10px',
                                    background: isAIActive ? '#2ecc71' : '#e74c3c',
                                    border: 'none',
                                    color: 'white',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    zIndex: 20
                                }}
                            >
                                {isAIActive ? '🔴 Désactiver AI' : '🟢 Activer AI'}
                            </button>
                        </div>
                    </div>

                    <div className="controls-bar">
                        {callStatus === 'idle' && (
                            <button onClick={startCall} className="btn-call">📹 Appeler</button>
                        )}
                        {callStatus === 'ringing' && incomingCall && (
                            <button onClick={acceptCall} className="btn-accept">✅ Répondre</button>
                        )}
                        {callStatus === 'calling' && (
                            <span className="calling-label">⏳ En attente...</span>
                        )}
                        <button
                            className="btn-toggle-chat-mobile"
                            onClick={() => setIsChatOpen(v => !v)}
                            title="Chat"
                        >
                            💬
                        </button>
                        <button onClick={endCall} className="btn-end">🛑 Terminer</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoCall;