import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoFolderOpen, IoClose, IoAdd, IoTrash } from "react-icons/io5";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import useCases from "../../hooks/useCases";

const CaseSidebar = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");

    const cases = useCases((state) => state.cases);
    const activeCase = useCases((state) => state.activeCase);
    const createCase = useCases((state) => state.createCase);
    const switchCase = useCases((state) => state.switchCase);
    const deleteCase = useCases((state) => state.deleteCase);
    const renameCase = useCases((state) => state.renameCase);
    const loadCases = useCases((state) => state.loadCases);
    const loading = useCases((state) => state.loading);

    // Load cases from backend when sidebar opens for the first time
    useEffect(() => {
        if (isOpen) {
            loadCases();
        }
    }, [isOpen, loadCases]);

    const handleNewCase = () => {
        // Navigate to root - case will be created when first message is sent
        navigate('/');
    };

    const handleDoubleClick = (caseItem) => {
        setEditingId(caseItem.id);
        setEditName(caseItem.name);
    };

    const handleRename = (id) => {
        if (editName.trim()) {
            renameCase(id, editName.trim());
        }
        setEditingId(null);
        setEditName("");
    };

    const handleKeyDown = (e, id) => {
        if (e.key === "Enter") {
            handleRename(id);
        } else if (e.key === "Escape") {
            setEditingId(null);
            setEditName("");
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto fixed top-4 left-4 z-50 bg-slate-950/80 backdrop-blur-lg text-slate-200 p-3 rounded-3xl border border-slate-800 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-sm transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isOpen ? (
                    <IoClose className="w-5 h-5" />
                ) : (
                    <HiOutlineMenuAlt2 className="w-5 h-5" />
                )}
            </motion.button>

            {/* Sidebar Panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="pointer-events-auto fixed inset-0 bg-black/20 z-40"
                        />

                        {/* Sidebar */}
                        <motion.div
                            initial={{ x: -320, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -320, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="pointer-events-auto fixed top-0 left-0 h-full w-80 bg-slate-900/90 backdrop-blur-xl border-r border-slate-700/50 z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-slate-700/50">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <IoFolderOpen className="w-5 h-5 text-blue-400" />
                                        <h2 className="text-lg font-semibold text-white">Cases</h2>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <IoClose className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* New Case Button */}
                                <button
                                    onClick={handleNewCase}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600/80 hover:bg-blue-500/80 text-white rounded-xl transition-colors font-medium"
                                >
                                    <IoAdd className="w-5 h-5" />
                                    New Case
                                </button>
                            </div>

                            {/* Cases List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {cases.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <IoFolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No cases yet</p>
                                        <p className="text-xs mt-1">Create a new case to start</p>
                                    </div>
                                ) : (
                                    cases.map((caseItem) => (
                                        <motion.div
                                            key={caseItem.id}
                                            onClick={() => {
                                                switchCase(caseItem.id);
                                                navigate(`/case/${caseItem.id}`);
                                                // Sidebar stays open - user can close it manually
                                            }}
                                            onDoubleClick={() => handleDoubleClick(caseItem)}
                                            className={`group relative p-3 rounded-xl cursor-pointer transition-all ${activeCase === caseItem.id
                                                ? "bg-blue-600/30 border border-blue-500/50"
                                                : "bg-slate-800/50 border border-transparent hover:bg-slate-700/50 hover:border-slate-600/50"
                                                }`}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    {editingId === caseItem.id ? (
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onBlur={() => handleRename(caseItem.id)}
                                                            onKeyDown={(e) => handleKeyDown(e, caseItem.id)}
                                                            autoFocus
                                                            className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <p className="text-sm font-medium text-white truncate">
                                                            {caseItem.name}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {formatDate(caseItem.createdAt)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {caseItem.messages.length} messages
                                                    </p>
                                                </div>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteCase(caseItem.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <IoTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default CaseSidebar;
