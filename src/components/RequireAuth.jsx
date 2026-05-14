import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Wraps a page so unauthenticated users are redirected to Base44's login flow.
 * Authenticated users see the children normally.
 */
export default function RequireAuth({ children }) {
    const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();

    useEffect(() => {
        if (!isLoadingAuth && !isAuthenticated) {
            navigateToLogin();
        }
    }, [isLoadingAuth, isAuthenticated, navigateToLogin]);

    if (isLoadingAuth || !isAuthenticated) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
                <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            </div>
        );
    }

    return children;
}