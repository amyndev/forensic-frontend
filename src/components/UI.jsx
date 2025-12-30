import { motion } from "motion/react";
import { useRef, useEffect } from "react";
import useChatbot from "../hooks/useChatbot";
import CaseSidebar from "./chat/CaseSidebar";
import ChatInput from "./chat/ChatInput";
import SpeechManager from "./chat/SpeechManager";
import AvatarSelector from "./chat/AvatarSelector";

export const UI = () => {
  const messages = useChatbot((state) => state.messages);
  const cameraZoomed = useChatbot((state) => state.cameraZoomed);
  const setCameraZoomed = useChatbot((state) => state.setCameraZoomed);
  const streamingText = useChatbot((state) => state.streamingText);
  const status = useChatbot((state) => state.status);
  const progress = useChatbot((state) => state.progress);
  const isPremiumMode = useChatbot((state) => state.isPremiumMode);
  const togglePremiumMode = useChatbot((state) => state.togglePremiumMode);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  if (cameraZoomed) {
    return (
      <div className="fixed inset-0 z-10 pointer-events-none">
        <button
          onClick={() => setCameraZoomed(false)}
          className="pointer-events-auto absolute top-4 right-4 bg-slate-900/80 text-white px-4 py-2 hover:bg-slate-800 transition-colors border border-slate-700"
        >
          Back to Overview
        </button>
      </div>
    );
  }

  // Get status indicator text
  const getStatusText = () => {
    if (status === "detection") {
      return progress?.totalImages
        ? `Detecting objects (${progress.image || 1}/${progress.totalImages})...`
        : "Detecting objects...";
    }
    if (status === "ocr") {
      return progress?.totalImages
        ? `Extracting text (${progress.image || 1}/${progress.totalImages})...`
        : "Extracting text...";
    }
    if (status === "nlp") return "Generating hypothesis...";
    if (status === "streaming") return "Analyzing...";
    return null;
  };

  const statusText = getStatusText();

  return (
    <main className="fixed inset-0 z-10 flex flex-col pointer-events-none">
      {/* Bottom Gradient for better contrast */}
      <div className="absolute bottom-0 left-0 w-full h-[60vh] bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent -z-10 pointer-events-none" />

      <SpeechManager />

      {/* Avatar Selector */}
      <AvatarSelector />

      {/* Case Sidebar */}
      <CaseSidebar />

      <div className="flex-1 flex flex-col justify-between p-4 lg:p-8 max-w-screen-xl mx-auto w-full">
        {/* Chat Interface */}
        <div className="w-full max-w-md mt-auto pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md flex flex-col max-h-[500px]"
          >
            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
            >
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, x: msg.sender === "user" ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 text-sm font-mono ${msg.sender === "user"
                      ? "bg-blue-700 rounded-2xl rounded-br-none text-blue-100 border border-blue-500/30"
                      : "bg-slate-800 rounded-2xl rounded-bl-none text-slate-200 border border-slate-700"
                      }`}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {msg.images.map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt="Evidence"
                            className="w-full rounded-lg border border-slate-600/50"
                          />
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </motion.div>
              ))}

              {/* Progress Indicator */}
              {statusText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-2 text-xs font-mono text-slate-400 bg-slate-900/60 rounded-xl border border-slate-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    {statusText}
                  </div>
                </motion.div>
              )}

              {/* Streaming Text */}
              {streamingText && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[85%] px-4 py-3 text-sm font-mono bg-slate-800/80 rounded-2xl rounded-bl-none text-slate-200 border border-slate-700">
                    {streamingText}
                    <span className="inline-block w-2 h-4 ml-1 bg-slate-400 animate-pulse" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area with File Upload */}
            <ChatInput />
          </motion.div>
        </div>
      </div>
    </main>
  );
};