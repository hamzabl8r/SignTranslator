import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import { sendMessageSocket } from '../redux/Slice/messageSlice';
import { Hands } from '@mediapipe/hands';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Styles/VideoCall.css';

const AI_SERVER_URL = 'https://modelsigntranslator.onrender.com';

const isBenignPeerCloseError = (err) => {
  const message = String(err?.message || err || '').toLowerCase();

  return (
    message.includes('user-initiated abort') ||
    message.includes('close called') ||
    message.includes('closed') ||
    message.includes('connection failed')
  );
};

const VideoCall = ({
  currentUser,
  selectedUser,
  incomingCall: initialIncomingCall,
  onClose,
}) => {
  const [callStatus, setCallStatus] = useState(
    initialIncomingCall ? 'ringing' : 'idle'
  );

  const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
  const [localPrediction, setLocalPrediction] = useState('');
  const [remotePrediction, setRemotePrediction] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isAIActive, setIsAIActive] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState('Initialisation...');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  const animationFrameRef = useRef(null);
  const handsRef = useRef(null);

  const lastPredictionRef = useRef('');
  const lastPredictionTimeRef = useRef(0);

  const chatEndRef = useRef(null);

  const isMountedRef = useRef(true);
  const isAIActiveRef = useRef(true);
  const isProcessingRef = useRef(false);

  const callTimeoutRef = useRef(null);
  const callStatusRef = useRef(initialIncomingCall ? 'ringing' : 'idle');
  const incomingCallRef = useRef(initialIncomingCall || null);

  const hasAcceptedCallRef = useRef(false);
  const hasReceivedAnswerRef = useRef(false);
  const hasLoggedConnectedRef = useRef(false);
  const hasLoggedEndedRef = useRef(false);

  // Prevent cleanup loops
  const isCleaningUpRef = useRef(false);
  // Stable ref to cleanupCall so unmount effect never re-runs due to dep changes
  const cleanupCallRef = useRef(null);

  // FIX: serverReadyRef holds a Promise that resolves once the AI server responds.
  // sendPrediction awaits this before every call, so no predict request fires
  // until the Render.com cold-start is fully complete (can take up to ~40s).
  const serverReadyRef = useRef(null);

  useEffect(() => {
    setAiStatus('⏳ Réveil du serveur IA...');
    serverReadyRef.current = axios
      .get(`${AI_SERVER_URL}/`, { timeout: 60000 })
      .then(() => {
        console.log('✅ AI server is ready');
        if (isMountedRef.current) setAiStatus('✅ Serveur prêt');
      })
      .catch((err) => {
        console.warn('⚠️ AI server wake-up failed, will retry on predict:', err.message);
        if (isMountedRef.current) setAiStatus('⚠️ Serveur lent, tentative...');
      });
  }, []);

  const setCallStatusSynced = useCallback((status) => {
    callStatusRef.current = status;
    setCallStatus(status);
  }, []);

  const scrollChatToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages, scrollChatToBottom]);

  // If parent sends a new incoming call after component is mounted
  useEffect(() => {
    if (initialIncomingCall) {
      setIncomingCall(initialIncomingCall);
      incomingCallRef.current = initialIncomingCall;
      setCallStatusSynced('ringing');
      hasAcceptedCallRef.current = false;
      hasReceivedAnswerRef.current = false;
    }
  }, [initialIncomingCall, setCallStatusSynced]);

  const cleanupHands = useCallback(() => {
    if (animationFrameRef.current) {
      clearInterval(animationFrameRef.current);
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

  const saveMessageToDB = useCallback(
    (text, isLocal) => {
      if (!selectedUser?._id || !currentUser?._id) return;

      try {
        sendMessageSocket({
          senderId: isLocal ? currentUser._id : selectedUser._id,
          receiverId: isLocal ? selectedUser._id : currentUser._id,
          text: `🤟 ${text}`,
        });
      } catch (error) {
        console.error('Error saving message to DB:', error);
      }
    },
    [currentUser?._id, selectedUser?._id]
  );

  const addChatMessage = useCallback(
    (text, isLocal, isSign = false) => {
      const msg = {
        id: Date.now() + Math.random(),
        text,
        isLocal,
        isSign,
        time: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setChatMessages((prev) => [...prev, msg]);

      if (isSign) {
        saveMessageToDB(text, isLocal);
      }
    },
    [saveMessageToDB]
  );

  const persistCallEventMessage = useCallback(
    (text) => {
      if (!currentUser?._id || !selectedUser?._id || !text) return;

      try {
        sendMessageSocket({
          senderId: currentUser._id,
          receiverId: selectedUser._id,
          text,
        });
      } catch (error) {
        console.error("Error saving call event message:", error);
      }
    },
    [currentUser?._id, selectedUser?._id]
  );

  const handleSendChat = (e) => {
    e.preventDefault();

    const text = chatInput.trim();
    if (!text) return;

    addChatMessage(text, true, false);

    try {
      sendMessageSocket({
        senderId: currentUser._id,
        receiverId: selectedUser?._id,
        text,
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }

    socketService.emit('send_translation', {
      text,
      toUserId: selectedUser?._id,
      fromUserId: currentUser._id,
      isSign: false,
    });

    setChatInput('');
  };

  const sendPrediction = useCallback(
    async (landmarks) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        // Wait for the server wake-up ping to finish before firing /predict.
        // This ensures the Render.com cold-start is complete first.
        if (serverReadyRef.current) {
          await serverReadyRef.current;
        }

        // CRITICAL FIX: Do NOT use `return` inside a try block that has a
        // finally clause. An early `return` skips finally, leaving
        // isProcessingRef=true forever and permanently blocking all future
        // predictions. Use if/else so finally ALWAYS executes.
        if (isMountedRef.current && isAIActiveRef.current) {
          const res = await axios.post(
            `${AI_SERVER_URL}/predict`,
            { landmarks },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 60000,
            }
          );

          const predictedWord = res.data.res || res.data.prediction;

          if (
            predictedWord &&
            predictedWord !== 'error' &&
            predictedWord !== '...' &&
            predictedWord !== 'aucun' &&
            predictedWord !== lastPredictionRef.current
          ) {
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

            setTimeout(() => {
              if (lastPredictionRef.current === predictedWord) {
                setLocalPrediction('');
              }
            }, 3000);
          }
        }
      } catch (err) {
        console.error('❌ Erreur API:', err.message);
      } finally {
        // This ALWAYS runs — lock is always released no matter what path was taken.
        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }, 300);
      }
    },
    [addChatMessage, currentUser?._id, selectedUser?._id]
  );

  const initHandDetection = useCallback(async () => {
    if (!localVideoRef.current || !isMountedRef.current) {
      setAiStatus('En attente de la caméra...');
      return;
    }

    // Wait until the video element actually has dimensions.
    // Sending a zero-size frame to MediaPipe causes a fatal WASM abort.
    const video = localVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setAiStatus('En attente de la vidéo...');
      await new Promise((resolve) => {
        // If already playing with dimensions, resolve immediately
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          return resolve();
        }

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          clearInterval(poll);
          resolve();
        };

        // 'playing' fires once the browser starts rendering frames
        video.addEventListener('playing', done, { once: true });

        // Fallback poll every 100ms
        const poll = setInterval(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) done();
        }, 100);

        // Hard timeout: 8s max
        setTimeout(done, 8000);
      });
    }

    // Double-check after waiting — if still zero, video is not usable
    if (localVideoRef.current.videoWidth === 0 || localVideoRef.current.videoHeight === 0) {
      setAiStatus('❌ Vidéo non disponible');
      return;
    }

    if (!isMountedRef.current) return;

    setAiStatus('Initialisation du détecteur...');
    cleanupHands();

    try {
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      handsRef.current = hands;

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Initialize MediaPipe fully before registering onResults or sending frames.
      setAiStatus('Chargement du modèle...');
      await hands.initialize();

      if (!isMountedRef.current) return;

      // Register onResults AFTER initialize() so it's bound to the loaded model
      // FIX: onResults is now synchronous — it schedules sendPrediction without
      // awaiting it, preventing MediaPipe from being stalled by a dangling Promise.
      hands.onResults = (results) => {
        if (!isMountedRef.current || !isAIActiveRef.current) return;

        const hasHands =
          results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

        if (hasHands) {
          setAiStatus('🖐️ Main détectée...');

          const dataAux = [];

          for (let i = 0; i < 2; i++) {
            if (results.multiHandLandmarks && results.multiHandLandmarks[i]) {
              results.multiHandLandmarks[i].forEach((lm) => {
                dataAux.push(lm.x);
                dataAux.push(lm.y);
              });
            } else {
              for (let j = 0; j < 42; j++) {
                dataAux.push(0);
              }
            }
          }

          if (dataAux.length === 84 && !isProcessingRef.current) {
            // Fire-and-forget: don't await, MediaPipe doesn't support async onResults
            sendPrediction(dataAux);
          }
        } else {
          setAiStatus('🤟 En attente de geste...');
        }
      };

      // Use an offscreen canvas to safely extract frames from the video.
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // FIX: Detection interval increased from 200ms to 500ms.
      // 200ms (5fps) was too fast: frames piled up faster than the API
      // could respond, keeping isProcessingRef locked almost continuously.
      // 500ms (2fps) is sufficient for sign detection and gives the API
      // enough breathing room to respond between frames.
      const detectionInterval = setInterval(async () => {
        if (
          !isMountedRef.current ||
          !handsRef.current ||
          !localVideoRef.current ||
          !isAIActiveRef.current
        ) {
          clearInterval(detectionInterval);
          return;
        }

        try {
          const video = localVideoRef.current;

          if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            await handsRef.current.send({ image: canvas });
          }
        } catch (error) {
          console.warn('MediaPipe send error:', error);
        }
      }, 500); // FIX: was 200ms

      // Store interval ID so cleanupHands can clear it
      animationFrameRef.current = detectionInterval;
      // Show ready status; if server is still waking up, sendPrediction
      // will block internally until serverReadyRef resolves.
      setAiStatus('✅ Prêt - Faites des gestes!');
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      setAiStatus("❌ Erreur d'initialisation");
    }
  }, [cleanupHands, sendPrediction]);

  const toggleAIDetection = useCallback(() => {
    const nextActive = !isAIActiveRef.current;

    isAIActiveRef.current = nextActive;
    setIsAIActive(nextActive);

    if (nextActive) {
      setAiStatus('Activation en cours...');
      initHandDetection();
    } else {
      setAiStatus('Désactivé');
      cleanupHands();
    }
  }, [initHandDetection, cleanupHands]);

  const cleanupCall = useCallback(
    ({ emitEndCall = true, closeModal = true } = {}) => {
      if (isCleaningUpRef.current) return;

      isCleaningUpRef.current = true;

      hasAcceptedCallRef.current = false;
      hasReceivedAnswerRef.current = false;

      // Capture before resetting so we can log the end-call message below
      const wasConnected = hasLoggedConnectedRef.current;
      hasLoggedConnectedRef.current = false;

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      cleanupHands();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
            track.enabled = false;
          } catch (error) {
            console.warn('Error stopping track:', error);
          }
        });

        streamRef.current = null;
      }

      if (peerRef.current) {
        try {
          peerRef.current.removeAllListeners?.();
          peerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying peer:', error);
        }

        peerRef.current = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setIncomingCall(null);
      incomingCallRef.current = null;
      setLocalPrediction('');
      setRemotePrediction('');
      setCallStatusSynced('idle');

      if (wasConnected && !hasLoggedEndedRef.current) {
        hasLoggedEndedRef.current = true;
        persistCallEventMessage('📴 Video call ended');
      }

      if (emitEndCall && currentUser?._id) {
        const targetUserId =
          selectedUser?._id || incomingCallRef.current?.fromUserId || incomingCallRef.current?.toUserId;

        if (targetUserId) {
          socketService.emit('end_call', {
            toUserId: targetUserId,
            fromUserId: currentUser._id,
          });
        }
      }

      if (closeModal && typeof onClose === 'function') {
        onClose();
      }

      setTimeout(() => {
        isCleaningUpRef.current = false;
      }, 300);
    },
    [
      cleanupHands,
      currentUser?._id,
      selectedUser?._id,
      onClose,
      persistCallEventMessage,
      setCallStatusSynced,
    ]
  );

  // Keep ref in sync so the unmount effect can call cleanupCall
  // without needing it as a dependency (which would cause re-runs)
  cleanupCallRef.current = cleanupCall;

  const endCall = useCallback(() => {
    cleanupCall({ emitEndCall: true, closeModal: true });
  }, [cleanupCall]);

  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Must call play() explicitly — autoplay alone is not reliable.
        // Without this, videoWidth stays 0 and MediaPipe aborts.
        try {
          await localVideoRef.current.play();
        } catch (e) {
          // Ignore — browser may allow autoplay anyway
        }
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast.error("Impossible d'accéder à la caméra/micro");
      throw error;
    }
  };

  const startCall = async () => {
    if (!currentUser?._id || !selectedUser?._id) {
      toast.error('Utilisateur invalide');
      return;
    }

    hasAcceptedCallRef.current = false;
    hasReceivedAnswerRef.current = false;
    hasLoggedEndedRef.current = false;
    isCleaningUpRef.current = false;

    setCallStatusSynced('calling');

    try {
      const stream = await setupMedia();

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
      });

      let callSignalSent = false;
      peer.on('signal', (signal) => {
        if (callSignalSent) return;
        callSignalSent = true;
        socketService.emit('call_user', {
          fromUserId: currentUser._id,
          toUserId: selectedUser._id,
          signal,
          callerInfo: {
            name: currentUser.firstName,
            profilePic: currentUser.profilePic,
          },
        });
      });

      peer.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }

        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        setCallStatusSynced('connected');

        if (!hasLoggedConnectedRef.current) {
          hasLoggedConnectedRef.current = true;
          persistCallEventMessage('📞 Video call connected');
        }

        setTimeout(() => {
          if (isMountedRef.current && isAIActiveRef.current) {
            initHandDetection();
          }
        }, 1000);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);

        if (isBenignPeerCloseError(err)) {
          console.warn('Ignoring benign peer close error');
          return;
        }

        cleanupCall({ emitEndCall: true, closeModal: true });
      });

      peer.on('close', () => {
        console.log('Peer closed');
      });

      peerRef.current = peer;

      callTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && callStatusRef.current === 'calling') {
          toast.error(`${selectedUser?.firstName || 'Utilisateur'} ne répond pas`);
          cleanupCall({ emitEndCall: true, closeModal: true });
        }
      }, 30000);
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatusSynced('idle');
      cleanupCall({ emitEndCall: false, closeModal: false });
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    if (hasAcceptedCallRef.current) {
      console.warn('Call already accepted, ignoring duplicate acceptCall');
      return;
    }

    hasAcceptedCallRef.current = true;
    isCleaningUpRef.current = false;

    try {
      const stream = await setupMedia();

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
      });

      let acceptSignalSent = false;
      peer.on('signal', (signal) => {
        if (acceptSignalSent) return;
        acceptSignalSent = true;
        socketService.emit('accept_call', {
          toUserId: incomingCall.fromUserId,
          fromUserId: currentUser._id,
          signal,
        });
      });

      peer.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }

        // Only clear incomingCall once the stream is confirmed
        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallStatusSynced('connected');

        if (!hasLoggedConnectedRef.current) {
          hasLoggedConnectedRef.current = true;
          persistCallEventMessage('📞 Video call connected');
        }

        setTimeout(() => {
          if (isMountedRef.current && isAIActiveRef.current) {
            initHandDetection();
          }
        }, 1000);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);

        if (isBenignPeerCloseError(err)) {
          console.warn('Ignoring benign peer close error');
          return;
        }

        cleanupCall({ emitEndCall: true, closeModal: true });
      });

      peer.on('close', () => {
        console.log('Peer closed');
      });

      peerRef.current = peer;

      // Trigger the WebRTC handshake with the caller's signal
      peer.signal(incomingCall.signal);

    } catch (error) {
      console.error('Error accepting call:', error);
      hasAcceptedCallRef.current = false;
      toast.error("Impossible d'accepter l'appel");
      cleanupCall({ emitEndCall: true, closeModal: true });
    }
  };

  useEffect(() => {
    const handleReceiveTranslation = (data) => {
      console.log('📨 Translation reçue:', data);

      if (!data?.text) return;

      setRemotePrediction(data.text);
      addChatMessage(data.text, false, data.isSign ?? true);

      setTimeout(() => {
        setRemotePrediction('');
      }, 3000);
    };

    const handleCallAccepted = (data) => {
      if (!peerRef.current) {
        console.warn('call_accepted reçu mais peer inexistant');
        return;
      }

      if (hasReceivedAnswerRef.current) {
        console.warn('Duplicate call_accepted ignored');
        return;
      }

      hasReceivedAnswerRef.current = true;

      try {
        peerRef.current.signal(data.signal);
      } catch (err) {
        console.error('Erreur signal call_accepted:', err);

        if (isBenignPeerCloseError(err)) {
          console.warn('Ignoring benign signal error after close');
          return;
        }

        cleanupCall({ emitEndCall: true, closeModal: true });
      }
    };

    const handleCallEnded = () => {
      console.log('Call ended by remote user');
      cleanupCall({ emitEndCall: false, closeModal: true });
    };

    const handleCallRejected = () => {
      toast.error(`${selectedUser?.firstName || 'Utilisateur'} a refusé l'appel`);
      cleanupCall({ emitEndCall: false, closeModal: true });
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
  }, [addChatMessage, cleanupCall, selectedUser?.firstName, setCallStatusSynced]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Use ref to avoid this effect re-running every time cleanupCall changes
      cleanupCallRef.current?.({
        emitEndCall: false,
        closeModal: false,
      });
    };
  }, []); // empty deps — runs only on mount/unmount

  return (
    <div className="video-call-overlay">
      <div className="video-call-layout">
        <div className={`call-chat-panel ${isChatOpen ? 'open' : 'closed'}`}>
          <div className="call-chat-header">
            <div className="call-chat-header-info">
              <img
                src={
                  selectedUser?.profilePic
                    ? `https://backpfe-production-789f.up.railway.app${selectedUser.profilePic}`
                    : '/default-avatar.png'
                }
                alt={selectedUser?.firstName || 'user'}
                onError={(e) => {
                  e.target.src = '/default-avatar.png';
                }}
              />

              <div>
                <span className="call-chat-name">
                  {selectedUser?.firstName} {selectedUser?.lastName}
                </span>

                <span className="call-chat-status">
                  {callStatus === 'connected'
                    ? '🟢 Connecté'
                    : callStatus === 'calling'
                    ? '⏳ Appel...'
                    : callStatus === 'ringing'
                    ? '📞 Sonnerie'
                    : '⚪ Inactif'}
                </span>
              </div>
            </div>

            <button
              className="toggle-chat-btn"
              onClick={() => setIsChatOpen((v) => !v)}
              title="Chat"
            >
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

                    <p
                      style={{
                        fontSize: '0.7rem',
                        marginTop: '5px',
                        color: isAIActive ? '#2ecc71' : '#e74c3c',
                      }}
                    >
                      {isAIActive
                        ? '🟢 Traduction active'
                        : '⚪ Traduction désactivée'}
                    </p>

                    <p
                      style={{
                        fontSize: '0.65rem',
                        marginTop: '5px',
                        color: '#888',
                      }}
                    >
                      {aiStatus}
                    </p>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`call-chat-msg ${
                      msg.isLocal ? 'local' : 'remote'
                    }`}
                  >
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
                  onChange={(e) => setChatInput(e.target.value)}
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

        <div className="video-call-container">
          <div className="video-grid">
            <div className="video-box">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />

              {remotePrediction && (
                <div className="prediction-overlay peer-tag">
                  🤟 {remotePrediction}
                </div>
              )}
            </div>

            <div className="video-box local-small">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />

              {localPrediction && (
                <div className="prediction-overlay my-tag">
                  🤟 {localPrediction}
                </div>
              )}

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
                  transition: 'all 0.2s',
                }}
              >
                {isAIActive
                  ? '🔴 Désactiver Traduction'
                  : '🟢 Activer Traduction'}
              </button>
            </div>
          </div>

          <div className="controls-bar">
            {callStatus === 'idle' && (
              <button onClick={startCall} className="btn-call">
                📹 Appeler
              </button>
            )}

            {callStatus === 'ringing' && incomingCall && (
              <button
                onClick={acceptCall}
                className="btn-accept"
                disabled={hasAcceptedCallRef.current}
              >
                ✅ Répondre
              </button>
            )}

            {callStatus === 'calling' && (
              <span className="calling-label">⏳ En attente...</span>
            )}

            {callStatus === 'connected' && (
              <span
                className="calling-label"
                style={{ fontSize: '11px', color: '#2ecc71' }}
              >
                {aiStatus}
              </span>
            )}

            <button
              className="btn-toggle-chat-mobile"
              onClick={() => setIsChatOpen((v) => !v)}
              title="Chat"
            >
              💬
            </button>

            <button onClick={endCall} className="btn-end">
              🛑 Terminer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;