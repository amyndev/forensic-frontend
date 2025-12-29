import { useCallback, useEffect, useRef, useState } from 'react'

// How long to wait before considering stream "paused" (ms)
const STREAM_PAUSE_THRESHOLD = 250

export function useTextToSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isReady, setIsReady] = useState(false)
    const [availableVoices, setAvailableVoices] = useState([])
    const utteranceRef = useRef(null)
    const pendingTextRef = useRef('')
    const isProcessingRef = useRef(false)
    const lastTokenTimeRef = useRef(0)
    const streamActiveRef = useRef(false)

    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            if (voices.length > 0) {
                setAvailableVoices(voices)
                setIsReady(true)
            }
        }
        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
        return () => { window.speechSynthesis.onvoiceschanged = null }
    }, [])

    const getBestVoice = useCallback(() => {
        if (availableVoices.length === 0) return null;

        // 1. Tier 1: Specific High-Quality Detective Voices
        // 'Daniel' (Mac - very detective-like), 'Google US English' (Chrome - standard), 'Microsoft David' (Win)
        const preferredNames = ['Daniel', 'Google US English', 'Microsoft David', 'Samantha'];
        for (const name of preferredNames) {
            const voice = availableVoices.find(v => v.name.includes(name));
            if (voice) return voice;
        }

        // 2. Tier 2: Any English Male Voice (To avoid random female voices)
        // Most browsers include "Male" in the voice name string
        const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
        const maleVoice = englishVoices.find(v =>
            v.name.toLowerCase().includes('male') ||
            v.name.toLowerCase().includes('guy')
        );
        if (maleVoice) return maleVoice;

        // 3. Fallback: Any English voice
        return englishVoices[0] || availableVoices[0];
    }, [availableVoices]);

    const cleanTextForSpeech = useCallback((text) => {
        return text
            .replace(/[*#@$%^&()_+=\[\]{}|\\<>\/~`"]/g, '')
            .replace(/[-_]{2,}/g, ' ')
            .replace(/\*\*/g, '').replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim()
    }, [])

    const isStreamActive = useCallback(() => {
        if (!streamActiveRef.current) return false
        return Date.now() - lastTokenTimeRef.current < STREAM_PAUSE_THRESHOLD
    }, [])

    const processText = useCallback(() => {
        if (isProcessingRef.current || !pendingTextRef.current.trim()) return
        const text = pendingTextRef.current
        const sentenceMatch = text.match(/^(.*?[.!?])\s*/s)
        if (!sentenceMatch) return

        const rawSentence = sentenceMatch[1].trim()
        pendingTextRef.current = text.slice(sentenceMatch[0].length)
        const sentence = cleanTextForSpeech(rawSentence)
        if (!sentence) { if (pendingTextRef.current) processText(); return }

        isProcessingRef.current = true
        setIsSpeaking(true)

        const utterance = new SpeechSynthesisUtterance(sentence)
        const voice = getBestVoice()
        if (voice) utterance.voice = voice
        utterance.rate = 1.0  // Detectives usually speak calmly
        utterance.pitch = 1.0

        utterance.onend = () => {
            isProcessingRef.current = false
            if (pendingTextRef.current.trim() && isStreamActive()) {
                setTimeout(processText, 50)
            } else {
                setIsSpeaking(false)
            }
        }
        utterance.onerror = () => {
            isProcessingRef.current = false
            setIsSpeaking(false)
        }

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }, [getBestVoice, cleanTextForSpeech, isStreamActive])

    const speakToken = useCallback((token) => {
        pendingTextRef.current += token
        lastTokenTimeRef.current = Date.now()
        streamActiveRef.current = true
        if (!isProcessingRef.current && pendingTextRef.current.match(/[.!?]\s*$/)) {
            processText()
        }
    }, [processText])

    const stop = useCallback(() => {
        window.speechSynthesis.cancel()
        pendingTextRef.current = ''
        isProcessingRef.current = false
        streamActiveRef.current = false
        setIsSpeaking(false)
    }, [])

    const flush = useCallback(() => {
        streamActiveRef.current = true
        lastTokenTimeRef.current = Date.now()
        if (pendingTextRef.current.trim() && !pendingTextRef.current.match(/[.!?]\s*$/)) {
            pendingTextRef.current += '.'
        }
        if (!isProcessingRef.current) processText()
    }, [processText])

    return { speakToken, stop, flush, isSpeaking, isReady }
}
