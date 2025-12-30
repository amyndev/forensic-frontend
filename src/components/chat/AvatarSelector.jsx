import { motion } from "motion/react";
import { IoMale, IoFemale } from "react-icons/io5";
import useChatbot from "../../hooks/useChatbot";

/**
 * AvatarSelector - UI for switching between Male and Female avatars.
 */
export const AvatarSelector = () => {
    const currentAvatar = useChatbot((state) => state.currentAvatar);
    const setAvatar = useChatbot((state) => state.setAvatar);

    return (
        <div className="absolute top-4 right-4 z-20 pointer-events-auto">
            <div className="flex items-center gap-1 p-1.5 bg-slate-900 backdrop-blur-md rounded-full border border-slate-700 shadow-lg">
                <button
                    onClick={() => setAvatar("male")}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${currentAvatar === "male"
                        ? "text-blue-200"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        }`}
                    title="Male Avatar"
                >
                    {currentAvatar === "male" && (
                        <motion.div
                            layoutId="activeAvatar"
                            className="absolute inset-0 bg-blue-600 rounded-full shadow-inner shadow-blue-400/30"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10"><IoMale className="w-5 h-5" /></span>
                </button>

                <button
                    onClick={() => setAvatar("female")}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${currentAvatar === "female"
                        ? "text-purple-200"
                        : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        }`}
                    title="Female Avatar"
                >
                    {currentAvatar === "female" && (
                        <motion.div
                            layoutId="activeAvatar"
                            className="absolute inset-0 bg-purple-600 rounded-full shadow-inner shadow-purple-400/30"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10"><IoFemale className="w-5 h-5" /></span>
                </button>
            </div>
        </div>
    );
};

export default AvatarSelector;
