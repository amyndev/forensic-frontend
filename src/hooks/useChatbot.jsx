import { create } from "zustand";
import * as api from "../lib/api";

const useChatbot = create((set, get) => ({
  messages: [],
  loading: false,
  cameraZoomed: false,
  status: "idle", // idle, loading, detection, ocr, nlp, streaming, complete, error
  progress: null, // { step, image, totalImages }
  streamingText: "",
  isPremiumMode: false,
  currentAvatar: "male", // 'male' or 'female'
  currentAnimation: "Idle",
  animationRunId: 0,

  setAvatar: (avatar) => {
    const { abortController } = get();
    // Stop any ongoing streaming
    if (abortController?.abort) {
      abortController.abort();
    }
    set({
      currentAvatar: avatar,
      loading: false,
      status: "idle",
      streamingText: "",
      currentAudio: null,
      currentLipsync: null,
      abortController: null,
    });
  },
  getVoiceGender: () => get().currentAvatar, // Returns 'male' or 'female' for TTS
  setAnimation: (name) => set((state) => ({
    currentAnimation: name,
    animationRunId: state.animationRunId + 1
  })),

  togglePremiumMode: () => set((state) => ({
    isPremiumMode: !state.isPremiumMode
    // NOTE: We no longer clear messages when toggling modes
    // This preserves conversation history across Basic/Premium switches
  })),

  setCameraZoomed: (zoomed) => set({ cameraZoomed: zoomed }),
  setStatus: (status) => set({ status }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),

  onMessagePlayed: () => {
    set({ loading: false, status: "idle" });
  },

  // Set messages (used when loading from backend)
  setMessages: (messages) => set({ messages }),

  // Add a single message
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  /**
   * Send a message with optional files
   * @param {string} message - The user's message
   * @param {File[]} files - Files to upload
   * @param {string} conversationId - The conversation ID
   */
  sendMessage: async (message, files = [], conversationId) => {
    let activeId = conversationId;
    const isPremiumMode = get().isPremiumMode;

    if (!activeId) {
      console.error("No conversation ID provided");
      return;
    }

    set({ loading: true, status: "loading", streamingText: "", progress: null });

    // Create object URLs for immediate display
    const fileUrls = files.map(file => URL.createObjectURL(file));

    // Add user message to local state immediately
    const userMessage = {
      text: message || "Analyze this evidence",
      sender: "user",
      files: files.map(f => f.name),
      images: fileUrls // Store URLs for rendering
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
    }));

    // Sync to useCases store for sidebar message counter
    import("./useCases").then(mod => {
      mod.default.getState().addMessageToCase(activeId, userMessage);
    });

    // --- Common logic for both modes: create conversation if temp ID ---
    try {
      // If temporary ID, create real case first
      if (typeof activeId === 'string' && activeId.startsWith('temp-')) {
        try {
          const useCases = (await import("./useCases")).default;
          const { replaceTempCase, cases } = useCases.getState();

          const tempCase = cases.find(c => c.id === activeId);
          const caseName = tempCase ? tempCase.name : "New Case";

          const conversation = await api.createConversation(caseName);
          const realId = conversation.id;

          // Replace in useCases store
          replaceTempCase(activeId, realId, conversation);

          activeId = realId;
        } catch (error) {
          console.error("Failed to create real conversation:", error);
          throw new Error("Failed to initialize case conversation");
        }
      }

      // Upload files first (if any)
      const uploadedImages = [];
      for (const file of files) {
        try {
          const result = await api.uploadImage(activeId, file);
          uploadedImages.push(result.image);
        } catch (error) {
          console.error("Failed to upload file:", file.name, error);
        }
      }

      let abort;

      // Choose endpoint based on whether we have images
      if (uploadedImages.length > 0) {
        // Use analyze endpoint for image analysis
        // Basic mode: YOLO + OCR + OpenAI LLM (useBasicPipeline=true)
        // Premium mode: GPT-4o Vision (useBasicPipeline=false)
        abort = api.analyzeStream(
          activeId,
          message || null,
          handleAnalyzeEvent(set, get),
          handleError(set),
          () => { },
          !isPremiumMode // useBasicPipeline: true for basic, false for premium
        );
      } else {
        // Use chat endpoint for text-only conversation
        // Both modes use OpenAI for text chat
        set({ status: "streaming" });
        abort = api.chatStream(
          activeId,
          message,
          handleChatEvent(set, get),
          handleError(set),
          () => { },
          !isPremiumMode // use_groq: true for basic (Groq), false for premium (OpenAI/GPT-4o)
        );
      }

      set({ abortController: { abort } });

    } catch (error) {
      console.error("Error in sendMessage:", error);
      set({ loading: false, status: "error" });
      set((state) => ({
        messages: [...state.messages, {
          text: "Sorry, something went wrong. Please try again.",
          sender: "bot"
        }],
      }));
    }
  },

  // Stop the current analysis
  stopAnalysis: () => {
    const { abortController } = get();
    if (abortController?.abort) {
      abortController.abort();
    }
    set({
      loading: false,
      status: "idle",
      abortController: null,
      streamingText: "",
      progress: null,
    });
  },

  currentAudio: null,
  currentLipsync: null,
  resetAudio: () => set({ currentAudio: null, currentLipsync: null }),
}));

