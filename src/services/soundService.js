// services/soundService.js
// Uses Web Audio API - no external files needed, all sounds generated programmatically

class SoundService {
    constructor() {
        this.audioContext = null;
        this.ringtoneInterval = null;
        this.isRinging = false;
        this.isMuted = false;
        this.volume = 1.0;
    }

    // ✅ Lazy init AudioContext (browsers require user interaction first)
    getContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended (autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (muted) this.stopRingtone();
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    // ─── Internal helpers ───────────────────────────────────────────────────

    _playTone({ frequency, type = 'sine', duration, gainStart = 0.3, gainEnd = 0, startTime = 0, detune = 0 }) {
        const ctx = this.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
        if (detune) osc.detune.setValueAtTime(detune, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(gainStart * this.volume, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(0.001, gainEnd * this.volume),
            ctx.currentTime + startTime + duration
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    }

    _playNoise({ duration, gainValue = 0.05, startTime = 0, filterFreq = 1000 }) {
        const ctx = this.getContext();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainValue * this.volume, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(ctx.currentTime + startTime);
    }

    // ─── Message Sounds ──────────────────────────────────────────────────────

    // Soft "pop" for incoming message
    playMessageReceived() {
        if (this.isMuted) return;
        try {
            // Two-tone soft notification
            this._playTone({ frequency: 880, type: 'sine', duration: 0.08, gainStart: 0.25, gainEnd: 0.1 });
            this._playTone({ frequency: 1100, type: 'sine', duration: 0.12, gainStart: 0.2, gainEnd: 0.001, startTime: 0.07 });
        } catch (e) { console.warn('Sound error:', e); }
    }

    // Subtle "whoosh" for sent message
    playMessageSent() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.15 * this.volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) { console.warn('Sound error:', e); }
    }

    // ─── Video Call Sounds ───────────────────────────────────────────────────

    // Classic phone ringtone pattern (repeating)
    _ringOnce() {
        try {
            const ctx = this.getContext();
            // Two beeps then pause = classic ring pattern
            const beepDuration = 0.15;
            const beepGap = 0.1;
            const freq = 440;

            for (let i = 0; i < 2; i++) {
                const t = i * (beepDuration + beepGap);
                this._playTone({ frequency: freq, type: 'sine', duration: beepDuration, gainStart: 0.4, gainEnd: 0.001, startTime: t });
                this._playTone({ frequency: freq * 1.25, type: 'sine', duration: beepDuration, gainStart: 0.2, gainEnd: 0.001, startTime: t + 0.01 });
            }
        } catch (e) { console.warn('Sound error:', e); }
    }

    startRingtone() {
        if (this.isMuted || this.isRinging) return;
        this.isRinging = true;
        this._ringOnce();
        this.ringtoneInterval = setInterval(() => {
            if (this.isRinging) this._ringOnce();
        }, 2000); // ring every 2 seconds
    }

    stopRingtone() {
        this.isRinging = false;
        if (this.ringtoneInterval) {
            clearInterval(this.ringtoneInterval);
            this.ringtoneInterval = null;
        }
    }

    // Outgoing call dial tone
    playDialTone() {
        if (this.isMuted) return;
        try {
            // DTMF-style dual tone
            this._playTone({ frequency: 350, type: 'sine', duration: 0.4, gainStart: 0.15, gainEnd: 0.12 });
            this._playTone({ frequency: 440, type: 'sine', duration: 0.4, gainStart: 0.15, gainEnd: 0.12 });
        } catch (e) { console.warn('Sound error:', e); }
    }

    // Call connected chime
    playCallConnected() {
        if (this.isMuted) return;
        try {
            // Rising happy chord
            this._playTone({ frequency: 523, type: 'sine', duration: 0.2, gainStart: 0.3, gainEnd: 0.001, startTime: 0 });
            this._playTone({ frequency: 659, type: 'sine', duration: 0.2, gainStart: 0.3, gainEnd: 0.001, startTime: 0.1 });
            this._playTone({ frequency: 784, type: 'sine', duration: 0.3, gainStart: 0.3, gainEnd: 0.001, startTime: 0.2 });
        } catch (e) { console.warn('Sound error:', e); }
    }

    // Call ended - descending tone
    playCallEnded() {
        if (this.isMuted) return;
        try {
            this._playTone({ frequency: 480, type: 'sine', duration: 0.15, gainStart: 0.3, gainEnd: 0.001, startTime: 0 });
            this._playTone({ frequency: 380, type: 'sine', duration: 0.15, gainStart: 0.3, gainEnd: 0.001, startTime: 0.12 });
            this._playTone({ frequency: 280, type: 'sine', duration: 0.2, gainStart: 0.25, gainEnd: 0.001, startTime: 0.24 });
        } catch (e) { console.warn('Sound error:', e); }
    }

    // Call rejected - short negative tone
    playCallRejected() {
        if (this.isMuted) return;
        try {
            this._playTone({ frequency: 440, type: 'sawtooth', duration: 0.1, gainStart: 0.2, gainEnd: 0.001, startTime: 0 });
            this._playTone({ frequency: 330, type: 'sawtooth', duration: 0.15, gainStart: 0.2, gainEnd: 0.001, startTime: 0.12 });
        } catch (e) { console.warn('Sound error:', e); }
    }
}

export default new SoundService();
