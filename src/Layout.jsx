import React from 'react';
import PWAInitializer from "@/components/utils/PWAInitializer";
import { motion, AnimatePresence } from "framer-motion";

export default function Layout({ children, currentPageName }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">
            <PWAInitializer />
            <AnimatePresence mode="wait">
                <motion.main
                    key={currentPageName}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
                >
                    {children}
                </motion.main>
            </AnimatePresence>
        </div>
    );
}