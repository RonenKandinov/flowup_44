// Lightweight cross-tab account selector — reads ?accountId from the URL
// (set by the Dashboard account picker) and exposes it to any B2B Suite tab.
// Falls back to null = "all accounts (combined view)".

import { useEffect, useState } from 'react';

export function useSelectedAccount() {
    const read = () => {
        try {
            const p = new URLSearchParams(window.location.search);
            const v = p.get('accountId');
            return v && v !== 'all' ? v : null;
        } catch { return null; }
    };

    const [accountId, setAccountId] = useState(read);

    useEffect(() => {
        const onChange = () => setAccountId(read());
        window.addEventListener('popstate', onChange);
        return () => window.removeEventListener('popstate', onChange);
    }, []);

    return { accountId };
}