import { create } from "zustand";
import * as api from "../lib/api";

const ERROR_MESSAGES = [
  {
    text: "Hi there! I’m looking forward to chatting, but I need a little setup first. Please clone this project and add your API keys to get me running!",
    male: "/audios/male/male-no-backend-1.wav",
    female: "/audios/female/female-no-backend-1.wav",
  },
  {
    text: "Hello! I'm just a shell right now. If you want to see how I really work, grab the code from the repo and plug in your keys.",
    male: "/audios/male/male-no-backend-2.wav",
    female: "/audios/female/female-no-backend-2.wav",
  },
  {
    text: "Oops! It looks like I'm missing my brain. Please clone the repository and set up your environment variables to wake me up.",
    male: "/audios/male/male-no-backend-3.wav",
    female: "/audios/female/female-no-backend-3.wav",
  },
];

const useChatbot = create((set, get) => ({
  messages: [],
  loading: false,
  cameraZoomed: false,
  status: "idle", // idle, loading, detection, ocr, nlp, streaming, complete, error
  progress: null, // { step, image, totalImages }
  streamingText: "",
  currentAvatar: "male", // 'male' or 'female'
  currentAnimation: "Idle",
  animationRunId: 0,

  // Model selection
  currentModel: "local", // "local" | "gpt4o"
  setModel: (model) => set({ currentModel: model }),

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
      currentModel: "local", // Optional: reset or keep
    });
  },

  getVoiceGender: () => get().currentAvatar, // Returns 'male' or 'female' for TTS

  setAnimation: (name) => set((state) => ({
    currentAnimation: name,
    animationRunId: state.animationRunId + 1
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
   */
  sendMessage: async (message, files = [], conversationId) => {
    let activeId = conversationId;

    if (!activeId) {
      console.error("No conversation ID provided");
      return;
    }

    // Stop any existing audio/error messages
    const { currentAudio } = get();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      set({ currentAudio: null, isSpeaking: false });
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
        // Use analyze endpoint for image analysis (YOLO + OCR + Groq/GPT4o)
        abort = api.analyzeStream(
          activeId,
          message || null,
          handleAnalyzeEvent(set, get),
          handleError(set, get),
          () => { },
          get().currentModel // Pass selected model
        );
      } else {
        // Use chat endpoint for text-only conversation
        set({ status: "streaming" });
        abort = api.chatStream(
          activeId,
          message,
          handleChatEvent(set, get),
          handleError(set, get),
          () => { }
        );
      }

      set({ abortController: { abort } });

    } catch (error) {
      console.error("Error in sendMessage:", error);
      get().playErrorResponse();
      set({ loading: false, status: "error" });
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

  // Track the actual Audio object so we can stop it
  currentAudio: null,
  currentLipsync: null,

  resetAudio: () => {
    const { currentAudio } = get();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    set({ currentAudio: null, currentLipsync: null, isSpeaking: false });
  },

  playErrorResponse: () => {
    const { currentAvatar, currentAudio } = get();

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const errorMsg = ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
    const audioSrc = currentAvatar === "female" ? errorMsg.female : errorMsg.male;

    // Add message to chat
    set((state) => ({
      messages: [
        ...state.messages,
        {
          text: errorMsg.text,
          sender: "bot",
        },
      ],
    }));

    // Play audio and set speaking state
    const audio = new Audio(audioSrc);

    // Save the audio object to state
    set({ currentAudio: audio, isSpeaking: true });

    audio.onended = () => {
      // Only update if this is still the current audio
      if (get().currentAudio === audio) {
        set({ isSpeaking: false, currentAudio: null });
      }
    };

    audio.play().catch((e) => {
      console.error("Failed to play error audio:", e);
      if (get().currentAudio === audio) {
        set({ isSpeaking: false, currentAudio: null });
      }
    });
  },
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
        get().playErrorResponse();
        set({
          loading: false,
          status: "error",
          streamingText: "",
          progress: null,
        });
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
        get().playErrorResponse();
        set({
          loading: false,
          status: "error",
          streamingText: "",
        });
        break;
    }
  };
}

// Common error handler
function handleError(set, get) {
  return (error) => {
    console.error("Stream error:", error);
    get().playErrorResponse();
    set({ loading: false, status: "error" });
  };
}

export default useChatbot;