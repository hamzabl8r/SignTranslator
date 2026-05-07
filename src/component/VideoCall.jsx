import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import { sendMessageSocket } from '../redux/Slice/messageSlice';
import { Hands } from '@mediapipe/hands';
import axios from 'axios';
import toast from 'react-hot-toast'; // Ajout de l'import manquant
import './Styles/VideoCall.css';

const AI_SERVER_URL = 'https://zen-footing-depravity.ngrok-free.dev';

const VideoCall = ({ currentUser, selectedUser, incomingCall: initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState(initialIncomingCall ? 'ringing' : 'idle');
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);

    // Keep ref in sync so timeouts/callbacks always read the latest status
    const setCallStatusSynced = (status) => {
        callStatusRef.current = status;
        setCallStatus(status);
    };
    const [localPrediction, setLocalPrediction] = useState("");
    const [remotePrediction, setRemotePrediction] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [isAIActive, setIsAIActive] = useState(true); // Activé par défaut
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false); // Fix: ref pour éviter les closures périmées
    const [aiStatus, setAiStatus] = useState("Initialisation...");

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const animationFrameRef = useRef(null);
    const handsRef = useRef(null);
    const lastPredictionRef = useRef("");
    const lastPredictionTimeRef = useRef(0);
    const chatEndRef = useRef(null);
    const isMountedRef = useRef(true);
    const isAIActiveRef = useRef(true); // Fix: ref pour isAIActive pour les closures
    const callTimeoutRef = useRef(null);
    const callStatusRef = useRef('idle'); // Fix: track callStatus in ref to avoid stale closure

    // Scroll to bottom of chat
    const scrollChatToBottom = useCallback(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollChatToBottom();
    }, [chatMessages, scrollChatToBottom]);

    // Clean up hands instance safely
    const cleanupHands = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (handsRef.current) {
            try {
                handsRef.current.onResults = null;
                handsRef.current.close();
            } catch (error) {
                console.warn('Error closing hands:', error);
            }
            handsRef.current = null;
        }
    }, []);

    // Save message to DB
    const saveMessageToDB = useCallback((text, isLocal) => {
        if (!selectedUser?._id) return;
        try {
            sendMessageSocket({
                senderId: isLocal ? currentUser._id : selectedUser._id,
                receiverId: isLocal ? selectedUser._id : currentUser._id,
                text: `🤟 ${text}`,
            });
        } catch (error) {
            console.error('Error saving message to DB:', error);
        }
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
        if (isSign) {
            saveMessageToDB(text, isLocal);
        }
    }, [saveMessageToDB]);

    // Send text message manually
    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        addChatMessage(chatInput.trim(), true, false);

        try {
            sendMessageSocket({
                senderId: currentUser._id,
                receiverId: selectedUser?._id,
                text: chatInput.trim(),
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }

        socketService.emit('send_translation', {
            text: chatInput.trim(),
            toUserId: selectedUser?._id,
            fromUserId: currentUser._id,
            isSign: false,
        });

        setChatInput('');
    };

    // Fonction pour envoyer la prédiction
    const sendPrediction = useCallback(async (landmarks) => {
        if (isProcessingRef.current) return; // Fix: utiliser le ref pour éviter la closure périmée
        
        isProcessingRef.current = true;
        setIsProcessing(true);
        
        try {
            const res = await axios.post(`${AI_SERVER_URL}/predict`, 
                { landmarks: landmarks },
                { 
                    headers: { 
                        "ngrok-skip-browser-warning": "69420",
                        "Content-Type": "application/json"
                    },
                    timeout: 5000
                }
            );

            const predictedWord = res.data.res || res.data.prediction;

            if (predictedWord && 
                predictedWord !== "error" && 
                predictedWord !== "..." &&
                predictedWord !== "aucun" &&
                predictedWord !== lastPredictionRef.current) {
                
                console.log('🎯 Prédiction:', predictedWord);
                setLocalPrediction(predictedWord);
                lastPredictionRef.current = predictedWord;
                lastPredictionTimeRef.current = Date.now();
                
                addChatMessage(predictedWord, true, true);

                socketService.emit('send_translation', {
                    text: predictedWord,
                    toUserId: selectedUser?._id,
                    fromUserId: currentUser._id,
                    isSign: true,
                });

                // Effacer la prédiction après 3 secondes
                setTimeout(() => {
                    if (lastPredictionRef.current === predictedWord) {
                        setLocalPrediction("");
                    }
                }, 3000);
            }
        } catch (err) {
            console.error("❌ Erreur API:", err.message);
        } finally {
            setTimeout(() => {
                isProcessingRef.current = false; // Fix: réinitialiser le ref
                setIsProcessing(false);
            }, 1000);
        }
    }, [addChatMessage, currentUser._id, selectedUser?._id]); // Fix: retirer isProcessing des dépendances

    // Initialiser la détection des mains (correction du nom de la fonction)
    const initHandDetection = useCallback(async () => {
        if (!localVideoRef.current || !isMountedRef.current) {
            setAiStatus("En attente de la caméra...");
            return;
        }

        setAiStatus("Initialisation du détecteur...");
        
        cleanupHands();

        try {
            const hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });
            
            handsRef.current = hands;

            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            hands.onResults(async (results) => {
                if (!isMountedRef.current || !isAIActiveRef.current) return; // Fix: utiliser le ref

                const hasHands = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
                
                if (hasHands) {
                    setAiStatus("🖐️ Main détectée...");
                    
                    // Collecter les landmarks pour les deux mains
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
                    
                    if (data_aux.length === 84 && !isProcessingRef.current) { // Fix: utiliser le ref
                        await sendPrediction(data_aux);
                    }
                } else {
                    setAiStatus("🤟 En attente de geste...");
                }
            });

            // Démarrer la boucle de détection
            const detectFrame = async () => {
                if (!isMountedRef.current || !handsRef.current || !localVideoRef.current) {
                    return;
                }
                
                try {
                    if (localVideoRef.current.readyState >= 2) {
                        await handsRef.current.send({ image: localVideoRef.current });
                    }
                } catch (error) {
                    // Ignorer les erreurs normales
                }
                
                if (isMountedRef.current && isAIActiveRef.current) { // Fix: utiliser le ref
                    animationFrameRef.current = requestAnimationFrame(detectFrame);
                }
            };
            
            detectFrame();
            setAiStatus("✅ Prêt - Faites des gestes!");
            
        } catch (error) {
            console.error('Failed to initialize MediaPipe:', error);
            setAiStatus("❌ Erreur d'initialisation");
        }
    }, [cleanupHands, sendPrediction]); // Fix: retirer isAIActive et isProcessing des dépendances

    // Toggle AI detection
    const toggleAIDetection = useCallback(() => {
        const nextActive = !isAIActiveRef.current; // Fix: lire depuis le ref, pas le state périmé
        isAIActiveRef.current = nextActive;
        setIsAIActive(nextActive);
        if (nextActive) {
            setAiStatus("Activation en cours...");
            initHandDetection();
        } else {
            setAiStatus("Désactivé");
            cleanupHands();
        }
    }, [initHandDetection, cleanupHands]); // Fix: retirer isAIActive des dépendances

    // End call with proper cleanup
    const endCall = useCallback(() => {
        // Fix: ne pas mettre isMountedRef à false ici car le composant peut rester monté
        // Fix: annuler le timeout d'appel sans réponse
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        
        cleanupHands();
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }
        
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        
        socketService.emit('end_call', { toUserId: selectedUser?._id, fromUserId: currentUser._id });
        onClose();
    }, [currentUser._id, selectedUser?._id, onClose, cleanupHands]);

    const setupMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            streamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            toast.error('Impossible d\'accéder à la caméra/micro');
            throw error;
        }
    };

    const startCall = async () => {
        setCallStatusSynced('calling');
        try {
            const stream = await setupMedia();
            const peer = new Peer({ initiator: true, trickle: false, stream });

            peer.on('signal', (signal) => {
                socketService.emit('call_user', {
                    fromUserId: currentUser._id,
                    toUserId: selectedUser._id,
                    signal,
                    callerInfo: { name: currentUser.firstName, profilePic: currentUser.profilePic }
                });
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                // Annuler le timeout si l'appel est connecté
                if (callTimeoutRef.current) {
                    clearTimeout(callTimeoutRef.current);
                    callTimeoutRef.current = null;
                }
                setCallStatusSynced('connected');
                setTimeout(() => {
                    if (isMountedRef.current) {
                        initHandDetection();
                    }
                }, 1000);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                endCall();
            });

            peerRef.current = peer;

            // Fix: use callStatusRef to avoid stale closure
            callTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current && callStatusRef.current === 'calling') {
                    toast.error(`${selectedUser?.firstName} ne répond pas`);
                    endCall();
                }
            }, 30000);

        } catch (error) {
            console.error('Error starting call:', error);
            setCallStatusSynced('idle');
        }
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        
        try {
            const stream = await setupMedia();
            const peer = new Peer({ initiator: false, trickle: false, stream });

            peer.on('signal', (signal) => {
                // Fix: toUserId doit être l'appelant pour que le signal lui revienne
                socketService.emit('accept_call', {
                    toUserId: incomingCall.fromUserId,   // ← l'appelant reçoit le signal
                    fromUserId: currentUser._id,          // ← moi (celui qui répond)
                    signal
                });
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setCallStatusSynced('connected');
                setTimeout(() => {
                    if (isMountedRef.current) {
                        initHandDetection();
                    }
                }, 1000);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                endCall();
            });

            peer.signal(incomingCall.signal);
            peerRef.current = peer;
            setIncomingCall(null);
        } catch (error) {
            console.error('Error accepting call:', error);
        }
    };

    // Socket listeners
    useEffect(() => {
        const handleReceiveTranslation = (data) => {
            console.log('📨 Translation reçue:', data);
            setRemotePrediction(data.text);
            addChatMessage(data.text, false, data.isSign ?? true);
            
            setTimeout(() => {
                setRemotePrediction("");
            }, 3000);
        };

        const handleCallAccepted = (data) => {
            if (!peerRef.current) {
                console.warn('call_accepted reçu mais peer inexistant');
                return;
            }
            try {
                peerRef.current.signal(data.signal);
                // Ne pas setCallStatus ici — c'est le event 'stream' qui confirme la connexion
            } catch (err) {
                console.error('Erreur signal call_accepted:', err);
                endCall();
            }
        };

        const handleCallEnded = () => {
            endCall();
        };

        const handleCallRejected = () => {
            toast.error(`${selectedUser?.firstName} a refusé l'appel`);
            endCall();
        };

        socketService.on('receive_translation', handleReceiveTranslation);
        socketService.on('call_accepted', handleCallAccepted);
        socketService.on('call_ended', handleCallEnded);
        socketService.on('call_rejected', handleCallRejected);

        return () => {
            socketService.off('receive_translation', handleReceiveTranslation);
            socketService.off('call_accepted', handleCallAccepted);
            socketService.off('call_ended', handleCallEnded);
            socketService.off('call_rejected', handleCallRejected);
        };
    }, [addChatMessage, endCall, selectedUser?.firstName]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        
        return () => {
            isMountedRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            cleanupHands();
        };
    }, [cleanupHands]);

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
                                    {callStatus === 'connected' ? '🟢 Connecté' : callStatus === 'calling' ? '⏳ Appel...' : callStatus === 'ringing' ? '📞 Sonnerie' : '⚪ Inactif'}
                                </span>
                            </div>
                        </div>
                        <button className="toggle-chat-btn" onClick={() => setIsChatOpen(v => !v)} title="Chat">
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
                                        <p style={{ fontSize: '0.7rem', marginTop: '5px', color: isAIActive ? '#2ecc71' : '#e74c3c' }}>
                                            {isAIActive ? '🟢 Traduction active' : '⚪ Traduction désactivée'}
                                        </p>
                                        <p style={{ fontSize: '0.65rem', marginTop: '5px', color: '#888' }}>
                                            {aiStatus}
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
                                <div className="prediction-overlay peer-tag">
                                    🤟 {remotePrediction}
                                </div>
                            )}
                        </div>
                        <div className="video-box local-small">
                            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                            {localPrediction && (
                                <div className="prediction-overlay my-tag">
                                    🤟 {localPrediction}
                                </div>
                            )}
                            {/* AI Toggle Button */}
                            <button
                                onClick={toggleAIDetection}
                                style={{
                                    position: 'absolute',
                                    bottom: '-35px',
                                    left: '10px',
                                    background: isAIActive ? '#2ecc71' : '#e74c3c',
                                    border: 'none',
                                    color: 'white',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    zIndex: 20,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isAIActive ? '🔴 Désactiver Traduction' : '🟢 Activer Traduction'}
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
                        {callStatus === 'connected' && (
                            <span className="calling-label" style={{ fontSize: '11px', color: '#2ecc71' }}>
                                {aiStatus}
                            </span>
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