'use client';

import React, { useState } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sliders,
  Globe,
  Database,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Server,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
  const {
    platformCommissionRate,
    setPlatformCommissionRate,
    stats,
  } = useAdmin();
  const { toast } = useToast();

  const [rateInput, setRateInput] = useState(String(platformCommissionRate));
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: 'Copied to Clipboard',
      description: text,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(rateInput);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setPlatformCommissionRate(val);
      toast({
        title: 'Settings Saved',
        description: `Platform commission updated to ${val}%.`,
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Sliders className="h-6 w-6 text-indigo-400" />
          Subdomain & Platform Configuration
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Configure subdomain routing, platform commission fees, and cloud database connectivity.
        </p>
      </div>

      {/* Subdomain Architecture Card */}
      <Card className="bg-card/90 border-border shadow-xl">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-400" />
              Multi-Domain & Subdomain Architecture
            </CardTitle>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Middleware Active
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            How your Super Admin portal runs on a dedicated subdomain while sharing the live database.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-5 space-y-5 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-background border border-border space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Admin Subdomain:</span>
              <span className="font-bold text-indigo-400">admin.kupera.in</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Hostel Manager Subdomain:</span>
              <span className="font-bold text-foreground/90">app.kupera.in</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Marketing & Public Site:</span>
              <span className="font-bold text-foreground/90">kupera.in</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Local Dev Simulation:</span>
              <span className="font-bold text-foreground/90">localhost:3000 (with subdomain emulation)</span>
            </div>
          </div>

          <div className="space-y-3 text-foreground/80">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
              DNS Configuration Instructions for Production
            </h4>
            <div className="bg-background p-3 rounded-lg border border-border space-y-2 text-xs">
              <p className="text-muted-foreground">
                To route <code className="text-indigo-300">admin.yourdomain.com</code> to this dashboard:
              </p>
              <div className="p-2 bg-card rounded font-mono text-[11px] text-foreground/80 flex items-center justify-between">
                <span>CNAME &nbsp; admin &nbsp; cname.vercel-dns.com (or your server IP)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-indigo-400 hover:text-foreground"
                  onClick={() => copyToClipboard('CNAME admin cname.vercel-dns.com')}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <p className="text-muted-foreground/70 text-[11px]">
                The Next.js edge middleware automatically intercepts requests on the <code className="text-indigo-300">admin.</code> subdomain and rewrites them directly to this Command Center without changing the URL bar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Database & Security Settings */}
      <Card className="bg-card/90 border-border shadow-xl">
        <CardHeader className="border-b border-border/80 pb-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            Supabase PostgreSQL Connection & Row-Level Security
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Live database synchronizing both the Owner Portal and this Admin Portal
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-background rounded-lg border border-border">
              <span className="text-muted-foreground/70 text-[10px] uppercase font-bold block">Status</span>
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
            </div>
            <div className="p-3 bg-background rounded-lg border border-border">
              <span className="text-muted-foreground/70 text-[10px] uppercase font-bold block">Total Hostels</span>
              <span className="text-sm font-bold text-foreground mt-0.5 block">{stats.totalHostels} Properties</span>
            </div>
            <div className="p-3 bg-background rounded-lg border border-border">
              <span className="text-muted-foreground/70 text-[10px] uppercase font-bold block">Total Tenants</span>
              <span className="text-sm font-bold text-foreground mt-0.5 block">{stats.totalTenants} Residents</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-foreground/80">
            <span className="font-semibold text-indigo-300 block mb-1">Shared Real-Time Persistence</span>
            Both your single-hostel manager portal (<code className="text-foreground">/app/*</code>) and this Super Admin portal (<code className="text-foreground">/admin/*</code>) write to the exact same Postgres tables. Any payment or hostel created here appears instantly in the manager portal.
          </div>
        </CardContent>
      </Card>

      {/* Platform Commission Model */}
      <Card className="bg-card/90 border-border shadow-xl">
        <CardHeader className="border-b border-border/80 pb-4">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Platform Monetization & Commission
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Default platform cut calculated on gross rent collections
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSaveCommission} className="flex items-center gap-3 max-w-sm">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Commission Percentage (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="50"
                className="bg-background border-border text-foreground text-sm"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
              />
            </div>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-foreground text-xs mt-5">
              Update Rate
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
