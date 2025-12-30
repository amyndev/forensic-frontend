import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoSend, IoChevronDown, IoFlash, IoSparkles } from "react-icons/io5";
import { motion, AnimatePresence } from "motion/react";
import FileUpload from "./FileUpload";
import useChatbot from "../../hooks/useChatbot";
import useCases from "../../hooks/useCases";

const ModelSelector = () => {
    const isPremiumMode = useChatbot((state) => state.isPremiumMode);
    const togglePremiumMode = useChatbot((state) => state.togglePremiumMode);
    const messages = useChatbot((state) => state.messages);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Lock selection if there are messages
    const isLocked = messages.length > 0;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleToggle = (mode) => {
        if ((mode === "premium" && !isPremiumMode) || (mode === "basic" && isPremiumMode)) {
            togglePremiumMode();
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !isLocked && setIsOpen(!isOpen)}
                disabled={isLocked}
                className={`flex items-center gap-2 p-3 rounded-full text-xs font-mono border transition-all ${isPremiumMode
                    ? "bg-purple-900/40 border-purple-500/30 text-purple-200 hover:bg-purple-900/60"
                    : "bg-blue-900/40 border-blue-500/30 text-blue-200 hover:bg-blue-900/60"
                    } ${isLocked ? "opacity-50 cursor-not-allowed hover:bg-opacity-40" : ""}`}
                title={isLocked ? "Mode locked for this conversation" : (isPremiumMode ? "Premium Mode" : "Basic Mode")}
            >
                {isPremiumMode ? <IoSparkles className="w-4 h-4" /> : <IoFlash className="w-4 h-4" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-4 w-48 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-50 flex flex-col p-1.5"
                    >
                        <button
                            onClick={() => handleToggle("basic")}
                            className={`flex items-center gap-3 px-3 py-2 mb-2 rounded-xl text-sm transition-colors text-left ${!isPremiumMode ? "bg-slate-800 text-blue-200" : "text-slate-400 hover:bg-blue-800/50 hover:text-slate-200"
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${!isPremiumMode ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-500"}`}>
                                <IoFlash />
                            </div>
                            <div>
                                <div className="font-bold text-xs font-mono">BASIC</div>
                                <div className="text-[10px] opacity-60">Groq, YOLO, OCR</div>
                            </div>
                            {!isPremiumMode && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500"></div>}
                        </button>

                        <button
                            onClick={() => handleToggle("premium")}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors text-left ${isPremiumMode ? "bg-slate-800 text-purple-200" : "text-slate-400 hover:bg-blue-800/50 hover:text-slate-200"
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${isPremiumMode ? "bg-purple-500/20 text-purple-400" : "bg-slate-800 text-slate-500"}`}>
                                <IoSparkles />
                            </div>
                            <div>
                                <div className="font-bold text-xs font-mono">PREMIUM</div>
                                <div className="text-[10px] opacity-60">GPT-4o, ElevenLabs</div>
                            </div>
                            {isPremiumMode && <div className="ml-auto w-2 h-2 rounded-full bg-purple-500"></div>}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ChatInput = () => {
    const { caseId } = useParams();
    const navigate = useNavigate();
    const [input, setInput] = useState("");
    const [attachedFiles, setAttachedFiles] = useState([]);

    const sendMessage = useChatbot((state) => state.sendMessage);
    const loading = useChatbot((state) => state.loading);
    const status = useChatbot((state) => state.status);

    const activeCase = useCases((state) => state.activeCase);
    const createCase = useCases((state) => state.createCase);
    const ensureCaseExists = useCases((state) => state.ensureCaseExists);

    const handleSend = async () => {
        if (loading) return;
        if (!input.trim() && attachedFiles.length === 0) return;

        let conversationId = activeCase || caseId;

        // If no case exists yet (user is on root "/" or case not created), create one now
        if (!conversationId) {
            // Create case on backend and get real ID
            conversationId = await ensureCaseExists();
            if (!conversationId) {
                console.error("Failed to create case");
                return;
            }
            // Navigate to the case URL with real backend ID
            navigate(`/case/${conversationId}`, { replace: true });
        } else if (caseId && !activeCase) {
            // We have a caseId from URL but it's not in the store yet
            // This could be a shared link or refresh - try to set as active
            const existingId = await ensureCaseExists(caseId);
            conversationId = existingId;
        }

        // Send message with files and conversation ID
        sendMessage(input.trim(), attachedFiles, conversationId);
        setInput("");
        setAttachedFiles([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Get placeholder text based on status
    const getPlaceholder = () => {
        if (status === "detection") return "Detecting objects...";
        if (status === "ocr") return "Extracting text...";
        if (status === "nlp" || status === "streaming") return "Generating analysis...";
        return "Enter query...";
    };

    return (
        <div className="p-4">
            <div className="relative flex items-center gap-2 bg-slate-950 rounded-full border border-slate-800 p-1.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">

                {/* File Upload Component */}
                <FileUpload
                    files={attachedFiles}
                    onFilesChange={setAttachedFiles}
                    disabled={loading}
                />

                {/* Input Field */}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholder()}
                    disabled={loading}
                    className="w-full bg-transparent text-slate-200 placeholder-slate-400 px-2 py-2 focus:outline-none font-mono text-sm"
                />

                {/* Model Selector Dropdown */}
                <ModelSelector />

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={loading || (!input.trim() && attachedFiles.length === 0)}
                    className="p-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-slate-400"
                >
                    <IoSend className="w-4 h-4" />
                </button>

            </div>
        </div>
    );
};

export default ChatInput;
