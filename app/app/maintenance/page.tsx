'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useHostelScope } from '@/hooks/use-hostel-scope';
import { NoHostelLinked } from '@/components/no-hostel-linked';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Wrench,
  Sparkles,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Plus,
  BedDouble,
  AlertTriangle
} from 'lucide-react';
import type { MaintenanceTask, MaintenanceStatus, MaintenanceTaskType, Room } from '@/lib/types';

const STATUS_CONFIG: Record<MaintenanceStatus, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-200', label: 'Pending' },
  in_progress: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-200', label: 'In Progress' },
  completed: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-200', label: 'Completed' },
};

const TASK_ICONS: Record<MaintenanceTaskType, typeof Wrench> = {
  cleaning: Sparkles,
  repair: Wrench,
  inspection: CheckCircle2,
};

export default function MaintenancePage() {
  const { profile, hostelId, isReady, hasHostel } = useHostelScope();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<(MaintenanceTask & { room?: Room })[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTaskRoom, setNewTaskRoom] = useState('');
  const [newTaskType, setNewTaskType] = useState<MaintenanceTaskType>('cleaning');
  const [newTaskNotes, setNewTaskNotes] = useState('');

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
    const [{ data: taskData }, { data: roomData }] = await Promise.all([
      supabase.from('maintenance_tasks').select('*, room:rooms(*)').eq('hostel_id', hostelId).order('created_at', { ascending: false }),
      supabase.from('rooms').select('*').eq('hostel_id', hostelId).order('room_number'),
    ]);
    setTasks((taskData || []) as (MaintenanceTask & { room?: Room })[]);
    setRooms((roomData || []) as Room[]);
    setLoading(false);
  }

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (search && !task.room?.room_number.toLowerCase().includes(search.toLowerCase()) && !task.notes?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function createTask() {
    if (!profile?.hostel_id || !newTaskRoom) return;
    setCreating(true);

    const { error } = await supabase.from('maintenance_tasks').insert({
      hostel_id: profile.hostel_id,
      room_id: newTaskRoom,
      task_type: newTaskType,
      status: 'pending',
      notes: newTaskNotes,
    });

    if (error) {
      toast({ title: 'Failed to create task', variant: 'destructive' });
      setCreating(false);
      return;
    }

    // if repair, maybe update room status? handled elsewhere mostly.
    toast({ title: 'Task created successfully', description: `Scheduled ${newTaskType} for Room ${rooms.find(r => r.id === newTaskRoom)?.room_number}` });
    setNewTaskRoom('');
    setNewTaskNotes('');
    loadData(profile.hostel_id);
    setCreating(false);
  }

  async function updateTaskStatus(taskId: string, status: MaintenanceStatus) {
    const updates: Partial<MaintenanceTask> = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('maintenance_tasks').update(updates).eq('id', taskId);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
      return;
    }

    if (status === 'completed') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        await supabase.from('rooms').update({ status: 'vacant' }).eq('id', task.room_id);
      }
    }

    setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } as MaintenanceTask & { room?: Room } : t));
    toast({ title: 'Status updated', description: `Task marked as ${status.replace('_', ' ')}` });
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse"><Wrench className="w-8 h-8 opacity-50" /><p>Loading facility data...</p></div></div>;
  }

  if (isReady && !hasHostel) {
    return <NoHostelLinked />;
  }

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">Facility Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Schedule cleaning, repairs, and monitor hostel conditions.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Requests', value: stats.pending, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'In Progress', value: stats.inProgress, icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Completed (All Time)', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`relative overflow-hidden rounded-2xl border p-5 ${stat.bg} shadow-sm`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-background shadow-sm flex items-center justify-center shrink-0">
                  <Icon className={`w-6 h-6 ${stat.color} ${stat.label === 'In Progress' ? 'animate-spin-slow' : ''}`} />
                </div>
                <div>
                  <p className="text-3xl font-black">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Form */}
      <div className="bg-card border border-primary/20 rounded-2xl p-5 shadow-lg shadow-primary/5">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-primary" /> New Task
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <Select value={newTaskRoom} onValueChange={setNewTaskRoom}>
              <SelectTrigger className="bg-secondary/30 h-11"><SelectValue placeholder="Select Room" /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>Room {r.room_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={newTaskType} onValueChange={(v) => setNewTaskType(v as MaintenanceTaskType)}>
              <SelectTrigger className="bg-secondary/30 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Input
              className="bg-secondary/30 h-11"
              placeholder="Description or notes..."
              value={newTaskNotes}
              onChange={(e) => setNewTaskNotes(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={createTask} disabled={creating || !newTaskRoom} className="w-full h-11 shadow-md shadow-primary/20 text-md">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Schedule'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-2xl p-2 flex flex-col sm:flex-row gap-2 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search room or notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-none bg-transparent focus-visible:ring-0 shadow-none" />
        </div>
        <div className="h-px sm:h-8 w-full sm:w-px bg-border my-1 sm:my-0" />
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="h-10 bg-transparent border-none p-0 space-x-1 w-full sm:w-auto justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="all" className="data-[state=active]:bg-secondary rounded-xl">All</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600 rounded-xl">Pending</TabsTrigger>
            <TabsTrigger value="in_progress" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-xl">Active</TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-xl">Finished</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Task List Grid */}
      {filteredTasks.length === 0 ? (
        <div className="border-2 border-dashed rounded-3xl flex flex-col items-center justify-center py-24 text-center gap-4 bg-card/50">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold">All Caught Up!</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">There are no maintenance tasks matching your criteria.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const config = STATUS_CONFIG[task.status];
            const TaskIcon = TASK_ICONS[task.task_type];
            return (
              <div key={task.id} className="group p-5 rounded-2xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${config.bg} ${config.color}`}>
                    <TaskIcon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className={`capitalize ${config.bg} ${config.color} px-3 py-1 text-xs border`}>
                    {config.label}
                  </Badge>
                </div>
                
                <h4 className="font-bold text-lg mb-1 flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-muted-foreground" />
                  Room {task.room?.room_number}
                  <Badge variant="secondary" className="font-normal text-xs capitalize ml-1">{task.task_type}</Badge>
                </h4>
                
                <p className="text-sm text-muted-foreground flex-1 mb-4">
                  {task.notes || 'No additional details provided.'}
                </p>

                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                  
                  {task.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => updateTaskStatus(task.id, task.status === 'pending' ? 'in_progress' : 'completed')}
                      className={`shadow-sm transition-colors ${task.status === 'pending' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                    >
                      {task.status === 'pending' ? (
                        <>Start Work <Loader2 className="w-3.5 h-3.5 ml-1.5" /></>
                      ) : (
                        <>Finish <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" /></>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
