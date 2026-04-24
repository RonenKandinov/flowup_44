import React from 'react';
import PWAInitializer from "@/components/utils/PWAInitializer";

export default function Layout({ children, currentPageName }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
            <PWAInitializer />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}