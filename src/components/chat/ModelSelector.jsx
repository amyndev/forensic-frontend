import { FaRobot, FaCloud } from "react-icons/fa6";
import useChatbot from "../../hooks/useChatbot";

const ModelSelector = () => {
    const currentModel = useChatbot((state) => state.currentModel);
    const setModel = useChatbot((state) => state.setModel);

    const toggleModel = () => {
        const newModel = currentModel === "local" ? "gpt4o" : "local";
        setModel(newModel);
    };

    return (
        <button
            onClick={toggleModel}
            className={`flex items-center gap-2 px-3 py-3 bg-slate-900 rounded-full border-1 transition-colors text-xs font-medium text-slate-300 ${currentModel === "local" ? "border-green-600 hover:bg-green-600/30" : "border-blue-600 hover:bg-blue-600/30"}`}
            title={`Switch to ${currentModel === "local" ? "Cloud (GPT-4o)" : "Local (YOLO+OCR)"}`}
        >
            {currentModel === "local" ? (
                <>
                    <FaRobot className="w-3.5 h-3.5 text-green-400" />
                </>
            ) : (
                <>
                    <FaCloud className="w-3.5 h-3.5 text-blue-400" />
                </>
            )}
        </button>
    );
};

export default ModelSelector;
