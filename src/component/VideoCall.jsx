// component/VideoCall.jsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import './Styles/VideoCall.css';

// ✅ FIX: Accept initialIncomingCall prop — passed from Chat.jsx when call arrives
const VideoCall = ({ currentUser, selectedUser, initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState('idle');
    // ✅ FIX: Pre-populate incomingCall from prop if available
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
    const [error, setError] = useState(null);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isEndingRef = useRef(false);
    // ✅ FIX: Use ref to track callStatus for use inside setTimeout (avoids stale closure)
    const callStatusRef = useRef('idle');

    const setCallStatusSafe = (status) => {
        callStatusRef.current = status;
        setCallStatus(status);
    };

    const cleanup = () => {
        if (isEndingRef.current) return;
        isEndingRef.current = true;
        
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const endCall = () => {
        if (isEndingRef.current) return;
        
        cleanup();
        
        if (socketService.isConnected() && selectedUser) {
            console.log('📞 Sending end_call to:', selectedUser._id);
            socketService.emit('end_call', {
                fromUserId: currentUser._id,
                toUserId: selectedUser._id
            });
        }
        
        onClose();
    };

    // ✅ FIX: If opened because of an incoming call, set status to 'ringing' immediately
    useEffect(() => {
        if (initialIncomingCall && initialIncomingCall.fromUserId !== currentUser._id) {
            console.log('📞 VideoCall opened with pending incoming call:', initialIncomingCall);
            setCallStatusSafe('ringing');
            setIncomingCall(initialIncomingCall);
        }
    }, [initialIncomingCall]);

    useEffect(() => {
        if (!currentUser?._id) return;
        
        console.log('🎥 VideoCall component mounted');
        
        if (!socketService.isConnected()) {
            console.log('⚠️ Socket not connected');
            setError('Cannot connect to server');
            return;
        }
        
        const setupVideoListeners = () => {
            // ✅ FIX: Do NOT listen for incoming_call here anymore
            // Chat.jsx handles it and passes it via initialIncomingCall prop
            
            socketService.on('call_accepted', (data) => {
                console.log('✅ CALL ACCEPTED:', data);
                if (peerRef.current && data.signal) {
                    peerRef.current.signal(data.signal);
                }
                setCallStatusSafe('connected');
            });
            
            socketService.on('call_rejected', (data) => {
                console.log('❌ CALL REJECTED:', data);
                setError('Call was rejected');
                setTimeout(() => {
                    if (!isEndingRef.current) endCall();
                }, 2000);
            });
            
            socketService.on('call_ended', (data) => {
                console.log('🔚 CALL ENDED:', data);
                if (!isEndingRef.current) {
                    setError('Call ended');
                    setTimeout(() => {
                        cleanup();
                        onClose();
                    }, 1000);
                }
            });
            
            socketService.on('call_error', (data) => {
                console.error('⚠️ CALL ERROR:', data);
                setError(data.error);
                setTimeout(() => {
                    if (!isEndingRef.current) endCall();
                }, 2000);
            });
        };
        
        setupVideoListeners();
        
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        return () => {
            console.log('🎥 VideoCall component unmounting');
            socketService.off('call_accepted');
            socketService.off('call_rejected');
            socketService.off('call_ended');
            socketService.off('call_error');
            cleanup();
        };
    }, [currentUser, selectedUser]);
    
    const startCall = async () => {
        try {
            console.log('🎥 Starting call to:', selectedUser?._id);
            setCallStatusSafe('calling');
            setError(null);
            
            if (!socketService.isConnected()) {
                throw new Error('Socket not connected');
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            console.log('✅ Camera/micro access granted');
            streamRef.current = stream;
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            const peer = new Peer({
                initiator: true,
                trickle: false,
                stream: stream,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
            
            peer.on('signal', (signal) => {
                console.log('📡 Sending signal to:', selectedUser?._id);
                socketService.emit('call_user', {
                    fromUserId: currentUser._id,
                    toUserId: selectedUser._id,
                    signal: signal,
                    callerInfo: {
                        name: `${currentUser.firstName} ${currentUser.lastName}`,
                        profilePic: currentUser.profilePic
                    }
                });
                console.log('✅ Signal sent');
            });
            
            peer.on('stream', (remoteStream) => {
                console.log('📹 Remote stream received');
                if (remoteVideoRef.current && !isEndingRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setCallStatusSafe('connected');
            });
            
            peer.on('error', (err) => {
                console.error('❌ Peer error:', err);
                if (!isEndingRef.current) {
                    setError('Connection error: ' + err.message);
                    endCall();
                }
            });
            
            peerRef.current = peer;
            
            // ✅ FIX: Use ref instead of state variable to avoid stale closure
            setTimeout(() => {
                if (callStatusRef.current === 'calling' && !isEndingRef.current) {
                    console.log('⚠️ No response after 30 seconds');
                    setError('No response from user');
                    endCall();
                }
            }, 30000);
            
        } catch (err) {
            console.error('❌ Error starting call:', err);
            setError('Cannot access camera/microphone: ' + err.message);
            endCall();
        }
    };
    
    const acceptCall = async () => {
        try {
            console.log('📞 Accepting call from:', incomingCall?.fromUserId);
            setCallStatusSafe('connecting');
            setError(null);
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            streamRef.current = stream;
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            const peer = new Peer({
                initiator: false,
                trickle: false,
                stream: stream,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });
            
            peer.on('signal', (signal) => {
                console.log('📡 Sending accept signal');
                socketService.emit('accept_call', {
                    fromUserId: incomingCall.fromUserId,
                    toUserId: currentUser._id,
                    signal: signal
                });
            });
            
            peer.on('stream', (remoteStream) => {
                console.log('📹 Remote stream received');
                if (remoteVideoRef.current && !isEndingRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setCallStatusSafe('connected');
            });
            
            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (!isEndingRef.current) {
                    setError('Connection error: ' + err.message);
                    endCall();
                }
            });
            
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
    
    const rejectCall = () => {
        console.log('📞 Rejecting call');
        if (incomingCall && !isEndingRef.current) {
            socketService.emit('reject_call', {
                fromUserId: incomingCall.fromUserId,
                toUserId: currentUser._id
            });
        }
        onClose();
    };
    
    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
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
                
                <div className="call-controls">
                    {error && <div className="error-message">{error}</div>}
                    
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
                            <p>📞 Incoming call from {incomingCall.callerInfo?.name || 'Unknown'}</p>
                            <div className="ringing-buttons">
                                <button onClick={acceptCall} className="accept-call-btn">Accept</button>
                                <button onClick={rejectCall} className="reject-call-btn">Reject</button>
                            </div>
                        </div>
                    )}
                    
                    {callStatus === 'connected' && (
                        <div className="connected-status">
                            <p>📹 Call in progress</p>
                            <button onClick={endCall} className="end-call-btn">End Call</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCall;
