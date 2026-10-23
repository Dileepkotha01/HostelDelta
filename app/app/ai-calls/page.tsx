'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  PhoneCall,
  Phone,
  PhoneIncoming,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Pause,
  Play,
  Calendar,
  IndianRupee,
  Search,
  Bot
} from 'lucide-react';
import type { AICallLog, AICallStatus, Tenant } from '@/lib/types';

const STATUS_CONFIG: Record<AICallStatus, { icon: typeof Phone; color: string; bg: string; label: string }> = {
  scheduled: { icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Scheduled' },
  in_progress: { icon: PhoneIncoming, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', label: 'In Progress' },
  promised_to_pay: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Promised' },
  call_failed: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Failed' },
  escalated: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Escalated' },
};

export default function AICallsPage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const [calls, setCalls] = useState<(AICallLog & { tenant?: Tenant })[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isReady) return;
    if (!hostelId) {
      setLoading(false);
      return;
    }
    loadData(hostelId);
  }, [isReady, hostelId]);

  async function loadData(hostelId: string) {
    setLoading(true);
    const [{ data: callData }, { data: tenantData }] = await Promise.all([
      supabase.from('ai_call_logs').select('*, tenant:tenants(*)').eq('hostel_id', hostelId).order('created_at', { ascending: false }),
      supabase.from('tenants').select('*').eq('hostel_id', hostelId).eq('status', 'active'),
    ]);
    setCalls((callData || []) as (AICallLog & { tenant?: Tenant })[]);
    setTenants((tenantData || []) as Tenant[]);
    setLoading(false);
  }

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      if (statusFilter !== 'all' && call.call_status !== statusFilter) return false;
      if (search && !call.tenant_name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [calls, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      total: calls.length,
      scheduled: calls.filter(c => c.call_status === 'scheduled').length,
      inProgress: calls.filter(c => c.call_status === 'in_progress').length,
      promised: calls.filter(c => c.call_status === 'promised_to_pay').length,
      failed: calls.filter(c => c.call_status === 'call_failed').length,
      escalated: calls.filter(c => c.call_status === 'escalated').length,
    };
  }, [calls]);

  async function togglePauseCalls(tenantId: string, current: boolean) {
    const { error } = await supabase
      .from('tenants')
      .update({ pause_ai_calls: !current })
      .eq('id', tenantId);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
      return;
    }

    setTenants(tenants.map(t => t.id === tenantId ? { ...t, pause_ai_calls: !current } : t));
    toast({
      title: !current ? 'AI calls paused' : 'AI calls resumed',
      description: `For ${tenants.find(t => t.id === tenantId)?.full_name}`,
    });
  }

  async function updateCallStatus(callId: string, status: AICallStatus) {
    const { error } = await supabase
      .from('ai_call_logs')
      .update({ call_status: status })
      .eq('id', callId);

    if (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
      return;
    }

    setCalls(calls.map(c => c.id === callId ? { ...c, call_status: status } : c));
    toast({ title: 'Status updated', description: `Call marked as ${status.replace(/_/g, ' ')}` });
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse"><Bot className="w-8 h-8 opacity-50" /><p>Loading AI agents...</p></div></div>;
  }

  if (isReady && !hasHostel) {
    return <NoHostelLinked />;
  }

  const statCards = [
    { label: 'Total AI Calls', value: stats.total, icon: PhoneCall, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
    { label: 'Promised to Pay', value: stats.promised, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Call Failed', value: stats.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Escalated', value: stats.escalated, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" /> AI Voice Agent
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Automated, polite payment recovery calls for overdue rent.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`relative overflow-hidden rounded-2xl border p-5 ${stat.bg} shadow-sm transition-transform hover:scale-[1.02]`}>
              <div className="flex flex-row items-center justify-between mb-2">
                <h3 className="text-sm font-semibold opacity-80">{stat.label}</h3>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-3xl font-black">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Column - Call Logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-2xl p-2 flex flex-col sm:flex-row gap-2 items-center shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search tenant..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none" />
            </div>
            <div className="h-px sm:h-8 w-full sm:w-px bg-border my-1 sm:my-0" />
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
              <TabsList className="h-10 bg-transparent border-none p-0 space-x-1 w-full sm:w-auto justify-start overflow-x-auto no-scrollbar">
                <TabsTrigger value="all" className="data-[state=active]:bg-secondary rounded-xl">All</TabsTrigger>
                <TabsTrigger value="scheduled" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-xl">Scheduled</TabsTrigger>
                <TabsTrigger value="promised_to_pay" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-xl">Promised</TabsTrigger>
                <TabsTrigger value="escalated" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl">Escalated</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {filteredCalls.length === 0 ? (
            <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-24 text-center gap-4 bg-card/50">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold">No AI Activity Yet</h3>
                <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Calls are placed automatically when an invoice passes its due date.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCalls.map((call) => {
                const config = STATUS_CONFIG[call.call_status];
                const StatusIcon = config.icon;
                return (
                  <div key={call.id} className="p-5 rounded-2xl border bg-card hover:shadow-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 group hover:border-primary/30">
                    
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${config.bg} ${config.color}`}>
                        <StatusIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{call.tenant_name}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(call.created_at).toLocaleString()}</span>
                          <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{call.provider}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-end w-full gap-4">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-red-600 flex items-center sm:justify-end gap-0.5">
                            <IndianRupee className="w-3.5 h-3.5" />{Number(call.amount_due).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-muted-foreground">{call.days_overdue} days overdue</p>
                        </div>
                        <Badge className={`${config.bg} ${config.color} border capitalize h-7 px-3 text-xs`}>
                          {config.label}
                        </Badge>
                      </div>

                      {call.promised_pay_date && (
                        <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1.5 w-max">
                          <Calendar className="w-3.5 h-3.5" /> Promised by: {new Date(call.promised_pay_date).toLocaleDateString()}
                        </div>
                      )}

                      {/* Quick Actions (only show on hover or on mobile) */}
                      <div className="flex gap-2 mt-2 w-full sm:w-auto sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" onClick={() => updateCallStatus(call.id, 'promised_to_pay')} disabled={call.call_status === 'promised_to_pay'} className="flex-1">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Promised
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateCallStatus(call.id, 'escalated')} disabled={call.call_status === 'escalated'} className="flex-1">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500" /> Escalate
                        </Button>
                      </div>
                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side Column - Tenant Controls */}
        <div className="space-y-6">
          <div className="bg-card border border-primary/20 rounded-2xl overflow-hidden shadow-lg shadow-primary/5">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border-b">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" /> Active Tenants
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Enable or disable automated calls per tenant.</p>
            </div>
            
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto no-scrollbar">
              {tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No active tenants</p>
              ) : (
                tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{tenant.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tenant.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Switch
                        checked={!tenant.pause_ai_calls}
                        onCheckedChange={() => togglePauseCalls(tenant.id, tenant.pause_ai_calls)}
                      />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${tenant.pause_ai_calls ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {tenant.pause_ai_calls ? 'Paused' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
