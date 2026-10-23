/**
 * Fix and reseed HostelHub demo data
 * Usage: node scripts/fix-and-reseed.mjs
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

function log(msg) { console.log(`[seed] ${msg}`); }
function fail(msg) { console.error(`[seed] ERROR: ${msg}`); process.exit(1); }

if (!url || !anonKey) fail('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');

async function main() {
  const admin = serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Sign in
  const { data: signIn, error: loginError } = await authClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (loginError || !signIn.session) fail(loginError?.message || 'Could not sign in as demo user');
  log(`Signed in as ${DEMO_EMAIL}`);

  const db = authClient;
  const userId = signIn.user.id;

  // Get profile
  const { data: profile } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!profile) fail('Profile not found');

  const hostelId = profile.hostel_id;
  if (!hostelId) fail('No hostel linked to profile. Run seed-demo-data.mjs first.');

  log(`Working with hostel: ${hostelId}`);

  // Update hostel info
  await db.from('hostels').update({
    name: 'Sunrise Demo Hostel',
    address: '42 MG Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    billing_day: 5,
  }).eq('id', hostelId);

  // Get existing floors
  const { data: existingFloors } = await db.from('floors').select('*').eq('hostel_id', hostelId).order('floor_number');
  log(`Found ${existingFloors?.length || 0} existing floors`);

  // Get existing rooms
  const { data: existingRooms } = await db.from('rooms').select('*, beds(*)').eq('hostel_id', hostelId).order('room_number');
  log(`Found ${existingRooms?.length || 0} existing rooms`);

  // If we already have rooms, just fix them
  let floors = existingFloors || [];
  let rooms = existingRooms || [];

  // Create floors if not enough
  if (floors.length < 3) {
    log('Creating floors...');
    const floorDefs = [
      { hostel_id: hostelId, floor_number: 1, name: 'Ground Floor' },
      { hostel_id: hostelId, floor_number: 2, name: 'First Floor' },
      { hostel_id: hostelId, floor_number: 3, name: 'Second Floor' },
    ];
    for (const floorDef of floorDefs) {
      const existing = floors.find(f => f.floor_number === floorDef.floor_number);
      if (!existing) {
        const { data: newFloor } = await db.from('floors').insert(floorDef).select().single();
        if (newFloor) floors.push(newFloor);
      }
    }
    const { data: updatedFloors } = await db.from('floors').select('*').eq('hostel_id', hostelId).order('floor_number');
    floors = updatedFloors || floors;
    log(`Floors after creation: ${floors.length}`);
  }

  // Define room structure: 4 rooms per floor, mixed types
  const ROOM_DEFS = [
    // Ground Floor
    { room_number: '101', room_type: 'single', capacity: 1, monthly_rent: 12000 },
    { room_number: '102', room_type: 'double', capacity: 2, monthly_rent: 8000 },
    { room_number: '103', room_type: 'triple', capacity: 3, monthly_rent: 6000 },
    { room_number: '104', room_type: 'double', capacity: 2, monthly_rent: 8000 },
    // First Floor
    { room_number: '201', room_type: 'single', capacity: 1, monthly_rent: 11000 },
    { room_number: '202', room_type: 'double', capacity: 2, monthly_rent: 7500 },
    { room_number: '203', room_type: 'triple', capacity: 3, monthly_rent: 5500 },
    { room_number: '204', room_type: 'double', capacity: 2, monthly_rent: 7500 },
    // Second Floor
    { room_number: '301', room_type: 'double', capacity: 2, monthly_rent: 7000 },
    { room_number: '302', room_type: 'triple', capacity: 3, monthly_rent: 5000 },
    { room_number: '303', room_type: 'double', capacity: 2, monthly_rent: 7000 },
    { room_number: '304', room_type: 'triple', capacity: 3, monthly_rent: 5000 },
  ];

  const getFloorForRoom = (room_number) => {
    const floorNum = Math.floor(parseInt(room_number) / 100);
    return floors.find(f => f.floor_number === floorNum);
  };

  // Create missing rooms
  if (rooms.length < ROOM_DEFS.length) {
    log('Creating rooms...');
    for (const roomDef of ROOM_DEFS) {
      const existing = rooms.find(r => r.room_number === roomDef.room_number);
      if (!existing) {
        const floor = getFloorForRoom(roomDef.room_number);
        const { data: newRoom, error: roomErr } = await db.from('rooms').insert({
          hostel_id: hostelId,
          floor_id: floor?.id || null,
          room_number: roomDef.room_number,
          room_type: roomDef.room_type,
          capacity: roomDef.capacity,
          monthly_rent: roomDef.monthly_rent,
          status: 'vacant',
        }).select().single();
        if (roomErr) { log(`Room ${roomDef.room_number} error: ${roomErr.message}`); continue; }
        rooms.push({ ...newRoom, beds: [] });
      } else if (!existing.floor_id) {
        // Fix floor_id
        const floor = getFloorForRoom(roomDef.room_number);
        if (floor) {
          await db.from('rooms').update({ floor_id: floor.id }).eq('id', existing.id);
          existing.floor_id = floor.id;
        }
      }
    }
  }

  // Reload rooms with beds
  const { data: allRooms } = await db.from('rooms').select('*, beds(*)').eq('hostel_id', hostelId).order('room_number');
  rooms = allRooms || [];
  log(`Total rooms: ${rooms.length}`);

  // Create beds for rooms that don't have them
  for (const room of rooms) {
    const existingBeds = room.beds || [];
    const roomDef = ROOM_DEFS.find(r => r.room_number === room.room_number);
    const capacity = roomDef?.capacity || room.capacity;

    if (existingBeds.length < capacity) {
      log(`Creating beds for room ${room.room_number}...`);
      for (let b = existingBeds.length + 1; b <= capacity; b++) {
        const bedLabel = `${room.room_number}-B${b}`;
        const existingBed = existingBeds.find(bed => bed.bed_label === bedLabel);
        if (!existingBed) {
          await db.from('beds').insert({
            room_id: room.id,
            bed_label: bedLabel,
            status: 'vacant',
          });
        }
      }
    }
  }

  // Reload rooms with beds again
  const { data: finalRooms } = await db.from('rooms').select('*, beds(*)').eq('hostel_id', hostelId).order('room_number');
  rooms = finalRooms || [];

  // Check tenant count
  const { data: existingTenants } = await db.from('tenants').select('*').eq('hostel_id', hostelId);
  const tenants = existingTenants || [];
  log(`Existing tenants: ${tenants.length}`);

  // Gather all vacant beds
  const vacantBeds = [];
  for (const room of rooms) {
    for (const bed of (room.beds || [])) {
      if (bed.status === 'vacant') {
        vacantBeds.push({ ...bed, room });
      }
    }
  }
  log(`Available vacant beds: ${vacantBeds.length}`);

  // Sample tenants to add (top up to 8 total)
  const SAMPLE_TENANTS = [
    { name: 'Arjun Mehta', phone: '+919876543210', email: 'arjun.mehta@example.com', rent: 9000, invoiceStatus: 'paid' },
    { name: 'Priya Sharma', phone: '+919876543211', email: 'priya.sharma@example.com', rent: 7500, invoiceStatus: 'partial' },
    { name: 'Rahul Verma', phone: '+919876543212', email: 'rahul.verma@example.com', rent: 7500, invoiceStatus: 'overdue' },
    { name: 'Sneha Iyer', phone: '+919876543213', email: 'sneha.iyer@example.com', rent: 9000, invoiceStatus: 'pending' },
    { name: 'Karan Singh', phone: '+919876543214', email: 'karan.singh@example.com', rent: 7500, invoiceStatus: 'pending' },
    { name: 'Ananya Das', phone: '+919876543215', email: 'ananya.das@example.com', rent: 9000, invoiceStatus: 'paid' },
    { name: 'Vikram Nair', phone: '+919876543216', email: 'vikram.nair@example.com', rent: 6000, invoiceStatus: 'pending' },
    { name: 'Deepika Roy', phone: '+919876543217', email: 'deepika.roy@example.com', rent: 8000, invoiceStatus: 'partial' },
  ];

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  let bedIdx = 0;
  for (let i = 0; i < SAMPLE_TENANTS.length; i++) {
    const sample = SAMPLE_TENANTS[i];
    
    // Check if tenant already exists
    const existing = tenants.find(t => t.phone === sample.phone);
    if (existing) {
      log(`Tenant ${sample.name} already exists, skipping`);
      continue;
    }

    if (bedIdx >= vacantBeds.length) {
      log(`No more vacant beds, stopping at ${i} tenants`);
      break;
    }

    const bed = vacantBeds[bedIdx++];
    const { data: tenant, error: tenantError } = await db.from('tenants').insert({
      hostel_id: hostelId,
      full_name: sample.name,
      phone: sample.phone,
      email: sample.email,
      monthly_rent: sample.rent,
      security_deposit: sample.rent * 2,
      rent_due_day: 5,
      status: 'active',
      assigned_bed_id: bed.id,
      agreement_start: now.toISOString().split('T')[0],
      id_proof_type: 'aadhaar',
    }).select().single();

    if (tenantError) { log(`Tenant ${sample.name} error: ${tenantError.message}`); continue; }

    // Mark bed occupied
    await db.from('beds').update({ status: 'occupied', tenant_id: tenant.id }).eq('id', bed.id);
    // Mark room occupied
    await db.from('rooms').update({ status: 'occupied' }).eq('id', bed.room.id);

    // Create invoice
    const dueDate = new Date(Date.UTC(year, month - 1, 5));
    const invoiceNumber = `INV-${year}-${String(month).padStart(2, '0')}-${tenant.id.slice(0, 8)}`;
    let amountPaid = 0;
    let invStatus = sample.invoiceStatus;
    if (invStatus === 'paid') amountPaid = sample.rent;
    else if (invStatus === 'partial') amountPaid = Math.round(sample.rent * 0.4);

    const { data: invoice } = await db.from('invoices').insert({
      hostel_id: hostelId,
      tenant_id: tenant.id,
      invoice_number: invoiceNumber,
      billing_month: month,
      billing_year: year,
      amount: sample.rent,
      amount_paid: amountPaid,
      due_date: dueDate.toISOString().split('T')[0],
      status: invStatus,
    }).select().single();

    if (amountPaid > 0 && invoice) {
      await db.from('payments').insert({
        invoice_id: invoice.id,
        tenant_id: tenant.id,
        hostel_id: hostelId,
        amount: amountPaid,
        method: i % 2 === 0 ? 'upi' : 'cash',
        status: 'completed',
        recorded_by: userId,
        notes: 'Demo seed payment',
      });
    }

    if (invStatus === 'overdue' && invoice) {
      await db.from('ai_call_logs').insert({
        hostel_id: hostelId,
        tenant_id: tenant.id,
        invoice_id: invoice.id,
        call_status: 'promised_to_pay',
        provider: 'vapi',
        tenant_name: sample.name,
        amount_due: sample.rent - amountPaid,
        days_overdue: 12,
        promised_pay_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      });
    }

    log(`Added tenant: ${sample.name} → Room ${bed.room.room_number}, Bed ${bed.bed_label}`);
  }

  // Add a maintenance task if none exist
  const { data: existingMaint } = await db.from('maintenance_tasks').select('id').eq('hostel_id', hostelId).limit(1);
  if (!existingMaint?.length) {
    const maintenanceRoom = rooms.find(r => r.room_number === '104') || rooms[rooms.length - 1];
    if (maintenanceRoom) {
      await db.from('maintenance_tasks').insert({
        hostel_id: hostelId,
        room_id: maintenanceRoom.id,
        task_type: 'repair',
        status: 'pending',
        notes: 'Fix plumbing — water leakage in bathroom',
      });
      await db.from('rooms').update({ status: 'maintenance' }).eq('id', maintenanceRoom.id);
      log(`Added maintenance task for room ${maintenanceRoom.room_number}`);
    }
  }

  // Reload and print summary
  const { data: finalTenants } = await db.from('tenants').select('id').eq('hostel_id', hostelId);
  const { data: finalRoomsCheck } = await db.from('rooms').select('id, status').eq('hostel_id', hostelId);
  const { data: finalBeds } = await db.from('beds').select('id, status').in('room_id', (finalRoomsCheck || []).map(r => r.id));
  const { data: finalInvoices } = await db.from('invoices').select('id, status, amount, amount_paid').eq('hostel_id', hostelId);

  const totalRevenue = (finalInvoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount_paid), 0);
  const pendingDues = (finalInvoices || []).filter(i => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);

  console.log('\n=== RESEED COMPLETE ===');
  console.log(`Hostel: Sunrise Demo Hostel (${hostelId})`);
  console.log(`Floors: ${floors.length}`);
  console.log(`Rooms: ${finalRoomsCheck?.length || 0} (${finalRoomsCheck?.filter(r => r.status === 'occupied').length} occupied, ${finalRoomsCheck?.filter(r => r.status === 'vacant').length} vacant)`);
  console.log(`Beds: ${finalBeds?.length || 0} (${finalBeds?.filter(b => b.status === 'occupied').length} occupied)`);
  console.log(`Tenants: ${finalTenants?.length || 0}`);
  console.log(`Revenue collected: ₹${totalRevenue.toLocaleString('en-IN')}`);
  console.log(`Pending dues: ₹${pendingDues.toLocaleString('en-IN')}`);
  console.log('\n--- Login Credentials ---');
  console.log(`Email:    ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`URL:      http://localhost:3000/login`);
  console.log('-------------------------\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
