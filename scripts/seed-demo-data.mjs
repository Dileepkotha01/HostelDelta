/**
 * Seeds HostelHub with demo data for local testing.
 *
 * Usage: node scripts/seed-demo-data.mjs
 *
 * Env (from .env): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Optional: SUPABASE_SERVICE_ROLE_KEY (creates user without email confirmation)
 * Optional: DEMO_EMAIL, DEMO_PASSWORD (defaults below)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo.owner@hostelhub.test';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoHostel123!';

const SAMPLE_TENANTS = [
  { name: 'Arjun Mehta', phone: '+919876543210', rent: 9000 },
  { name: 'Priya Sharma', phone: '+919876543211', rent: 7500 },
  { name: 'Rahul Verma', phone: '+919876543212', rent: 7500 },
  { name: 'Sneha Iyer', phone: '+919876543213', rent: 9000 },
  { name: 'Karan Singh', phone: '+919876543214', rent: 7500 },
  { name: 'Ananya Das', phone: '+919876543215', rent: 9000 },
];

function log(msg) {
  console.log(`[seed] ${msg}`);
}

function fail(msg) {
  console.error(`[seed] ERROR: ${msg}`);
  process.exit(1);
}

if (!url || !anonKey) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
}

async function ensureDemoUser(admin, authClient) {
  if (admin) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      log(`Demo user already exists: ${DEMO_EMAIL}`);
      return existing.id;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Demo Owner', role: 'hostel_owner', phone: '+919800000000' },
    });
    if (error) fail(error.message);
    log(`Created demo user: ${DEMO_EMAIL}`);
    return data.user.id;
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (!signInError && signInData.session) {
    log(`Signed in as ${DEMO_EMAIL}`);
    return signInData.user.id;
  }

  const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: {
      data: { full_name: 'Demo Owner', role: 'hostel_owner', phone: '+919800000000' },
    },
  });

  if (signUpError) fail(signUpError.message);

  if (!signUpData.session) {
    fail(
      'Sign-up succeeded but no session (email confirmation likely enabled). ' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env from Supabase Dashboard → Settings → API, then re-run.',
    );
  }

  log(`Registered demo user: ${DEMO_EMAIL}`);
  return signUpData.user.id;
}

async function main() {
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureDemoUser(admin, authClient);

  const { data: signIn, error: loginError } = await authClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (loginError || !signIn.session) fail(loginError?.message || 'Could not sign in as demo user');

  const db = authClient;

  let { data: profile } = await db.from('profiles').select('*').eq('id', signIn.user.id).maybeSingle();
  if (!profile) fail('Profile not found after sign-in. Apply Supabase migrations first.');

  let hostelId = profile.hostel_id;

  if (!hostelId) {
    const { data: workspaceId, error: wsError } = await db.rpc('create_owner_workspace', {
      p_name: 'Sunrise Demo Hostel',
    });
    if (wsError) fail(`create_owner_workspace: ${wsError.message}`);
    hostelId = workspaceId;
    log(`Created workspace hostel: ${hostelId}`);
  } else {
    log(`Using existing hostel: ${hostelId}`);
  }

  await db
    .from('hostels')
    .update({
      name: 'Sunrise Demo Hostel',
      address: '42 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      billing_day: 5,
      voice_ai_provider: 'vapi',
    })
    .eq('id', hostelId);

  const { count: tenantCount } = await db
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('hostel_id', hostelId);

  if ((tenantCount ?? 0) >= 3) {
    log(`Hostel already has ${tenantCount} tenants — skipping sample inserts (idempotent).`);
    printSummary();
    return;
  }

  const { data: rooms, error: roomsError } = await db
    .from('rooms')
    .select('id')
    .eq('hostel_id', hostelId);

  if (roomsError) fail(roomsError.message);
  const roomIds = (rooms || []).map((r) => r.id);
  if (!roomIds.length) fail('No rooms in hostel. Run create_owner_workspace first.');

  const { data: vacantBeds, error: bedsError } = await db
    .from('beds')
    .select('id, room_id, bed_label')
    .in('room_id', roomIds)
    .eq('status', 'vacant')
    .limit(SAMPLE_TENANTS.length);

  if (bedsError) fail(bedsError.message);
  if (!vacantBeds?.length) fail('No vacant beds found to assign tenants.');

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  for (let i = 0; i < Math.min(SAMPLE_TENANTS.length, vacantBeds.length); i++) {
    const sample = SAMPLE_TENANTS[i];
    const bed = vacantBeds[i];

    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .insert({
        hostel_id: hostelId,
        full_name: sample.name,
        phone: sample.phone,
        email: `${sample.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        monthly_rent: sample.rent,
        security_deposit: sample.rent,
        rent_due_day: 5,
        status: 'active',
        assigned_bed_id: bed.id,
        agreement_start: now.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (tenantError) fail(`tenant ${sample.name}: ${tenantError.message}`);

    await db.from('beds').update({ status: 'occupied', tenant_id: tenant.id }).eq('id', bed.id);

    const roomId = bed.room_id;
    await db.from('rooms').update({ status: 'occupied' }).eq('id', roomId);

    const dueDate = new Date(Date.UTC(year, month - 1, 5));
    const invoiceNumber = `INV-${year}-${String(month).padStart(2, '0')}-${tenant.id.slice(0, 8)}`;

    let status = 'pending';
    let amountPaid = 0;
    if (i === 0) {
      status = 'paid';
      amountPaid = sample.rent;
    } else if (i === 1) {
      status = 'partial';
      amountPaid = Math.round(sample.rent * 0.4);
    } else if (i === 2) {
      status = 'overdue';
    }

    const { data: invoice, error: invError } = await db
      .from('invoices')
      .insert({
        hostel_id: hostelId,
        tenant_id: tenant.id,
        invoice_number: invoiceNumber,
        billing_month: month,
        billing_year: year,
        amount: sample.rent,
        amount_paid: amountPaid,
        due_date: dueDate.toISOString().split('T')[0],
        status,
        payment_link: `https://pay.hostelhub.test/${tenant.id.slice(0, 8)}`,
      })
      .select()
      .single();

    if (invError) fail(`invoice ${sample.name}: ${invError.message}`);

    if (amountPaid > 0) {
      await db.from('payments').insert({
        invoice_id: invoice.id,
        tenant_id: tenant.id,
        hostel_id: hostelId,
        amount: amountPaid,
        method: i === 0 ? 'upi' : 'cash',
        status: 'completed',
        recorded_by: signIn.user.id,
        notes: 'Demo seed payment',
      });
    }

    if (i === 2) {
      await db.from('ai_call_logs').insert({
        hostel_id: hostelId,
        tenant_id: tenant.id,
        invoice_id: invoice.id,
        call_status: 'promised_to_pay',
        provider: 'vapi',
        tenant_name: sample.name,
        amount_due: sample.rent - amountPaid,
        days_overdue: 12,
        payment_link: invoice.payment_link,
        promised_pay_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      });
    }

    if (i === 3) {
      await db.from('complaints').insert({
        hostel_id: hostelId,
        tenant_id: tenant.id,
        title: 'Water heater not working',
        description: 'No hot water since yesterday evening.',
        category: 'plumbing',
        status: 'open',
        priority: 'high',
      });
    }

    if (i === 4) {
      await db.from('maintenance_tasks').insert({
        hostel_id: hostelId,
        room_id: roomId,
        bed_id: bed.id,
        task_type: 'repair',
        status: 'pending',
        notes: 'Fix loose bed frame — demo task',
      });
      await db.from('rooms').update({ status: 'maintenance' }).eq('id', roomId);
    }

    log(`Added tenant: ${sample.name}`);
  }

  const { data: anyTenant } = await db.from('tenants').select('id, full_name').eq('hostel_id', hostelId).limit(1).maybeSingle();
  if (anyTenant) {
    await db.from('ai_call_logs').insert({
      hostel_id: hostelId,
      tenant_id: anyTenant.id,
      call_status: 'scheduled',
      provider: 'vapi',
      tenant_name: anyTenant.full_name,
      amount_due: 7500,
      days_overdue: 0,
    });
  }

  printSummary();

  function printSummary() {
    console.log('\n--- Demo login (use in the app) ---');
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log('URL:      http://localhost:3000/login');
    console.log('-----------------------------------\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
