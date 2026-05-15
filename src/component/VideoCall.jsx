import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import socketService from '../services/socketService';
import { sendMessageSocket } from '../redux/Slice/messageSlice';
import { Hands } from '@mediapipe/hands';
import axios from 'axios';
import toast from 'react-hot-toast';
import SeoHelmet from './SeoHelmet';
import './Styles/VideoCall.css';

const AI_SERVER_URLS = [
  'https://zen-footing-depravity.ngrok-free.dev',
  'https://modelsigntranslator.onrender.com',
];
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

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

  // FIX: renamed to detectionIntervalRef for clarity — stores a setInterval ID,
  // never a requestAnimationFrame ID.
  const detectionIntervalRef = useRef(null);
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

  const isCleaningUpRef = useRef(false);
  const cleanupCallRef = useRef(null);
  const activeAIBaseUrlRef = useRef(AI_SERVER_URLS[0]);

  // serverReadyRef holds the wake-up Promise so /predict is never fired
  // before Render.com finishes its cold-start (~40 s on free tier).
  const serverReadyRef = useRef(null);

  // ─── Server wake-up ping ────────────────────────────────────────────────────
  // Pings every URL in AI_SERVER_URLS concurrently; the first to respond
  // becomes activeAIBaseUrlRef so /predict calls go there immediately.
  // The remaining URLs are silently probed so the fallback list stays warm.
  useEffect(() => {
    let cancelled = false;

    setAiStatus('⏳ Réveil du serveur IA...');

    serverReadyRef.current = (async () => {
      // Race all URLs — first healthy response wins.
      const pingUrl = (baseUrl) =>
        axios
          .get(`${baseUrl}/`, { timeout: 20000, headers: NGROK_HEADERS })
          .then(() => baseUrl);

      const results = await Promise.allSettled(AI_SERVER_URLS.map(pingUrl));

      if (cancelled) return;

      const firstSuccess = results.find((r) => r.status === 'fulfilled');

      if (firstSuccess) {
        activeAIBaseUrlRef.current = firstSuccess.value;
        console.log('✅ AI server ready:', firstSuccess.value);
        if (isMountedRef.current) setAiStatus('✅ Serveur prêt');
      } else {
        // All failed — keep the default URL and warn; /predict will retry anyway.
        const firstErr = results[0].reason;
        console.warn('⚠️ All AI wake-up attempts failed:', firstErr?.message);
        throw firstErr || new Error('No AI server reachable');
      }
    })().catch((err) => {
      if (isMountedRef.current) setAiStatus('⚠️ Serveur lent, tentative...');
      console.warn('⚠️ Server wake-up error:', err?.message);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────
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

  // Sync incoming call from parent after mount
  useEffect(() => {
    if (initialIncomingCall) {
      setIncomingCall(initialIncomingCall);
      incomingCallRef.current = initialIncomingCall;
      setCallStatusSynced('ringing');
      hasAcceptedCallRef.current = false;
      hasReceivedAnswerRef.current = false;
    }
  }, [initialIncomingCall, setCallStatusSynced]);

  // ─── MediaPipe cleanup ──────────────────────────────────────────────────────
  const cleanupHands = useCallback(() => {
    // FIX: detectionIntervalRef stores a setInterval ID — only call clearInterval,
    // never cancelAnimationFrame (wrong API, no-op, causes confusion).
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (handsRef.current) {
      try {
        handsRef.current.close();
      } catch (error) {
        console.warn('Error closing hands:', error);
      }
      handsRef.current = null;
    }

    // Reset processing lock so the next session starts clean
    isProcessingRef.current = false;
    setIsProcessing(false);
  }, []);

  // ─── Message helpers ─────────────────────────────────────────────────────────
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
      if (isSign) saveMessageToDB(text, isLocal);
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
        console.error('Error saving call event message:', error);
      }
    },
    [currentUser?._id, selectedUser?._id]
  );

  // ─── Chat send ───────────────────────────────────────────────────────────────
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

  // ─── Prediction ──────────────────────────────────────────────────────────────
  const sendPrediction = useCallback(
    async (landmarks) => {
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsProcessing(true);

      try {
        // FIX: wrap the server-ready await in its own try/catch so that a
        // rejected wake-up promise (timeout, network error) does NOT prevent
        // future predictions — we just attempt /predict anyway.
        try {
          if (serverReadyRef.current) await serverReadyRef.current;
        } catch (_) {
          // Server wake-up failed — attempt prediction regardless
        }

        if (!isMountedRef.current || !isAIActiveRef.current) return;

        const candidateUrls = [
          activeAIBaseUrlRef.current,
          ...AI_SERVER_URLS.filter((url) => url !== activeAIBaseUrlRef.current),
        ];

        let res = null;
        let lastError = null;

        for (const baseUrl of candidateUrls) {
          try {
            // Path: POST /predict — verified against server API contract.
            const attempt = await axios.post(
              `${baseUrl}/predict`,
              { landmarks },
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...NGROK_HEADERS,
                },
                timeout: 30000,
                // Only treat 2xx as success; surface 4xx/5xx as errors.
                validateStatus: (status) => status >= 200 && status < 300,
              }
            );
            res = attempt;
            activeAIBaseUrlRef.current = baseUrl;
            break;
          } catch (err) {
            lastError = err;
            console.warn(
              `⚠️ Predict failed on ${baseUrl} (status ${err.response?.status ?? 'network'}):`,
              err.message
            );
          }
        }

        if (!res) throw lastError || new Error('Prediction request failed');

        // Server may return { res: "word" } or { prediction: "word" } depending
        // on which backend is active — normalise both shapes here.
        const predictedWord =
          res.data?.res || res.data?.prediction || res.data?.result || null;

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
      } catch (err) {
        console.error('❌ Erreur API:', err.message);
      } finally {
        // FIX: always release the lock — whether success, empty result, or error.
        // The 300 ms debounce prevents hammering the server on every interval tick.
        setTimeout(() => {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }, 300);
      }
    },
    [addChatMessage, currentUser?._id, selectedUser?._id]
  );

  // ─── MediaPipe init ──────────────────────────────────────────────────────────
  const initHandDetection = useCallback(async () => {
    if (!localVideoRef.current || !isMountedRef.current) {
      setAiStatus('En attente de la caméra...');
      return;
    }

    // Wait until the video element has real dimensions before sending frames.
    // A zero-size frame causes a fatal WASM abort inside MediaPipe.
    const video = localVideoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setAiStatus('En attente de la vidéo...');

      await new Promise((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) return resolve();

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          clearInterval(poll);
          resolve();
        };

        video.addEventListener('playing', done, { once: true });

        const poll = setInterval(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) done();
        }, 100);

        // Hard timeout: 8 s
        setTimeout(done, 8000);
      });
    }

    // Double-check — bail out if still zero after waiting
    if (
      !localVideoRef.current ||
      localVideoRef.current.videoWidth === 0 ||
      localVideoRef.current.videoHeight === 0
    ) {
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
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      setAiStatus('Chargement du modèle...');
      await hands.initialize();

      if (!isMountedRef.current) return;

      // Register onResults AFTER initialize() — binding it before the model
      // loads means it may reference an uninitialised graph and never fire.
      hands.onResults((results) => {
        if (!isMountedRef.current || !isAIActiveRef.current) return;

        const firstHand = results.multiHandLandmarks?.[0];
        const hasHands = Boolean(firstHand);

        if (hasHands) {
          setAiStatus('🖐️ Main détectée...');

          const dataAux = [];

          firstHand.forEach((lm) => {
            dataAux.push(lm.x);
            dataAux.push(lm.y);
          });

          if (dataAux.length === 42 && !isProcessingRef.current) {
            sendPrediction(dataAux);
          }
        } else {
          setAiStatus('🤟 En attente de geste...');
        }
      });

      // ── FIX (root cause of the bug): pass the canvas element directly to
      // hands.send() — NOT an ImageData object.
      //
      // MediaPipe Hands v0.4 (the jsdelivr CDN version) accepts:
      //   HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
      //
      // When an ImageData is passed, MediaPipe silently accepts the call but
      // its internal graph never invokes onResults — so no predictions fire.
      // This is why the Network tab showed zero /predict requests even though
      // the WASM model loaded successfully.
      //
      // Solution: draw the video frame onto a canvas and pass the canvas.
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
          const vid = localVideoRef.current;

          if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
            if (canvas.width !== vid.videoWidth) canvas.width = vid.videoWidth;
            if (canvas.height !== vid.videoHeight) canvas.height = vid.videoHeight;

            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

            // FIX: pass the canvas, not ImageData
            await handsRef.current.send({ image: canvas });
          }
        } catch (error) {
          console.error('[MP] send() error:', error);
        }
      }, 500);

      detectionIntervalRef.current = detectionInterval;
      setAiStatus('✅ Prêt - Faites des gestes!');
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      setAiStatus("❌ Erreur d'initialisation");
    }
  }, [cleanupHands, sendPrediction]);

  // ─── Toggle AI ───────────────────────────────────────────────────────────────
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

  // ─── Call cleanup ────────────────────────────────────────────────────────────
  const cleanupCall = useCallback(
    ({ emitEndCall = true, closeModal = true } = {}) => {
      if (isCleaningUpRef.current) return;
      isCleaningUpRef.current = true;

      hasAcceptedCallRef.current = false;
      hasReceivedAnswerRef.current = false;

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

      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      setIncomingCall(null);
      incomingCallRef.current = null;
      setLocalPrediction('');
      setRemotePrediction('');
      lastPredictionRef.current = '';
      lastPredictionTimeRef.current = 0;
      setCallStatusSynced('idle');

      if (wasConnected && !hasLoggedEndedRef.current) {
        hasLoggedEndedRef.current = true;
        persistCallEventMessage('📴 Video call ended');
      }

      if (emitEndCall && currentUser?._id) {
        const targetUserId =
          selectedUser?._id ||
          incomingCallRef.current?.fromUserId ||
          incomingCallRef.current?.toUserId;

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
  // without needing it as a dependency (which would cause re-runs).
  cleanupCallRef.current = cleanupCall;

  const endCall = useCallback(() => {
    cleanupCall({ emitEndCall: true, closeModal: true });
  }, [cleanupCall]);

  // ─── Media setup ─────────────────────────────────────────────────────────────
  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
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

  // ─── Start call ──────────────────────────────────────────────────────────────
  const startCall = async () => {
    if (!currentUser?._id || !selectedUser?._id) {
      toast.error('Utilisateur invalide');
      return;
    }

    // Check that the users share a conversation (proxy for "friends")
    try {
      const token = localStorage.getItem('token');
      const auth = token?.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const convRes = await axios.get('https://backpfe-production-789f.up.railway.app/api/messages/conversations', {
        headers: { Authorization: auth },
        params: { _t: Date.now() },
      });
      const conversations = Array.isArray(convRes.data) ? convRes.data : [];
      const hasConversation = conversations.some(
        (c) => String(c.participant?._id) === String(selectedUser._id)
      );
      if (!hasConversation) {
        toast.error('Vous ne pouvez appeler que des utilisateurs avec qui vous avez déjà discuté');
        return;
      }
    } catch {
      toast.error('Impossible de vérifier la conversation');
      return;
    }

    hasAcceptedCallRef.current = false;
    hasReceivedAnswerRef.current = false;
    hasLoggedEndedRef.current = false;
    isCleaningUpRef.current = false;

    setCallStatusSynced('calling');

    try {
      const stream = await setupMedia();

      // FIX: start hand detection as soon as local media is available —
      // detection should not wait for the remote peer to connect.
      // isAIActiveRef controls whether frames are actually processed.
      initHandDetection();

      const peer = new Peer({ initiator: true, trickle: false, stream });

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

  // ─── Accept call ─────────────────────────────────────────────────────────────
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

      // FIX: start hand detection as soon as local media is available —
      // detection should not wait for the remote peer to connect.
      initHandDetection();

      const peer = new Peer({ initiator: false, trickle: false, stream });

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

        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallStatusSynced('connected');

        if (!hasLoggedConnectedRef.current) {
          hasLoggedConnectedRef.current = true;
          persistCallEventMessage('📞 Video call connected');
        }

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
      peer.signal(incomingCall.signal);
    } catch (error) {
      console.error('Error accepting call:', error);
      hasAcceptedCallRef.current = false;
      toast.error("Impossible d'accepter l'appel");
      cleanupCall({ emitEndCall: true, closeModal: true });
    }
  };

  // ─── Socket listeners ────────────────────────────────────────────────────────
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

  // ─── Mount / unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cleanupCallRef.current?.({ emitEndCall: false, closeModal: false });
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet title="Video Call - MediSign" />
      <div className="video-call-overlay">
        <div className="video-call-layout">
        {/* ── Chat panel ── */}
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
                      {isAIActive ? '🟢 Traduction active' : '⚪ Traduction désactivée'}
                    </p>
                    <p style={{ fontSize: '0.65rem', marginTop: '5px', color: '#888' }}>
                      {aiStatus}
                    </p>
                  </div>
                )}

                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`call-chat-msg ${msg.isLocal ? 'local' : 'remote'}`}
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

        {/* ── Video panel ── */}
        <div className="video-call-container">
          <div className="video-grid">
            {/* Remote video (large) */}
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

            {/* Local video (small) */}
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
                {isAIActive ? '🔴 Désactiver Traduction' : '🟢 Activer Traduction'}
              </button>
            </div>
          </div>

          {/* Controls */}
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
    </>
  );
};

export default VideoCall;