// Event handler for analyze endpoint (with images)
function handleAnalyzeEvent(set, get) {
  return async (event) => {
    const data = event.data;

    switch (event.event) {
      case "start":
        set({
          status: "detection",
          progress: { step: "detection", totalImages: data.total_images }
        });
        break;

      case "progress":
        set({
          status: data.step,
          progress: {
            step: data.step,
            image: data.image,
            totalImages: data.total_images,
          },
        });
        break;

      case "text":
        set((state) => ({
          status: "streaming",
          streamingText: state.streamingText + (data.text || ""),
        }));
        break;

      case "complete":
        const finalText = data.hypothesis || get().streamingText;
        const analyzeMessage = {
          text: finalText,
          sender: "bot",
          id: data.message_id,
        };
        set((state) => ({
          messages: [...state.messages, analyzeMessage],
          loading: false,
          status: "complete",
          streamingText: "",
          progress: null,
        }));
        // Sync bot message to useCases store
        import("./useCases").then(mod => {
          const activeCase = mod.default.getState().activeCase;
          if (activeCase) {
            mod.default.getState().addMessageToCase(activeCase, analyzeMessage);
          }
        });
        break;

      case "error":
        console.error("Analysis error:", data.error);
        set({
          loading: false,
          status: "error",
          streamingText: "",
          progress: null,
        });
        set((state) => ({
          messages: [...state.messages, {
            text: `Error: ${data.error}`,
            sender: "bot"
          }],
        }));
        break;
    }
  };
}

// Event handler for chat endpoint (text only)
function handleChatEvent(set, get) {
  return async (event) => {
    const data = event.data;

    switch (event.event) {
      case "start":
        set({ status: "streaming" });
        break;

      case "token":
        set((state) => ({
          status: "streaming",
          streamingText: state.streamingText + (data.text || ""),
        }));
        break;

      case "complete":
        const finalText = data.content || get().streamingText;
        const botMessage = {
          text: finalText,
          sender: "bot",
          id: data.message_id,
        };
        set((state) => ({
          messages: [...state.messages, botMessage],
          loading: false,
          status: "complete",
          streamingText: "",
          progress: null,
        }));
        // Sync bot message to useCases store
        import("./useCases").then(mod => {
          const activeCase = mod.default.getState().activeCase;
          if (activeCase) {
            mod.default.getState().addMessageToCase(activeCase, botMessage);
          }
        });
        break;

      case "error":
        console.error("Chat error:", data.error);
        set({
          loading: false,
          status: "error",
          streamingText: "",
        });
        set((state) => ({
          messages: [...state.messages, {
            text: `Error: ${data.error}`,
            sender: "bot"
          }],
        }));
        break;
    }
  };
}

// Common error handler
function handleError(set) {
  return (error) => {
    console.error("Stream error:", error);
    set({ loading: false, status: "error" });
    set((state) => ({
      messages: [...state.messages, {
        text: "Sorry, I encountered an error. Please try again.",
        sender: "bot"
      }],
    }));
  };
}

export default useChatbot;