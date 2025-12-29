import { useEffect, useRef } from "react";
import useChatbot from "../../hooks/useChatbot";
import * as api from "../../lib/api";

/**
 * SpeechManager - Optimized TTS with male/female voice support.
 * Uses chunked playback with early start for faster audio response.
 */
export const SpeechManager = () => {
    const streamingText = useChatbot((state) => state.streamingText);
    const status = useChatbot((state) => state.status);
    const setIsSpeaking = useChatbot((state) => state.setIsSpeaking);
    const currentAvatar = useChatbot((state) => state.currentAvatar); // 'male' or 'female'

    const lastLenRef = useRef(0);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const bufferRef = useRef("");

    // Smaller chunks for faster first audio
    const MIN_CHUNK_SIZE = 15;
    const BREAK_PATTERN = /[.!?,;:\n]/;
    const hasPlayedFirstRef = useRef(false);

    useEffect(() => {
        if (status === "streaming" && streamingText.length > lastLenRef.current) {
            const newText = streamingText.slice(lastLenRef.current);
            bufferRef.current += newText;
            lastLenRef.current = streamingText.length;
            tryExtractChunk();
        }

        if (status !== "streaming") {
            if (status === "complete" && bufferRef.current.trim()) {
                queueChunk(bufferRef.current.trim());
                bufferRef.current = "";
            }
            lastLenRef.current = 0;
            hasPlayedFirstRef.current = false;
        }
    }, [streamingText, status]);

    const tryExtractChunk = () => {
        const buffer = bufferRef.current;
        let breakIndex = -1;

        for (let i = MIN_CHUNK_SIZE; i < buffer.length; i++) {
            if (BREAK_PATTERN.test(buffer[i])) {
                breakIndex = i + 1;
                break; // Take first break after MIN_CHUNK_SIZE
            }
        }

        if (breakIndex > 0) {
            const chunk = buffer.slice(0, breakIndex).trim();
            bufferRef.current = buffer.slice(breakIndex).trim();
            if (chunk) queueChunk(chunk);
        } else if (buffer.length > 100) {
            const chunk = buffer.slice(0, 80).trim();
            bufferRef.current = buffer.slice(80);
            if (chunk) queueChunk(chunk);
        }
    };

    const queueChunk = (text) => {
        if (!text || text.length < 5) return;
        audioQueueRef.current.push({ text, audio: null, fetching: false });
        prefetchNext();
        if (!isPlayingRef.current) processQueue();
    };

    const prefetchNext = () => {
        const item = audioQueueRef.current.find(i => !i.audio && !i.fetching);
        if (!item) return;

        item.fetching = true;
        fetchAudio(item.text).then(audio => {
            item.audio = audio;
            item.fetching = false;
            prefetchNext();
        }).catch(() => {
            item.fetching = false;
        });
    };

    const fetchAudio = async (text) => {
        // Pass gender for voice selection
        const reader = await api.generateSpeech(text, currentAvatar);
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        if (chunks.length === 0 || chunks.every(c => c.length === 0)) {
            return null; // No audio data
        }
        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
    };

    const processQueue = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsSpeaking(false);
            return;
        }

        isPlayingRef.current = true;
        setIsSpeaking(true);

        const item = audioQueueRef.current[0];

        try {
            if (!item.audio) {
                if (!item.fetching) {
                    item.fetching = true;
                    item.audio = await fetchAudio(item.text);
                } else {
                    while (!item.audio && item.fetching) {
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }

            if (!item.audio) {
                audioQueueRef.current.shift();
                processQueue();
                return;
            }

            const audio = new Audio(item.audio);
            audio.onended = () => {
                URL.revokeObjectURL(item.audio);
                audioQueueRef.current.shift();
                processQueue();
            };
            audio.onerror = () => {
                console.error("Audio playback error");
                audioQueueRef.current.shift();
                processQueue();
            };
            await audio.play();
        } catch (e) {
            console.error("TTS playback failed", e);
            audioQueueRef.current.shift();
            processQueue();
        }
    };

    useEffect(() => {
        if (status === "loading") {
            audioQueueRef.current.forEach(item => {
                if (item.audio) URL.revokeObjectURL(item.audio);
            });
            audioQueueRef.current = [];
            bufferRef.current = "";
            isPlayingRef.current = false;
            setIsSpeaking(false);
        }
    }, [status, setIsSpeaking]);

    return null;
};

export default SpeechManager;
