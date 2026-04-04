// component/VideoCall.jsx
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import './Styles/VideoCall.css';

const VideoCall = ({ currentUser, selectedUser, onClose }) => {
    const [callStatus, setCallStatus] = useState('idle');
    const [incomingCall, setIncomingCall] = useState(null);
    const [error, setError] = useState(null);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isEndingRef = useRef(false);

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

    useEffect(() => {
        if (!currentUser?._id) return;
        
        console.log('🎥 VideoCall component mounted');
        console.log('Current user:', currentUser._id);
        console.log('Selected user:', selectedUser?._id);
        
        if (!socketService.isConnected()) {
            console.log('⚠️ Socket not connected');
            setError('Cannot connect to server');
            return;
        }
        
        const setupVideoListeners = () => {
            socketService.on('incoming_call', (data) => {
                console.log('📞 INCOMING CALL RECEIVED:', data);
                
                if (data.fromUserId !== currentUser._id) {
                    setIncomingCall(data);
                    setCallStatus('ringing');
                    
                    if (Notification.permission === 'granted') {
                        new Notification('📞 Appel entrant', {
                            body: `${data.callerInfo?.name || 'Quelqu\'un'} vous appelle...`,
                        });
                    }
                    
                    try {
                        const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                        audio.play().catch(e => console.log('Audio play failed:', e));
                    } catch(e) {}
                }
            });
            
            socketService.on('call_accepted', (data) => {
                console.log('✅ CALL ACCEPTED:', data);
                if (peerRef.current && data.signal) {
                    peerRef.current.signal(data.signal);
                }
                setCallStatus('connected');
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
            socketService.off('incoming_call');
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
            setCallStatus('calling');
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
                setCallStatus('connected');
            });
            
            peer.on('error', (err) => {
                console.error('❌ Peer error:', err);
                if (!isEndingRef.current) {
                    setError('Connection error: ' + err.message);
                    endCall();
                }
            });
            
            peerRef.current = peer;
            
            setTimeout(() => {
                if (callStatus === 'calling' && !isEndingRef.current) {
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
            setCallStatus('connecting');
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
                setCallStatus('connected');
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
                            <p>📹 Call in progress with {selectedUser?.firstName}</p>
                            <button onClick={endCall} className="end-call-btn">End Call</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCall;