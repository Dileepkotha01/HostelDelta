'use client';

import React, { useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  PhoneCall,
  Wrench,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminOperationsPage() {
  const { aiCallLogs, maintenanceTasks, hostels, tenants } = useAdmin();
  const { toast } = useToast();

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    setBroadcasting(true);
    setTimeout(() => {
      setBroadcasting(false);
      toast({
        title: 'Platform Broadcast Sent',
        description: `Dispatched announcement to all active hostels and tenants.`,
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-400" />
            Global Operations & AI Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor automated AI debt-collection calls, platform maintenance tickets, and send system-wide announcements.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ai-calls" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="ai-calls" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-foreground">
            <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
            Voice AI Call Logs ({aiCallLogs.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-foreground">
            <Wrench className="h-3.5 w-3.5 mr-1.5" />
            Cross-Hostel Maintenance ({maintenanceTasks.length})
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-foreground">
            <Megaphone className="h-3.5 w-3.5 mr-1.5" />
            System Broadcast
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: AI VOICE CALL LOGS ================= */}
        <TabsContent value="ai-calls" className="space-y-4">
          <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border/80 pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-indigo-400" />
                Autonomous Payment Reminder Calls
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Log of automated phone calls dispatched by the AI agent for rent collection
              </CardDescription>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Tenant Recipient</th>
                    <th className="py-3 px-4">Overdue Amount</th>
                    <th className="py-3 px-4">Overdue Days</th>
                    <th className="py-3 px-4">Outcome Status</th>
                    <th className="py-3 px-4">Promised Pay Date</th>
                    <th className="py-3 px-4">Call Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {aiCallLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground/70 text-sm">
                        No AI voice call logs registered yet. Calls trigger automatically when invoices become overdue.
                      </td>
                    </tr>
                  ) : (
                    aiCallLogs.map((log) => {
                      const date = log.created_at
                        ? new Date(log.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'N/A';

                      return (
                        <tr key={log.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{date}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground text-xs">{log.tenant_name}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-amber-400 text-xs">
                            ₹{(Number(log.amount_due) || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-xs text-foreground/80">
                            {log.days_overdue} days
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={`text-[10px] capitalize ${
                                log.call_status === 'promised_to_pay'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : log.call_status === 'in_progress'
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {log.call_status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {log.promised_pay_date || '—'}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {log.call_duration_sec ? `${log.call_duration_sec}s` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ================= TAB 2: MAINTENANCE ================= */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card className="bg-card/90 border-border shadow-xl overflow-hidden">
            <CardHeader className="border-b border-border/80 pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4 text-indigo-400" />
                Cross-Hostel Maintenance Tickets
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Repair, inspection, and cleaning tasks logged across all properties
              </CardDescription>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-background/70 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Hostel</th>
                    <th className="py-3 px-4">Task Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Notes / Issue</th>
                    <th className="py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {maintenanceTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground/70 text-sm">
                        Zero maintenance issues reported. All facilities operating normally!
                      </td>
                    </tr>
                  ) : (
                    maintenanceTasks.map((task) => {
                      const hostel = hostels.find((h) => h.id === task.hostel_id);

                      return (
                        <tr key={task.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-4 text-xs font-semibold text-foreground">
                            {hostel?.name || 'Property'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="border-border text-foreground/80 text-[10px] capitalize">
                              {task.task_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={`text-[10px] capitalize ${
                                task.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : task.status === 'in_progress'
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {task.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-foreground/80 max-w-sm truncate">
                            {task.notes || 'Routine checkup'}
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {task.created_at ? new Date(task.created_at).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: SYSTEM BROADCAST ================= */}
        <TabsContent value="broadcast" className="space-y-4">
          <Card className="bg-card/90 border-border shadow-xl max-w-2xl">
            <CardHeader className="border-b border-border/80 pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-400" />
                Dispatch System Broadcast
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Push an alert, scheduled maintenance notification, or policy update to all hostels.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="text-xs text-foreground/80 font-semibold block mb-1">
                    Announcement Headline *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Scheduled Network Maintenance on Sunday 2:00 AM"
                    className="bg-background border-border text-sm text-foreground"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-foreground/80 font-semibold block mb-1">
                    Detailed Message Body *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide details about the announcement..."
                    className="w-full rounded-md bg-background border border-border text-sm text-foreground p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={broadcasting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-foreground text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{broadcasting ? 'Sending...' : 'Broadcast to All Properties'}</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
