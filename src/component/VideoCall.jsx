import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import { Hands } from '@mediapipe/hands'; //
import * as cam from '@mediapipe/camera_utils'; //
import axios from 'axios';
import './Styles/VideoCall.css';

const VideoCall = ({ currentUser, selectedUser, initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState('idle');
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
    const [error, setError] = useState(null);
    const [prediction, setPrediction] = useState(""); //
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isEndingRef = useRef(false);
    const callStatusRef = useRef('idle');

    // --- AI LOGIC START ---
    const setupAI = () => {
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        hands.onResults(async (results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                
                // Flatten coordinates (x,y)
                let data_aux = [];
                for (let i = 0; i < landmarks.length; i++) {
                    data_aux.push(landmarks[i].x);
                    data_aux.push(landmarks[i].y);
                }

                try {
                    // Send to Python FastAPI
                    const res = await axios.post(
                        'https://zen-footing-depravity.ngrok-free.dev/predict', 
                        { landmarks: data_aux },
                        {
                            headers: {
                                "ngrok-skip-browser-warning": "69420"
                            }
                        }
                    );
                    
                    const predictedChar = res.data.res;
                    setPrediction(predictedChar);

                    // Send translation to the other user via Socket
                    if (socketService.isConnected()) {
                        socketService.emit('send_translation', {
                            text: predictedChar,
                            toUserId: selectedUser?._id,
                            fromUserId: currentUser._id
                        });
                    }
                } catch (err) {
                    console.error("AI Server Error:", err);
                }
            }
        });

        if (localVideoRef.current) {
            const camera = new cam.Camera(localVideoRef.current, {
                onFrame: async () => {
                    await hands.send({ image: localVideoRef.current });
                },
                width: 640,
                height: 480,
            });
            camera.start();
        }
    };
    // --- AI LOGIC END ---

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
        soundService.stopRingtone();
        soundService.playCallEnded(); 
        cleanup();
        if (socketService.isConnected() && selectedUser) {
            socketService.emit('end_call', {
                fromUserId: currentUser._id,
                toUserId: selectedUser._id
            });
        }
        onClose();
    };

    useEffect(() => {
        // Listen for incoming translations from the other user
        socketService.on('receive_translation', (text) => {
            setPrediction(text);
        });

        return () => {
            socketService.off('receive_translation');
        };
    }, []);

    useEffect(() => {
        if (initialIncomingCall && initialIncomingCall.fromUserId !== currentUser._id) {
            setCallStatusSafe('ringing');
            setIncomingCall(initialIncomingCall);
        }
    }, [initialIncomingCall]);

    useEffect(() => {
        if (!currentUser?._id) return;
        
        const setupVideoListeners = () => {
            socketService.on('call_accepted', (data) => {
                if (peerRef.current && data.signal) {
                    peerRef.current.signal(data.signal);
                }
                soundService.stopRingtone();
                soundService.playCallConnected();
                setCallStatusSafe('connected');
                setupAI(); // Start AI when call starts
            });
            
            socketService.on('call_rejected', (data) => {
                soundService.stopRingtone();
                soundService.playCallRejected(); 
                setError('Call was rejected');
                setTimeout(() => { if (!isEndingRef.current) endCall(); }, 2000);
            });
            
            socketService.on('call_ended', (data) => {
                if (!isEndingRef.current) {
                    soundService.stopRingtone();
                    soundService.playCallEnded(); 
                    setError('Call ended');
                    setTimeout(() => { cleanup(); onClose(); }, 1000);
                }
            });
        };
        
        setupVideoListeners();
        return () => {
            socketService.off('call_accepted');
            socketService.off('call_rejected');
            socketService.off('call_ended');
            cleanup();
        };
    }, [currentUser, selectedUser]);
    
    const startCall = async () => {
        try {
            setCallStatusSafe('calling');
            soundService.playDialTone(); 
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            
            const peer = new Peer({
                initiator: true,
                trickle: false,
                stream: stream,
            });
            
            peer.on('signal', (signal) => {
                socketService.emit('call_user', {
                    fromUserId: currentUser._id,
                    toUserId: selectedUser._id,
                    signal: signal,
                    callerInfo: { name: `${currentUser.firstName} ${currentUser.lastName}` }
                });
            });
            
            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                setCallStatusSafe('connected');
                setupAI(); // Start AI for initiator
            });
            
            peerRef.current = peer;
        } catch (err) { endCall(); }
    };
    
    const acceptCall = async () => {
        try {
            setCallStatusSafe('connecting');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            
            const peer = new Peer({ initiator: false, trickle: false, stream: stream });
            peer.on('signal', (signal) => {
                socketService.emit('accept_call', {
                    fromUserId: incomingCall.fromUserId,
                    toUserId: currentUser._id,
                    signal: signal
                });
            });
            
            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                setCallStatusSafe('connected');
                setupAI(); // Start AI for receiver
            });
            
            if (incomingCall?.signal) peer.signal(incomingCall.signal);
            peerRef.current = peer;
        } catch (err) { endCall(); }
    };

    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
                <div className="video-container">
                    <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                    <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                    
                    {/* AI Translation Overlay */}
                    {prediction && (
                        <div className="ai-prediction-badge">
                            AI Translation: {prediction}
                        </div>
                    )}
                </div>
                
                <div className="call-controls">
                    {callStatus === 'ringing' && (
                        <div className="ringing-buttons">
                            <button onClick={acceptCall} className="accept-call-btn">Accept</button>
                            <button onClick={() => { soundService.stopRingtone(); onClose(); }} className="reject-call-btn">Reject</button>
                        </div>
                    )}
                    {(callStatus === 'calling' || callStatus === 'connected') && (
                        <button onClick={endCall} className="end-call-btn">End Call</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCall;