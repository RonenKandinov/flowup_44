// Cross-page selected-account memory.
//
// Single source of truth = localStorage('flowup_selected_account_id').
// The URL ?accountId=... is mirrored from it (for shareable links + back-compat),
// but localStorage wins so the selection survives page transitions and refreshes
// even when an internal <Link> doesn't carry the query string.
//
// Falls back to null = "all accounts (combined view)".

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'flowup_selected_account_id';

const readSelectedAccount = () => {
    try {
        // 1) URL has priority if explicitly set (allows deep-linking)
        const p = new URLSearchParams(window.location.search);
        const fromUrl = p.get('accountId');
        if (fromUrl) {
            // Mirror URL → storage so subsequent navigations keep it
            if (fromUrl === 'all') {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            localStorage.setItem(STORAGE_KEY, fromUrl);
            return fromUrl;
        }
        // 2) Fall back to last-selected from storage
        const fromStorage = localStorage.getItem(STORAGE_KEY);
        return fromStorage || null;
    } catch {
        return null;
    }
};

export function useSelectedAccount() {
    const [accountId, setAccountId] = useState(readSelectedAccount);

    useEffect(() => {
        const onChange = () => setAccountId(readSelectedAccount());
        window.addEventListener('popstate', onChange);
        // Reflect external updates (other tabs, Dashboard select) immediately
        window.addEventListener('storage', onChange);
        window.addEventListener('flowup:account-changed', onChange);
        return () => {
            window.removeEventListener('popstate', onChange);
            window.removeEventListener('storage', onChange);
            window.removeEventListener('flowup:account-changed', onChange);
        };
    }, []);

    return { accountId };
}