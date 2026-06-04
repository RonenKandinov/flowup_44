import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';

/**
 * Dropdown of customers we already ran an underwriting analysis on
 * (UnderwritingAnalysis records). These are the real customers that have
 * been processed end-to-end in the system. Lets the analyst switch the
 * active customer in the dashboard. Renders nothing when there are none.
 */
export default function CustomerSwitcher({ activeCustomerId, onSelect }) {
  const { data: analyses = [] } = useQuery({
    queryKey: ['underwritten-customers'],
    queryFn: () => base44.entities.UnderwritingAnalysis.list('-created_date', 200),
  });

  // De-dupe by customer identity (one entry per customer, latest analysis wins)
  const customers = React.useMemo(() => {
    const map = new Map();
    for (const a of analyses) {
      const id = a.user_id || a.user_email;
      if (!id || map.has(id)) continue;
      map.set(id, { id, name: a.user_email || id });
    }
    return Array.from(map.values());
  }, [analyses]);

  if (customers.length === 0) return null;

  return (
    <div className="w-56">
      <Select value={activeCustomerId || ''} onValueChange={onSelect}>
        <SelectTrigger className="h-9 bg-slate-800/60 border-slate-700/60 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <SelectValue placeholder="בחר לקוח" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}