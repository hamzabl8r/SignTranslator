// VideoCall.jsx - Version corrigée
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { io } from 'socket.io-client';
import './Styles/VideoCall.css';

const VideoCall = ({ currentUser, selectedUser, onClose }) => {
    const [callStatus, setCallStatus] = useState('idle');
    const [incomingCall, setIncomingCall] = useState(null);
    const [error, setError] = useState(null);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const isEndingRef = useRef(false);

    // Nettoyer les ressources
    const cleanup = () => {
        if (isEndingRef.current) return;
        isEndingRef.current = true;
        
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

    // Terminer l'appel
    const endCall = () => {
        if (isEndingRef.current) return;
        
        cleanup();
        
        if (socketRef.current && selectedUser) {
            console.log('📞 Sending end_call to:', selectedUser._id);
            socketRef.current.emit('end_call', {
                fromUserId: currentUser._id,
                toUserId: selectedUser._id
            });
        }
        
        onClose();
    };

    // Initialiser le socket
    useEffect(() => {
        if (!currentUser?._id) return;
        
        console.log('🎥 VideoCall component mounted');
        console.log('Current user:', currentUser._id);
        console.log('Selected user:', selectedUser?._id);
        
        // Utiliser le socket global s'il existe, sinon en créer un
        const SOCKET_URL = "https://backpfe-production.up.railway.app";
        
        if (!socketRef.current) {
            socketRef.current = io(SOCKET_URL, {
                transports: ['websocket', 'polling']
            });
            
            socketRef.current.on('connect', () => {
                console.log('✅ VideoCall socket connected:', socketRef.current.id);
                socketRef.current.emit('register', currentUser._id);
            });
        }
        
        if (!socketRef.current) {
            console.log('❌ No socket connection');
            setError('Cannot connect to server');
            return;
        }
        
        // Écouter les appels entrants
        const handleIncomingCall = (data) => {
            console.log('📞 INCOMING CALL RECEIVED:', data);
            console.log('From:', data.fromUserId);
            console.log('Current user:', currentUser._id);
            
            // Vérifier si l'appel est pour nous
            if (data.fromUserId !== currentUser._id) {
                setIncomingCall(data);
                setCallStatus('ringing');
                
                // Jouer un son
                try {
                    const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                    audio.play().catch(e => console.log('Audio play failed:', e));
                } catch(e) {
                    console.log('Audio error:', e);
                }
            }
        };
        
        // Écouter l'acceptation d'appel
        const handleCallAccepted = (data) => {
            console.log('✅ CALL ACCEPTED:', data);
            if (peerRef.current && data.signal) {
                peerRef.current.signal(data.signal);
            }
            setCallStatus('connected');
        };
        
        // Écouter le rejet
        const handleCallRejected = (data) => {
            console.log('❌ CALL REJECTED:', data);
            setCallStatus('idle');
            setError('Call was rejected');
            setTimeout(() => {
                if (!isEndingRef.current) endCall();
            }, 2000);
        };
        
        // Écouter la fin d'appel
        const handleCallEnded = (data) => {
            console.log('🔚 CALL ENDED:', data);
            if (!isEndingRef.current) {
                setError('Call ended');
                setTimeout(() => {
                    cleanup();
                    onClose();
                }, 1000);
            }
        };
        
        // Écouter les erreurs
        const handleCallError = (data) => {
            console.error('⚠️ CALL ERROR:', data);
            setError(data.error);
            setTimeout(() => {
                if (!isEndingRef.current) endCall();
            }, 2000);
        };
        
        socketRef.current.on('incoming_call', handleIncomingCall);
        socketRef.current.on('call_accepted', handleCallAccepted);
        socketRef.current.on('call_rejected', handleCallRejected);
        socketRef.current.on('call_ended', handleCallEnded);
        socketRef.current.on('call_error', handleCallError);
        
        return () => {
            console.log('🎥 VideoCall component unmounting');
            if (socketRef.current) {
                socketRef.current.off('incoming_call', handleIncomingCall);
                socketRef.current.off('call_accepted', handleCallAccepted);
                socketRef.current.off('call_rejected', handleCallRejected);
                socketRef.current.off('call_ended', handleCallEnded);
                socketRef.current.off('call_error', handleCallError);
            }
            cleanup();
        };
    }, [currentUser, selectedUser]);
    
    // Démarrer l'appel
    const startCall = async () => {
        try {
            console.log('🎥 Starting call to:', selectedUser?._id);
            setCallStatus('calling');
            setError(null);
            
            // Demander l'accès à la caméra/micro
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            console.log('✅ Camera/micro access granted');
            streamRef.current = stream;
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            // Créer la connexion peer
            const peer = new Peer({
                initiator: true,
                trickle: false,
                stream: stream
            });
            
            peer.on('signal', (signal) => {
                console.log('📡 Sending signal to:', selectedUser?._id);
                if (socketRef.current && !isEndingRef.current) {
                    socketRef.current.emit('call_user', {
                        fromUserId: currentUser._id,
                        toUserId: selectedUser._id,
                        signal: signal,
                        callerInfo: {
                            name: `${currentUser.firstName} ${currentUser.lastName}`,
                            profilePic: currentUser.profilePic
                        }
                    });
                    console.log('✅ Signal sent');
                }
            });
            
            peer.on('stream', (remoteStream) => {
                console.log('📹 Remote stream received');
                if (remoteVideoRef.current && !isEndingRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setCallStatus('connected');
            });
            
            peer.on('error', (err) => {
                console.error('❌ Peer error:', err);
                if (!isEndingRef.current) {
                    setError('Connection error');
                    endCall();
                }
            });
            
            peerRef.current = peer;
            
        } catch (err) {
            console.error('❌ Error starting call:', err);
            setError('Cannot access camera/microphone: ' + err.message);
            endCall();
        }
    };
    
    // Accepter l'appel
    const acceptCall = async () => {
        try {
            console.log('📞 Accepting call from:', incomingCall?.fromUserId);
            setCallStatus('connecting');
            setError(null);
            
            // Demander l'accès à la caméra/micro
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            streamRef.current = stream;
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            // Créer la connexion peer (non-initiator)
            const peer = new Peer({
                initiator: false,
                trickle: false,
                stream: stream
            });
            
            peer.on('signal', (signal) => {
                console.log('📡 Sending accept signal');
                if (socketRef.current && incomingCall && !isEndingRef.current) {
                    socketRef.current.emit('accept_call', {
                        fromUserId: incomingCall.fromUserId,
                        toUserId: currentUser._id,
                        signal: signal
                    });
                }
            });
            
            peer.on('stream', (remoteStream) => {
                console.log('📹 Remote stream received');
                if (remoteVideoRef.current && !isEndingRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setCallStatus('connected');
            });
            
            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (!isEndingRef.current) {
                    setError('Connection error');
                    endCall();
                }
            });
            
            // Envoyer le signal de l'appelant
            if (incomingCall && incomingCall.signal) {
                console.log('📡 Signaling peer with incoming signal');
                peer.signal(incomingCall.signal);
            }
            
            peerRef.current = peer;
            setIncomingCall(null);
            
        } catch (err) {
            console.error('Error accepting call:', err);
            setError('Cannot access camera/microphone: ' + err.message);
            endCall();
        }
    };
    
    // Rejeter l'appel
    const rejectCall = () => {
        console.log('📞 Rejecting call');
        if (incomingCall && socketRef.current && !isEndingRef.current) {
            socketRef.current.emit('reject_call', {
                fromUserId: incomingCall.fromUserId,
                toUserId: currentUser._id
            });
        }
        onClose();
    };
    
    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
                {/* Vidéos */}
                {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
                    <div className="video-container">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="remote-video"
                        />
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="local-video"
                        />
                    </div>
                )}
                
                {/* Contrôles */}
                <div className="call-controls">
                    {error && (
                        <div className="error-message">{error}</div>
                    )}
                    
                    {callStatus === 'idle' && !incomingCall && (
                        <button onClick={startCall} className="start-call-btn">
                            📹 Start Video Call
                        </button>
                    )}
                    
                    {callStatus === 'calling' && (
                        <div className="calling-status">
                            <div className="spinner"></div>
                            <p>Calling {selectedUser?.firstName}...</p>
                            <button onClick={endCall} className="end-call-btn">Cancel</button>
                        </div>
                    )}
                    
                    {callStatus === 'connecting' && (
                        <div className="calling-status">
                            <div className="spinner"></div>
                            <p>Connecting...</p>
                            <button onClick={endCall} className="end-call-btn">Cancel</button>
                        </div>
                    )}
                    
                    {callStatus === 'ringing' && incomingCall && (
                        <div className="ringing-status">
                            <p>📞 Incoming call from {incomingCall.callerInfo?.name}</p>
                            <div className="ringing-buttons">
                                <button onClick={acceptCall} className="accept-call-btn">
                                    Accept
                                </button>
                                <button onClick={rejectCall} className="reject-call-btn">
                                    Reject
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {callStatus === 'connected' && (
                        <div className="connected-status">
                            <p>📹 Call in progress with {selectedUser?.firstName}</p>
                            <button onClick={endCall} className="end-call-btn">
                                End Call
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCall;