import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as api from "../lib/api";

const useCases = create(
    persist(
        (set, get) => ({
            cases: [],
            activeCase: null,
            loading: false,
            initialized: false,
            _caseCounter: 0, // Track the highest case number created

            // Initialize case from URL - called when navigating to /case/:caseId
            initializeCaseFromUrl: (caseId) => {
                const { cases } = get();
                const existingCase = cases.find((c) => c.id === caseId);

                if (existingCase) {
                    // Case exists in storage - just set it as active
                    set({ activeCase: caseId });
                } else {
                    // New case from URL - set as active but don't create in store yet
                    // The case will be created when the user sends first message
                    set({ activeCase: caseId });
                }
            },

            // Ensure case exists in store AND backend (called before first message)
            // Returns the real conversation ID (from backend)
            ensureCaseExists: async (caseId = null) => {
                const { cases, _caseCounter } = get();

                // If caseId provided and exists, just set as active
                if (caseId) {
                    const existingCase = cases.find((c) => c.id === caseId);
                    if (existingCase) {
                        set({ activeCase: caseId });
                        return caseId;
                    }
                }

                // Create new case on backend first to get real ID
                const newCounter = _caseCounter + 1;
                const caseName = `Case #${newCounter}`;

                try {
                    const conversation = await api.createConversation(caseName);
                    const realId = conversation.id;

                    const newCase = {
                        id: realId,
                        name: caseName,
                        createdAt: conversation.created_at || new Date().toISOString(),
                        messages: [],
                        images: [],
                        isTemp: false,
                    };

                    set((state) => ({
                        cases: [newCase, ...state.cases],
                        activeCase: realId,
                        _caseCounter: newCounter,
                    }));

                    return realId;
                } catch (error) {
                    console.error("Failed to create conversation on backend:", error);
                    // Fallback to local-only case
                    const fallbackId = caseId || crypto.randomUUID();
                    const newCase = {
                        id: fallbackId,
                        name: caseName,
                        createdAt: new Date().toISOString(),
                        messages: [],
                        images: [],
                        isTemp: true,
                    };

                    set((state) => ({
                        cases: [newCase, ...state.cases],
                        activeCase: fallbackId,
                        _caseCounter: newCounter,
                    }));

                    return fallbackId;
                }
            },

            // Load cases from backend (syncs with server)
            loadCases: async () => {
                if (get().initialized) return;
                set({ loading: true });
                try {
                    const conversations = await api.getConversations();
                    const cases = conversations.map((conv) => ({
                        id: conv.id,
                        name: conv.name,
                        createdAt: conv.created_at,
                        messages: [],
                        images: conv.images || [],
                    }));

                    // Merge with local cases (prefer local for messages)
                    const localCases = get().cases;
                    const mergedCases = cases.map((serverCase) => {
                        const localCase = localCases.find((c) => c.id === serverCase.id);
                        return localCase ? { ...serverCase, messages: localCase.messages } : serverCase;
                    });

                    // Add any local-only cases
                    const serverIds = new Set(cases.map((c) => c.id));
                    const localOnlyCases = localCases.filter((c) => !serverIds.has(c.id));

                    set({ cases: [...localOnlyCases, ...mergedCases], initialized: true });
                } catch (error) {
                    console.error("Failed to load cases:", error);
                } finally {
                    set({ loading: false });
                }
            },

            // Load messages for a case from backend
            loadMessages: async (caseId) => {
                try {
                    // Check if it's a URL-generated case - if so, just use local state
                    const existingCase = get().cases.find((c) => c.id === caseId);
                    if (!existingCase) {
                        return;
                    }

                    const messages = await api.getMessages(caseId);
                    const formattedMessages = messages.map((m) => ({
                        id: m.id,
                        text: m.content,
                        sender: m.role === "user" ? "user" : "bot",
                        createdAt: m.created_at,
                    }));

                    set((state) => ({
                        cases: state.cases.map((c) =>
                            c.id === caseId
                                ? { ...c, messages: formattedMessages }
                                : c
                        ),
                    }));

                    // Sync with useChatbot if this is the active case
                    if (get().activeCase === caseId) {
                        import("./useChatbot").then((mod) => {
                            mod.default.getState().setMessages(formattedMessages);
                        });
                    }
                } catch (error) {
                    console.error("Failed to load messages:", error);
                }
            },

            createCase: (name = null) => {
                const { _caseCounter } = get();
                const newCounter = _caseCounter + 1;
                const newId = crypto.randomUUID();
                const caseName = name || `Case #${newCounter}`;

                const newCase = {
                    id: newId,
                    name: caseName,
                    createdAt: new Date().toISOString(),
                    messages: [],
                    images: [],
                    isTemp: false,
                };

                set((state) => ({
                    cases: [newCase, ...state.cases],
                    activeCase: newId,
                    _caseCounter: newCounter,
                }));

                // Clear messages in useChatbot for new case
                import("./useChatbot").then((mod) => {
                    mod.default.getState().setMessages([]);
                });

                return newId;
            },

            switchCase: (id) => {
                const caseExists = get().cases.find((c) => c.id === id);
                if (caseExists) {
                    set({ activeCase: id });

                    // Sync messages immediately from local store
                    import("./useChatbot").then((mod) => {
                        mod.default.getState().setMessages(caseExists.messages || []);
                        mod.default.getState().setStatus("idle");
                    });

                    // Try to load from backend too
                    get().loadMessages(id);
                }
            },

            deleteCase: async (id) => {
                try {
                    await api.deleteConversation(id);
                } catch (error) {
                    console.error("Failed to delete case from server:", error);
                }

                set((state) => {
                    const newCases = state.cases.filter((c) => c.id !== id);
                    const newActiveCase =
                        state.activeCase === id
                            ? newCases.length > 0
                                ? newCases[0].id
                                : null
                            : state.activeCase;
                    return { cases: newCases, activeCase: newActiveCase };
                });
            },

            renameCase: async (id, name) => {
                try {
                    await api.updateConversation(id, { name });
                } catch (error) {
                    console.error("Failed to rename case:", error);
                }
                set((state) => ({
                    cases: state.cases.map((c) =>
                        c.id === id ? { ...c, name } : c
                    ),
                }));
            },

            getActiveCase: () => {
                const { cases, activeCase } = get();
                return cases.find((c) => c.id === activeCase) || null;
            },

            addMessageToCase: (caseId, message) => {
                set((state) => ({
                    cases: state.cases.map((c) =>
                        c.id === caseId
                            ? { ...c, messages: [...c.messages, message] }
                            : c
                    ),
                }));
            },

            getCaseMessages: (caseId) => {
                const caseData = get().cases.find((c) => c.id === caseId);
                return caseData?.messages || [];
            },

            // Add image to case (after upload)
            addImageToCase: (caseId, image) => {
                set((state) => ({
                    cases: state.cases.map((c) =>
                        c.id === caseId
                            ? { ...c, images: [...(c.images || []), image] }
                            : c
                    ),
                }));
            },

            // Replace temporary case with real one after creation
            replaceTempCase: (tempId, realId, realData) => {
                set((state) => {
                    const caseToReplace = state.cases.find((c) => c.id === tempId);
                    if (!caseToReplace) return {};

                    const newCase = {
                        ...caseToReplace,
                        id: realId,
                        createdAt: realData.created_at,
                        isTemp: false,
                    };

                    return {
                        cases: state.cases.map((c) => (c.id === tempId ? newCase : c)),
                        activeCase: state.activeCase === tempId ? realId : state.activeCase,
                    };
                });
            },
        }),
        {
            name: "detective-cases-storage", // localStorage key
            partialize: (state) => ({
                cases: state.cases,
                _caseCounter: state._caseCounter,
            }),
        }
    )
);

export default useCases;
