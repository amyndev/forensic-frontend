import { motion } from "motion/react";
import useChatbot from "../../hooks/useChatbot";

/**
 * AvatarSelector - UI for switching between Male and Female avatars.
 */
export const AvatarSelector = () => {
    const currentAvatar = useChatbot((state) => state.currentAvatar);
    const setAvatar = useChatbot((state) => state.setAvatar);

    const avatars = [
        { id: "male", label: "👨", title: "Male (Detective)" },
        { id: "female", label: "👩", title: "Female" },
    ];

    return (
        <div className="absolute top-16 right-4 z-20 pointer-events-auto flex items-center gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-700 backdrop-blur-sm">
            <span className="text-xs font-mono text-slate-400 mr-1">Avatar:</span>
            {avatars.map((avatar) => (
                <motion.button
                    key={avatar.id}
                    onClick={() => setAvatar(avatar.id)}
                    title={avatar.title}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${currentAvatar === avatar.id
                        ? "bg-purple-600 shadow-md shadow-purple-500/30"
                        : "bg-slate-700 hover:bg-slate-600"
                        }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                >
                    {avatar.label}
                </motion.button>
            ))}
        </div>
    );
};

export default AvatarSelector;
