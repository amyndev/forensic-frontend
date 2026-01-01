/**
 * API service layer for backend communication
 */

const API_BASE = '/api/v1';

// ==================== Conversations ====================

export async function createConversation(name, description = null) {
    const response = await fetch(`${API_BASE}/conversations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error('Failed to create conversation');
    return response.json();
}

export async function getConversations() {
    const response = await fetch(`${API_BASE}/conversations/`);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
}

export async function getConversation(id) {
    const response = await fetch(`${API_BASE}/conversations/${id}`);
    if (!response.ok) throw new Error('Failed to fetch conversation');
    return response.json();
}

export async function updateConversation(id, data) {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update conversation');
    return response.json();
}

export async function deleteConversation(id) {
    const response = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
    if (response.status === 404) return; // Already deleted, consider success
    if (!response.ok) throw new Error('Failed to delete conversation');
}

// ==================== Messages ====================

export async function getMessages(conversationId) {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
}

// ==================== Image Upload ====================

export async function uploadImage(conversationId, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversation_id', conversationId);

    const response = await fetch(`${API_BASE}/upload/`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload image');
    return response.json();
}

export async function deleteImage(imageId) {
    const response = await fetch(`${API_BASE}/upload/${imageId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete image');
}

// ==================== Text-to-Speech ====================

export async function generateSpeech(text, voice = 'male') {
    const response = await fetch(`${API_BASE}/tts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
    });
    if (!response.ok) throw new Error('Failed to generate speech');

    // Return the stream reader for real-time playback
    return response.body.getReader();
}

// ==================== Analysis Streaming ====================

/**
 * Start an analysis stream for the given conversation.
 * Uses unified pipeline: YOLO + OCR + Groq LLM
 * 
 * @param {string} conversationId - The conversation ID
 * @param {string|null} context - Optional user context/message
 * @param {function} onEvent - Callback for each SSE event
 * @param {function} onError - Callback for errors
 * @param {function} onComplete - Callback when stream ends
 * @returns {function} Abort function to cancel the stream
 */
export function analyzeStream(
    conversationId,
    context = null,
    onEvent = () => { },
    onError = () => { },
    onComplete = () => { },
    model = "local"
) {
    const url = `${API_BASE}/analyze/stream`;

    const body = JSON.stringify({
        conversation_id: conversationId,
        context: context || null,
        model
    });

    const controller = new AbortController();

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error('Failed to start analysis');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();

                    if (trimmedLine.startsWith('event:')) {
                        currentEvent = trimmedLine.slice(6).trim();
                    } else if (trimmedLine.startsWith('data:')) {
                        try {
                            const jsonStr = trimmedLine.slice(5).trim();
                            if (jsonStr) {
                                const data = JSON.parse(jsonStr);
                                onEvent({ event: currentEvent || 'message', data });
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                        currentEvent = ''; // Reset after processing data
                    }
                }
            }

            onComplete();
        })
        .catch((error) => {
            if (error.name !== 'AbortError') {
                onError(error);
            }
        });

    return () => controller.abort();
}

// ==================== Chat Streaming (text only, no images) ====================

/**
 * Start a chat stream for text-only conversation (no image analysis).
 * Uses Groq LLM for responses.
 * 
 * @param {string} conversationId - The conversation ID
 * @param {string} message - The user message
 * @param {function} onEvent - Callback for each SSE event
 * @param {function} onError - Callback for errors
 * @param {function} onComplete - Callback when stream ends
 * @returns {function} Abort function to cancel the stream
 */
export function chatStream(
    conversation_id,
    message,
    onEvent = () => { },
    onError = () => { },
    onComplete = () => { }
) {
    const url = `${API_BASE}/conversations/${conversation_id}/chat/stream`;

    const body = JSON.stringify({ message });

    const controller = new AbortController();

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error('Failed to start chat');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();

                    if (trimmedLine.startsWith('event:')) {
                        currentEvent = trimmedLine.slice(6).trim();
                    } else if (trimmedLine.startsWith('data:')) {
                        try {
                            const jsonStr = trimmedLine.slice(5).trim();
                            if (jsonStr) {
                                const data = JSON.parse(jsonStr);
                                onEvent({ event: currentEvent || 'message', data });
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                        currentEvent = '';
                    }
                }
            }

            onComplete();
        })
        .catch((error) => {
            if (error.name !== 'AbortError') {
                onError(error);
            }
        });

    return () => controller.abort();
}
