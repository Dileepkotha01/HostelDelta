'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileDown, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import type { PaymentReceipt, RentTransaction } from '@/lib/types';

interface RentReceiptListProps {
  tenantId: string;
}

export function RentReceiptList({ tenantId }: RentReceiptListProps) {
  const [transactions, setTransactions] = useState<RentTransaction[]>([]);
  const [receipts, setReceipts] = useState<Record<string, PaymentReceipt>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch transactions
        const { data: txData, error: txError } = await supabase
          .from('rent_transactions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (txError) throw txError;
        setTransactions(txData || []);

        // Fetch related receipts
        if (txData && txData.length > 0) {
            const txIds = txData.map(t => t.id);
            const { data: rcptData, error: rcptError } = await supabase
                .from('payment_receipts')
                .select('*')
                .in('transaction_id', txIds);
                
            if (!rcptError && rcptData) {
                const rcptMap: Record<string, PaymentReceipt> = {};
                rcptData.forEach(r => rcptMap[r.transaction_id] = r);
                setReceipts(rcptMap);
            }
        }
      } catch (error) {
        console.error('Error fetching receipts:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
        fetchData();
    }
  }, [tenantId]);

  if (loading) {
    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 flex justify-center items-center">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </CardContent>
        </Card>
    );
  }

  if (transactions.length === 0) {
      return (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 flex flex-col justify-center items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                  <h3 className="font-medium text-slate-300">No Payment History</h3>
                  <p className="text-sm text-slate-500 mt-1">Your rent payment records will appear here.</p>
              </div>
          </CardContent>
        </Card>
      );
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-lg text-white">Payment History & Receipts</CardTitle>
        <CardDescription className="text-slate-400">View your past transactions and download official rent receipts.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-800/60">
          {transactions.map((tx) => {
            const receipt = receipts[tx.id];
            const isPaid = tx.status === 'PAID';
            const isPending = tx.status === 'PENDING';
            const isFailed = tx.status === 'FAILED';

            return (
              <div key={tx.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${
                      isPaid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      isPending ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                      'bg-red-500/10 border-red-500/20 text-red-500'
                  }`}>
                    {isPaid ? <CheckCircle2 className="h-5 w-5" /> : 
                     isPending ? <Clock className="h-5 w-5" /> : 
                     <ShieldAlert className="h-5 w-5" />}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                            {tx.rent_month} {tx.rent_year} Rent
                        </span>
                        {isPaid && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] uppercase">Paid</Badge>}
                        {isPending && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 text-[10px] uppercase">Pending</Badge>}
                        {isFailed && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 text-[10px] uppercase">Failed</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>Room {tx.room_number}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-300">₹{tx.total_amount.toLocaleString('en-IN')}</span>
                        {tx.is_autopay && (
                            <>
                                <span>•</span>
                                <span className="text-indigo-400">AutoPay</span>
                            </>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                        {new Date(tx.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:shrink-0">
                    {receipt?.pdf_url ? (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto h-8 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700"
                            onClick={() => window.open(receipt.pdf_url, '_blank')}
                        >
                            <FileDown className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                            Download PDF
                        </Button>
                    ) : isPaid ? (
                         <span className="text-xs text-slate-500 flex items-center gap-1 italic">
                             <Loader2 className="h-3 w-3 animate-spin" />
                             Generating Receipt...
                         </span>
                    ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
