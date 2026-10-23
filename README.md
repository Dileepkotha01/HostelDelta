# HostelHub — Intelligent Hostel Management Platform

A modern, full-featured Hostel Management System built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL + RLS)**. Designed for hostel owners, caretakers, and property managers to manage multi-hostel properties, room allocations, tenant agreements, payments, KYC verification, voice AI calls, and maintenance tasks.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or pnpm
- A Supabase project (or local Supabase instance)

### 2. Create and connect a Supabase project
For the quickest local test, create a Supabase cloud project at [supabase.com/dashboard](https://supabase.com/dashboard). In the project dashboard:

1. Open **Project Settings → API** (or **API Keys**, depending on the dashboard version).
2. Copy the **Project URL** and the public **anon** key (sometimes labelled `publishable`) into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`. These two values are used by the browser.
3. Copy the private **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` for server-side hostel setup and other privileged server features. Keep it private; never prefix it with `NEXT_PUBLIC_` or put it in browser code.

Run these commands from the project folder in Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
```

Open `.env` in VS Code, paste the Supabase values, save it, and restart the dev server whenever you change environment variables. Do not share or commit `.env`.

### 3. Create the database schema
Apply every SQL migration in `supabase/migrations/` to the project in filename order:

For a first-time setup, open **Supabase Dashboard → SQL Editor**, create a query, open each migration file in VS Code, and run its complete contents in ascending filename order. Wait for each migration to succeed before running the next. This creates the tables, row-level security policies, and signup profile trigger required by the app. Hostel workspaces are created manually from the Add Hostel form. If you already ran the original migrations, apply any newer migration files that were added afterward, in filename order. Do not rerun migrations on a database that already has them applied.

The Add Hostel form saves property name, address, city, state, contact phone/email, optional GSTIN, amenities, and food notes/details. It also creates floor records, room numbers, sharing capacity, monthly rent, and a vacant bed record for each capacity slot. Apply `20261014000000_add_hostel_contact_and_tax_fields.sql` to existing databases before using the form; it adds the property contact and GSTIN columns. Apply `20261014010000_disable_automatic_owner_workspace.sql` to remove the old automatic demo workspace function.

**Do not also run `supabase/init.sql`.** It is a standalone schema snapshot, not an additional migration, and does not contain all of the latest migration logic. Use the ordered migration files as the source of truth for a new local project. If you already ran `init.sql` on a project, do not blindly rerun it or assume all later migrations are applied; use a clean development project for the simplest setup, or review the schema carefully before applying migrations.

### 4. Configure Supabase Auth for local testing
In **Authentication → URL Configuration** set:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/auth/callback`

Start by testing email/password signup and login from the app. If email confirmation is enabled, follow the confirmation link sent by Supabase; for local testing, that link must return to `http://localhost:3000/auth/callback`.

When signup returns without a session, the account may be waiting for email confirmation. Check **Authentication → Users** and the email inbox/spam folder before submitting the same address again; repeated attempts can hit Supabase's email send limit. If signup returns HTTP 502, 503, or 504, the result is uncertain: check for a pending user before retrying, and inspect Supabase Auth and Postgres logs if no user appears. With custom SMTP disabled, Supabase uses its built-in email service, which has strict delivery and rate limits and is not intended for reliable public production signup. Custom SMTP is needed for dependable confirmation-email delivery at scale; app-level `SMTP_*` variables do not configure Supabase Auth email.

Google login and phone OTP are optional provider setups. To enable Google, configure Google under **Authentication → Providers → Google**, then add the OAuth callback URL shown by Supabase to the authorized redirect URIs in Google Cloud Console. For phone OTP, enable the Phone provider and configure an SMS provider/template in Supabase. These providers cannot send real Google callbacks or SMS until their provider credentials are set.

The public signup form cannot grant super-admin access. To create an administrator, first create/confirm the chosen user in Supabase Auth and set a strong, unique password there. Then grant that exact account an active `super_admin` profile in the Supabase SQL Editor. Replace `admin@example.com` below with the same email used for the Auth user:

```sql
UPDATE public.profiles AS p
SET role = 'super_admin',
    active = true
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('admin@example.com')
RETURNING p.id, p.email, p.role, p.active;
```

The query must return the account with `role = super_admin` and `active = true`. Then sign in at `http://localhost:3000/admin/login` using that Auth email and password. The portal authorizes active profiles by role, not by a hard-coded email. Never add a public super-admin signup flow. Any password shared in chat or source code should be considered exposed and replaced before use.

### 5. Run locally
From the project folder:

```powershell
npm run dev
```

Use `http://localhost:3000` for the marketing homepage. Local portals are path-based on that same origin:

- Manager login: `http://localhost:3000/login`
- Manager signup: `http://localhost:3000/signup`
- Super-admin login: `http://localhost:3000/admin/login`

Sign up with your own email first. The database trigger provisions the account profile only. A hostel, floors, rooms, and beds are created only after you complete and submit the Add Hostel form. The demo credentials below are only available after you have successfully run the optional demo seeder.

### 6. Optional local demo data
To seed demo records, configure `SUPABASE_SERVICE_ROLE_KEY` and the Supabase URL/public key in `.env`, then run:

```powershell
npm run seed:reseed
```

This writes demo data to the Supabase project configured in `.env`; use a separate development project, never your production database.

### 7. Production subdomains (after local testing)
The production hostnames are the marketing site at `https://kupera.in`, the manager portal at `https://app.kupera.in`, and the super-admin portal at `https://admin.kupera.in`. Set the `NEXT_PUBLIC_*URL` values in the deployment environment to those production origins, configure DNS/TLS for all three hostnames with your host, and add each deployed `/auth/callback` URL to Supabase Auth's allowed redirect URLs. Configure matching provider callback settings for Google.

Razorpay collection is separate from local login testing. Tenant rent collection requires a configured `payment.captured` webhook and a verified Route linked account for each hostel. The app intentionally blocks rent collection and does not accept or store bank details until provider onboarding is complete.

Hostel owners can choose either automatic monthly billing or a one-time **₹1,499 / 30-day** payment. Automatic billing requires a monthly INR ₹1,499 Razorpay plan configured as `RAZORPAY_HOSTEL_SUBSCRIPTION_PLAN_ID`; it starts with a 30-day free trial and then renews monthly using a Razorpay-supported mandate method. One-time payments use Razorpay standard checkout and expose the payment methods enabled for the Razorpay account; no recurring mandate is created, and the owner must manually renew after 30 days. Owners can manage each hostel's subscription, access period, latest payment reference, manual renewal, and end-of-period autopay cancellation from **Billing** in the owner portal. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. The public key ID is returned securely by the server; if you also set `NEXT_PUBLIC_RAZORPAY_KEY_ID`, it must match `RAZORPAY_KEY_ID`. Point the Razorpay webhook to `/api/webhooks/razorpay` and enable the `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, and `subscription.completed` events. Apply all migrations in ascending filename order, including `20261015010000_add_hostel_owner_subscriptions.sql`, `20261015020000_add_hostel_onboarding_drafts.sql`, `20261016010000_add_manual_hostel_billing.sql`, `20261016030000_hostel_owner_billing_portal.sql`, and `20261017000000_enforce_billing_and_harden_rls.sql`, before testing billing. Set `SIGNED_LINK_SECRET` for tenant pay/view links. Edge Functions `ai-voice-trigger` and `billing-cron` require `Authorization: Bearer $CRON_SECRET`. Do not use `supabase/functions/payment-webhook`; Razorpay must POST only to `/api/webhooks/razorpay`. An onboarding draft creates a saved hostel workspace and inventory before checkout; pending hostels remain locked until payment is verified. Owners can resume payment from the dashboard or Billing page without re-entering setup details. Creating or paying for another hostel does not switch the active hostel; the owner must select it from the hostel switcher. Payment processing, failure, and success email notifications use the configured `SMTP_*` settings. Configure `CRON_SECRET` to enable expiry reminders and access enforcement. Test both checkout modes with Razorpay test-mode keys and plan before switching to live credentials.

Leave payment, SMTP, and cron secrets blank unless configuring those services. Supabase Edge Function secrets are configured separately in the Supabase CLI or Dashboard. Never use a service-role key in browser code.

---

## 📁 Repository Structure

```
├── app/                        # Next.js 13+ App Router
│   ├── app/                    # Authenticated workspace (/app/*)
│   │   ├── dashboard/          # Key metrics, revenue charts, urgent alerts
│   │   ├── rooms/              # Floor-by-floor visual room matrix & bed allocation
│   │   ├── tenants/            # Tenant registry, onboarding, agreements, KYC
│   │   ├── payments/           # Invoicing, dues tracking, cash recording, receipts
│   │   ├── ai-calls/           # Automated voice collection logs & tenant call controls
│   │   ├── maintenance/        # Maintenance request ticketing & assignment
│   │   ├── settings/           # Hostel profile, owner details, theme, security
│   │   └── layout.tsx          # Authenticated AppShell wrapper
│   ├── login/                  # User authentication (sign-in)
│   ├── signup/                 # Owner registration & hostel onboarding
│   ├── auth/callback/          # Supabase OAuth/email verification callback
│   ├── globals.css             # Tailwind & design token configurations
│   └── layout.tsx              # Root layout & providers (Auth, Theme, Toaster)
│
├── components/                 # Reusable UI Components
│   ├── ui/                     # Design system primitives (Radix UI + Tailwind)
│   ├── app-shell.tsx           # Responsive sidebar, header, navigation, & mobile nav
│   ├── hostel-switcher.tsx     # Instant multi-hostel switcher (no re-login required)
│   ├── no-hostel-linked.tsx    # Empty state for unlinked owner workspaces
│   └── sw-register.tsx         # Progressive Web App service worker registration
│
├── hooks/                      # Custom React Hooks
│   ├── use-hostel-scope.ts     # Central hostel context provider for scoped queries
│   └── use-toast.ts            # Toast notification management
│
├── lib/                        # Core Utilities & Configuration
│   ├── auth-context.tsx        # Supabase authentication provider & session state
│   ├── theme-provider.tsx     # Dark/Light mode theme state
│   ├── types.ts                # TypeScript domain models and relational types
│   ├── utils.ts                # CSS class merger (`cn`)
│   └── supabase/
│       ├── client.ts           # Browser-side Supabase client with auth session
│       └── server.ts           # Server-side Supabase client
│
├── scripts/                    # Maintenance & Seeding Scripts
│   ├── fix-and-reseed.mjs      # Complete demo data generation script
│   └── seed-demo-data.mjs      # Minimal bootstrap seed script
│
└── supabase/
    └── migrations/             # SQL Migrations (Tables, Triggers, RLS Policies, RPC)
        ├── 20261001091249_hostel_management_schema.sql
        ├── 20261001094517_harden_hostel_access_controls.sql
        ├── 20261001100709_create_owner_workspace_setup.sql
        ├── 20261007_razorpay_payment_engine.sql
        ├── 20261012180000_harden_auth_profile_provisioning.sql
        └── 20261013120000_secure_rent_payment_processing.sql
```

---

## 🏗️ Architectural Core Concepts

### 1. Multi-Hostel Context Scoping (`useHostelScope`)
Owners can operate multiple hostels under one account. Rather than managing hostel IDs manually in each component:
- The active hostel is stored in `profile.hostel_id`.
- The [useHostelScope()](file:///c:/Users/Admin/OneDrive/Desktop/project/hooks/use-hostel-scope.ts) hook provides `{ hostelId, profile, isReady, hasHostel }`.
- When switching hostels via [HostelSwitcher](file:///c:/Users/Admin/OneDrive/Desktop/project/components/hostel-switcher.tsx), `profile.hostel_id` updates in Supabase and the active page instantly re-fetches data for the selected property.

### 2. Relational Disambiguation in PostgREST
The `beds` and `tenants` tables share two foreign key relationships:
1. `beds.tenant_id` → `tenants.id` (Who is occupying this bed)
2. `tenants.assigned_bed_id` → `beds.id` (Which bed is assigned to this tenant)

When joining tenants from the `rooms -> beds` path in Supabase queries, always specify the foreign key constraint:
```ts
// ✅ Correct (disambiguated relation):
supabase.from('rooms').select('*, beds(*, tenant:tenants!beds_tenant_id_fkey(*)), floor:floors(*)')

// ❌ Incorrect (will trigger PGRST201 ambiguity error):
supabase.from('rooms').select('*, beds(*, tenant:tenants(*)), floor:floors(*)')
```

### 3. Row-Level Security (RLS)
All database tables enforce PostgreSQL Row-Level Security:
- Hostel owners can only query/mutate data belonging to their owned hostels (`hostel_id = profile.hostel_id`).
- Caretakers and wardens only have operational access to their assigned hostels.
- Sensitive financial transactions and invoices are strictly isolated per property.

---

## 🛠️ Developer Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Compile optimized production build |
| `npm run typecheck` | Run TypeScript compiler checks without emitting files (`tsc --noEmit`) |
| `npm run lint` | Run ESLint validation |
| `npm run seed:reseed` | Re-seed all floors, rooms, beds, tenants, and payment records |

---

---

## ☁️ Deploying to Cloudflare Pages & Supabase

HostelHub is pre-configured for deployment with **Cloudflare Pages** (frontend CDN) and **Supabase** (backend DB, Auth & Storage):

### Step 1: Backend Deployment (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase and run the migrations in [supabase/migrations/](file:///c:/Users/Admin/OneDrive/Desktop/project/supabase/migrations) in order:
   - `20261001091249_hostel_management_schema.sql`
   - `20261001094517_harden_hostel_access_controls.sql`
   - `20261001100709_create_owner_workspace_setup.sql`
   - `20261007_razorpay_payment_engine.sql`
   - `20261012180000_harden_auth_profile_provisioning.sql`
   - `20261013120000_secure_rent_payment_processing.sql`
3. In **Storage**, create a bucket named `kyc-documents` (private, with file size limit ~10MB).
4. Run the seed script to populate initial demo data if needed:
   ```bash
   npm run seed:reseed
   ```

### Step 2: Frontend Deployment (Cloudflare Pages)
1. Push this repository to your GitHub or GitLab.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/):
   - Go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
   - Select your repository.
3. Configure Build Settings:
   - **Framework preset**: `None` or `Next.js (Static HTML Export)`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
4. Set Environment Variables in Cloudflare Pages:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase public anonymous key
   - `NODE_VERSION`: `20.10.0`
5. Click **Save and Deploy**. Cloudflare will build and distribute the app across its global edge network.

### Step 3: Configure Auth Redirect URL in Supabase
In your Supabase project under **Authentication** -> **URL Configuration**:
- Set **Site URL** to your production root domain.
- Add the production root, manager, and admin origins with `/auth/callback` to **Redirect URLs** (for example `https://kupera.in/auth/callback`, `https://app.kupera.in/auth/callback`, and `https://admin.kupera.in/auth/callback`).
- Add the matching localhost callback URL for local development.

### Step 4: Enable production authentication providers
- Apply every migration in `supabase/migrations/` in order, including `20261012180000_harden_auth_profile_provisioning.sql`. It creates/repairs each user's profile from Supabase Auth.
- Under **Authentication** -> **Providers**, enable Google and configure its OAuth client. In Google Cloud, allow Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`); add the app callback origins above to Supabase's redirect allowlist.
- Enable Phone authentication and configure a production SMS provider in Supabase. SMS signup/login expects an E.164 phone number (for example `+919876543210`). The login screen only sends OTPs to existing phone-auth users; create a phone account through **Sign up with mobile OTP**.
- The phone field on email/password signup is contact information, not a verified Supabase Auth phone identity. Users who need mobile OTP login should use mobile OTP signup or verify/link a phone through a trusted account-management flow.
- Keep email confirmation enabled in production and configure the Supabase email templates to preserve the `{{ .ConfirmationURL }}` link. It returns to `/auth/callback` to finish profile/workspace setup.

Super Admin accounts must not have public signup. Create or verify the user's Auth account through a trusted administrator process, then grant the role in the Supabase SQL Editor using the exact account email:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'admin@example.com'
);
```

The Auth profile trigger intentionally ignores `super_admin` signup metadata. Do not expose service-role credentials or role assignment to the browser.
