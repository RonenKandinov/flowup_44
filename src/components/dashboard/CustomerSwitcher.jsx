import React from 'react';
import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

// CustomerSwitcher — analyst-facing dropdown that lists every customer that was
// ever connected via FlowUp Open Finance (single source of truth = the
// OpenFinanceConnection entity, keyed by psu_id). Selecting a customer just swaps
// the active context; no re-connection needed.
export default function CustomerSwitcher({ activeCustomerId, onSelect }) {
  const { data: customers = [] } = useQuery({
    queryKey: ['of-connected-customers'],
    queryFn: async () => {
      const conns = await base44.entities.OpenFinanceConnection.list('-created_date', 200);
      // A real customer is keyed by a valid Israeli national ID (9 digits).
      // Internal Open Finance ids (long hex strings, e.g. "6a2056cba0...") are
      // connection artifacts — NOT customers — so we filter them out to avoid the
      // "ghost customer" duplicates seen in the dropdown.
      const isNationalId = (v) => /^[0-9]{9}$/.test(String(v || '').trim());
      const seen = new Map();
      for (const c of conns) {
        if (!isNationalId(c.psu_id)) continue;
        if (!seen.has(c.psu_id)) seen.set(c.psu_id, c);
      }
      return Array.from(seen.values());
    },
  });

  if (customers.length === 0) return null;

  return (
    <div className="w-56">
      <Select value={activeCustomerId || ''} onValueChange={onSelect}>
        <SelectTrigger className="h-9 bg-slate-800/60 border-slate-700/60 text-xs backdrop-blur-sm">
          <Users className="w-3.5 h-3.5 ml-1.5 text-cyan-400 shrink-0" />
          <SelectValue placeholder="בחר לקוח" />
        </SelectTrigger>
        <SelectContent>
          {customers.map(c => (
            <SelectItem key={c.psu_id} value={c.psu_id}>
              {c.psu_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}