import { useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IoAttach, IoClose, IoDocument, IoImage } from "react-icons/io5";

const FileUpload = ({ files, onFilesChange, disabled }) => {
    const fileInputRef = useRef(null);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        // Limit to 5 files total
        const newFiles = [...files, ...selectedFiles].slice(0, 5);
        onFilesChange(newFiles);

        // Reset input
        e.target.value = "";
    };

    const removeFile = (index) => {
        const newFiles = files.filter((_, i) => i !== index);
        onFilesChange(newFiles);
    };

    const getFileIcon = (file) => {
        if (file.type.startsWith("image/")) {
            return <IoImage className="w-4 h-4" />;
        }
        return <IoDocument className="w-4 h-4" />;
    };

    const getFilePreview = (file) => {
        if (file.type.startsWith("image/")) {
            return URL.createObjectURL(file);
        }
        return null;
    };

    return (
        <>
            {/* Attach Button */}
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled || files.length >= 5}
                className="bg-slate-950/80 backdrop-blur-lg text-slate-400 p-3 rounded-3xl border border-slate-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-sm transition-all"
                title="Attach files (images, PDF)"
            >
                <IoAttach className="w-5 h-5" />
            </button>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
            />

            {/* File Previews */}
            <AnimatePresence>
                {files.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 flex gap-2 flex-wrap p-2"
                    >
                        {files.map((file, index) => {
                            const preview = getFilePreview(file);
                            return (
                                <motion.div
                                    key={`${file.name}-${index}`}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="relative group"
                                >
                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800/90 backdrop-blur-sm border border-slate-700 flex items-center justify-center">
                                        {preview ? (
                                            <img
                                                src={preview}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center text-slate-400">
                                                {getFileIcon(file)}
                                                <span className="text-[10px] mt-1 max-w-[50px] truncate">
                                                    {file.name.split(".").pop()?.toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <IoClose className="w-3 h-3" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FileUpload;
