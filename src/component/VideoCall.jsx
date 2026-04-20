import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import { Hands } from '@mediapipe/hands';
import * as cam from '@mediapipe/camera_utils';
import axios from 'axios';
import './Styles/VideoCall.css';

const AI_SERVER_URL = 'https://zen-footing-depravity.ngrok-free.dev';

const VideoCall = ({ currentUser, selectedUser, initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState(initialIncomingCall ? 'ringing' : 'idle');
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
    const [error, setError] = useState(null);
    const [localPrediction, setLocalPrediction] = useState("");   // My own sign → sent to peer
    const [remotePrediction, setRemotePrediction] = useState(""); // Peer's sign → shown to me

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const isEndingRef = useRef(false);
    const callStatusRef = useRef(callStatus);
    const aiCameraRef = useRef(null);   // Track MediaPipe camera for cleanup
    const aiHandsRef = useRef(null);    // Track Hands instance for cleanup

    // ==================== AI TRANSLATION LOGIC ====================
    const startAI = useCallback(() => {
        // Prevent multiple instances
        if (aiCameraRef.current) return;

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
                const data_aux = [];
                landmarks.forEach(lm => {
                    data_aux.push(lm.x);
                    data_aux.push(lm.y);
                });

                try {
                    const res = await axios.post(
                        `${AI_SERVER_URL}/predict`,
                        { landmarks: data_aux },
                        { headers: { "ngrok-skip-browser-warning": "69420" } }
                    );

                    const word = res.data.res;
                    setLocalPrediction(word); // Show my own sign to myself

                    // Send translation to the remote peer
                    socketService.emit('send_translation', {
                        text: word,
                        toUserId: selectedUser?._id,
                        fromUserId: currentUser._id
                    });
                } catch (err) {
                    console.error("AI Server Error:", err.message);
                }
            }
        });

        aiHandsRef.current = hands;

        if (localVideoRef.current) {
            const camera = new cam.Camera(localVideoRef.current, {
                onFrame: async () => {
                    if (aiHandsRef.current) {
                        await aiHandsRef.current.send({ image: localVideoRef.current });
                    }
                },
                width: 640,
                height: 480,
            });
            camera.start();
            aiCameraRef.current = camera;
        }
    }, [selectedUser, currentUser]);

    const stopAI = useCallback(() => {
        if (aiCameraRef.current) {
            aiCameraRef.current.stop();
            aiCameraRef.current = null;
        }
        if (aiHandsRef.current) {
            aiHandsRef.current.close();
            aiHandsRef.current = null;
        }
    }, []);

    const setCallStatusSafe = (status) => {
        callStatusRef.current = status;
        setCallStatus(status);
    };

    const cleanup = useCallback(() => {
        if (isEndingRef.current) return;
        isEndingRef.current = true;
        stopAI();
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, [stopAI]);

    const endCall = useCallback(() => {
        if (isEndingRef.current) return;
        soundService.stopRingtone();
        cleanup();
        if (socketService.isConnected() && selectedUser) {
            socketService.emit('end_call', {
                fromUserId: currentUser._id,
                toUserId: selectedUser._id
            });
        }
        onClose();
    }, [cleanup, currentUser, selectedUser, onClose]);

    // ==================== SOCKET LISTENERS ====================
    useEffect(() => {
        // Receive remote peer's sign translation
        socketService.on('receive_translation', (data) => {
            setRemotePrediction(data.text);
        });

        socketService.on('call_accepted', (data) => {
            if (peerRef.current && data.signal) {
                peerRef.current.signal(data.signal);
            }
            setCallStatusSafe('connected');
            startAI();
        });

        socketService.on('call_ended', () => {
            endCall();
        });

        socketService.on('incoming_call', (data) => {
            setIncomingCall(data);
            setCallStatusSafe('ringing');
        });

        return () => {
            socketService.off('receive_translation');
            socketService.off('call_accepted');
            socketService.off('call_ended');
            socketService.off('incoming_call');
            cleanup();
        };
    }, [selectedUser, startAI, endCall, cleanup]);

    // ==================== CALL ACTIONS ====================
    const startCall = async () => {
        try {
            setCallStatusSafe('calling');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const peer = new Peer({ initiator: true, trickle: false, stream });

            peer.on('signal', (signal) => {
                socketService.emit('call_user', {
                    fromUserId: currentUser._id,
                    toUserId: selectedUser._id,
                    signal,
                    callerInfo: { name: `${currentUser.firstName} ${currentUser.lastName}` }
                });
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                setCallStatusSafe('connected');
                startAI();
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                setError('Connection error. Please try again.');
            });

            peerRef.current = peer;
        } catch (err) {
            console.error('Failed to start call:', err);
            setError('Could not access camera/microphone.');
            setCallStatusSafe('idle');
        }
    };

    const acceptCall = async () => {
        try {
            setCallStatusSafe('connecting');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const peer = new Peer({ initiator: false, trickle: false, stream });

            peer.on('signal', (signal) => {
                socketService.emit('accept_call', {
                    fromUserId: incomingCall.fromUserId,
                    toUserId: currentUser._id,
                    signal
                });
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                setCallStatusSafe('connected');
                startAI();
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                setError('Connection error. Please try again.');
            });

            if (incomingCall?.signal) peer.signal(incomingCall.signal);
            peerRef.current = peer;
        } catch (err) {
            console.error('Failed to accept call:', err);
            setError('Could not access camera/microphone.');
            setCallStatusSafe('idle');
        }
    };

    const rejectCall = () => {
        soundService.stopRingtone?.();
        if (socketService.isConnected() && incomingCall) {
            socketService.emit('reject_call', {
                fromUserId: incomingCall.fromUserId,
                toUserId: currentUser._id
            });
        }
        onClose();
    };

    // ==================== RENDER ====================
    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
                {error && (
                    <div className="call-error-banner">
                        ⚠️ {error}
                    </div>
                )}

                <div className="video-container">
                    <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                    <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />

                    {/* Remote peer's sign language translation */}
                    {remotePrediction && (
                        <div className="ai-prediction-badge remote-prediction">
                            🤟 Peer: <strong>{remotePrediction}</strong>
                        </div>
                    )}

                    {/* Your own sign language translation */}
                    {localPrediction && (
                        <div className="ai-prediction-badge local-prediction">
                            ✋ You: <strong>{localPrediction}</strong>
                        </div>
                    )}
                </div>

                <div className="call-controls">
                    {callStatus === 'idle' && !incomingCall && (
                        <button onClick={startCall} className="start-call-btn">
                            📹 Start Video Call
                        </button>
                    )}

                    {callStatus === 'ringing' && (
                        <div className="ringing-buttons">
                            <button onClick={acceptCall} className="accept-call-btn">✅ Accept</button>
                            <button onClick={rejectCall} className="reject-call-btn">❌ Reject</button>
                        </div>
                    )}

                    {callStatus === 'calling' && (
                        <div className="calling-status">
                            <span>📞 Calling...</span>
                            <button onClick={endCall} className="end-call-btn">Cancel</button>
                        </div>
                    )}

                    {callStatus === 'connected' && (
                        <button onClick={endCall} className="end-call-btn">📵 End Call</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoCall;