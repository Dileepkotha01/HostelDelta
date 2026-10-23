import { NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/api-auth';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

export async function GET(request: Request) {
  const authError = requireCronSecret(request);
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const { data: subscriptions, error } = await supabase
      .from('owner_subscriptions')
      .select('id, hostel_owner_id, status, trial_ends_at, current_period_end')
      .in('status', ['ACTIVE', 'TRIALING']);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    let expiredCount = 0;
    let warningCount = 0;

    for (const sub of subscriptions || []) {
      const endDateValue = sub.status === 'TRIALING' ? sub.trial_ends_at : sub.current_period_end;
      if (!endDateValue) continue;

      const expiryDate = new Date(endDateValue);
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        const { error: updateError } = await supabase
          .from('owner_subscriptions')
          .update({ status: 'EXPIRED' })
          .eq('id', sub.id);
        if (updateError) throw updateError;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', sub.hostel_owner_id)
          .maybeSingle();
        if (profileError) throw profileError;

        // Notify owner
        if (profile?.email) {
            await sendEmail({
                to: profile.email,
                subject: 'Hostel subscription period ended',
                body: `Dear ${profile.full_name || 'Hostel owner'},\n\nThe trial or paid period for your hostel has ended. Sign in, select the hostel, and choose the one-time renewal payment to restore access for 30 days.`
            });
        }
        expiredCount++;
      } else if ([1, 2, 3].includes(diffDays)) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', sub.hostel_owner_id)
          .maybeSingle();
        if (profileError) throw profileError;

        // Send warning
        if (profile?.email) {
            await sendEmail({
                to: profile.email,
                subject: sub.status === 'TRIALING'
                  ? `Your free trial ends in ${diffDays} day(s)`
                  : `Your subscription renews in ${diffDays} day(s)`,
                body: `Dear ${profile.full_name || 'Hostel owner'},\n\nYour hostel subscription period ends on ${expiryDate.toDateString()}. The recurring price is ₹1,499 per hostel/month.`
            });
        }
        warningCount++;
      }
    }

    return NextResponse.json({ success: true, expiredCount, warningCount });

  } catch (err) {
    console.error('Cron Error:', err);
    return NextResponse.json({ error: 'Subscription expiry processing failed.' }, { status: 500 });
  }
}
