import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoSend } from "react-icons/io5";
import FileUpload from "./FileUpload";
import useChatbot from "../../hooks/useChatbot";
import useCases from "../../hooks/useCases";
import ModelSelector from "./ModelSelector";

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
                {/* Model Selector */}
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
