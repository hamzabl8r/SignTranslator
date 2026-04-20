import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import soundService from '../services/soundService';
import { Hands } from '@mediapipe/hands';
import axios from 'axios';
import './Styles/VideoCall.css';

const AI_SERVER_URL = 'https://zen-footing-depravity.ngrok-free.dev';

const VideoCall = ({ currentUser, selectedUser, initialIncomingCall, onClose }) => {
    const [callStatus, setCallStatus] = useState(initialIncomingCall ? 'ringing' : 'idle');
    const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
    const [localPrediction, setLocalPrediction] = useState("");   
    const [remotePrediction, setRemotePrediction] = useState(""); 

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const requestRef = useRef();
    const handsRef = useRef(null);

    // ==================== 1. AI LOGIC (84 Features) ====================
    const startAI = useCallback(() => {
        if (handsRef.current) return; // Ma t-7elech akther men wa7da

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

    if (data_aux.length === 84) {
        try {
            const res = await axios.post(`${AI_SERVER_URL}/predict`, 
                { landmarks: data_aux },
                { headers: { "ngrok-skip-browser-warning": "69420" } }
            );
            
            const predictedWord = res.data.res;

            if (predictedWord && predictedWord !== "error" && predictedWord !== "...") {
                
                setLocalPrediction(predictedWord);

                
                socketService.emit('send_translation', {
                    text: predictedWord,
                    toUserId: selectedUser?._id,
                    fromUserId: currentUser._id
                });
            }
        } catch (err) {
            console.error("❌ AI Prediction Error:", err);
        }
    }
});

        const detectFrame = async () => {
            if (localVideoRef.current && localVideoRef.current.readyState >= 2) {
                await hands.send({ image: localVideoRef.current });
            }
            requestRef.current = requestAnimationFrame(detectFrame);
        };
        detectFrame();
    }, [currentUser._id, selectedUser?._id]);

    // ==================== 2. WebRTC LOGIC ====================
    const endCall = useCallback(() => {
        cancelAnimationFrame(requestRef.current);
        if (handsRef.current) handsRef.current.close();
        if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        if (peerRef.current) peerRef.current.destroy();
        
        socketService.emit('end_call', { toUserId: selectedUser?._id, fromUserId: currentUser._id });
        onClose();
    }, [currentUser._id, selectedUser?._id, onClose]);

    const setupMedia = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setCallStatus('connected');
            startAI();
        });
        peerRef.current = peer;
    };

    const acceptCall = async () => {
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
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setCallStatus('connected');
            startAI();
        });

        peer.signal(incomingCall.signal);
        peerRef.current = peer;
    };

    useEffect(() => {
        // Listening lel translation mta3 s7ibek
        socketService.on('receive_translation', (data) => {
            setRemotePrediction(data.text);
        });

        socketService.on('call_accepted', (data) => {
            if (peerRef.current) peerRef.current.signal(data.signal);
            setCallStatus('connected');
            startAI();
        });

        socketService.on('call_ended', () => onClose());

        return () => {
            cancelAnimationFrame(requestRef.current);
            if (handsRef.current) handsRef.current.close();
            socketService.off('receive_translation');
            socketService.off('call_accepted');
            socketService.off('call_ended');
        };
    }, [onClose, startAI]);

    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
                <div className="video-grid">
                    <div className="video-box">
                        <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                        {remotePrediction && <div className="prediction-overlay peer-tag">{remotePrediction}</div>}
                    </div>
                    <div className="video-box local-small">
                        <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                        {localPrediction && <div className="prediction-overlay my-tag">{localPrediction}</div>}
                    </div>
                </div>
                
                <div className="controls-bar">
                    {callStatus === 'idle' && <button onClick={startCall} className="btn-call">📹 Call</button>}
                    {callStatus === 'ringing' && <button onClick={acceptCall} className="btn-accept">✅ Answer</button>}
                    <button onClick={endCall} className="btn-end">🛑 End</button>
                </div>
            </div>
        </div>
    );
};

export default VideoCall;