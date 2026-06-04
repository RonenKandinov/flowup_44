import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';

/**
 * Dropdown of customers who fully COMPLETED the onboarding flow
 * (CustomerOnboardingSession.status === 'completed'). Customers who stopped
 * mid-flow are intentionally excluded. Lets the analyst switch the active
 * customer in the dashboard. Renders nothing when there are no completed customers.
 */
export default function CustomerSwitcher({ activeCustomerId, onSelect }) {
  const { data: sessions = [] } = useQuery({
    queryKey: ['completed-onboarding-sessions'],
    queryFn: () =>
      base44.entities.CustomerOnboardingSession.filter({ status: 'completed' }, '-completed_at', 100),
  });

  // De-dupe by customer id (one entry per customer, latest session wins)
  const customers = React.useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const id = s.customer_id || s.customer_email;
      if (!id || map.has(id)) continue;
      map.set(id, { id, name: s.customer_name || id });
    }
    return Array.from(map.values());
  }, [sessions]);

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