# Architecture & Developer Guide — HostelHub

This document outlines the technical architecture, data model, state patterns, and guidelines for engineers developing or maintaining HostelHub.

---

## 1. System Overview

HostelHub is designed as a cloud-native, multi-tenant hostel operations platform. It allows single or multi-property owners to handle everyday operations:
- Room inventory & bed mapping
- Tenant lifecycle (onboarding, KYC, active lease, checkout)
- Automated & manual rent billing and cash collection
- Voice AI call logs for payment reminders
- Maintenance ticketing & room status synchronization
- Multi-hostel switching with zero context loss

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   Public Auth Pages   │       │  Protected Dashboard  │  │
│  │   /login, /signup     │       │  /app/* (AppShell)    │  │
│  └───────────────────────┘       └───────────────────────┘  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
       ┌───────────────┐              ┌────────────────┐
       │  AuthContext  │              │ useHostelScope │
       └───────┬───────┘              └────────┬───────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
               ┌───────────────────────────────┐
               │    Supabase Client (RLS)      │
               └───────────────┬───────────────┘
                               ▼
       ┌───────────────────────────────────────────────┐
       │              PostgreSQL Database              │
       │  • hostels        • floors      • rooms       │
       │  • beds           • tenants     • invoices    │
       │  • payments       • complaints  • maintenance │
       └───────────────────────────────────────────────┘
```

---

## 2. Directory Conventions

- `app/app/[feature]/page.tsx`: Each subfolder in `app/app/` represents an authenticated dashboard route.
- `components/ui/`: Atomic, reusable UI primitives (buttons, dialogs, inputs, sheets, badges, tabs, cards) powered by Radix UI and Tailwind CSS.
- `components/`: Composite, domain-specific components (`app-shell.tsx`, `hostel-switcher.tsx`, `no-hostel-linked.tsx`).
- `hooks/`: Custom stateful abstractions (`useHostelScope()`, `useToast()`).
- `lib/types.ts`: Central source of truth for TypeScript types. Whenever modifying database tables or introducing new fields, update this file first.
- `supabase/migrations/`: SQL migration files tracking database schema evolution.

---

## 3. State Management & Scoping Pattern

### Auth Context (`lib/auth-context.tsx`)
Provides the current authenticated Supabase user session and the user's `Profile` object.
```tsx
const { user, profile, loading, signOut, refreshProfile } = useAuth();
```

### Multi-Hostel Scoping (`hooks/use-hostel-scope.ts`)
Instead of each component independently fetching or storing the active hostel:
```tsx
export function useHostelScope() {
  const { profile, loading: authLoading } = useAuth();
  const hostelId = profile?.hostel_id ?? null;
  const isReady = !authLoading;
  const hasHostel = isReady && Boolean(hostelId);

  return { profile, hostelId, authLoading, isReady, hasHostel };
}
```

#### Best Practice for Feature Pages:
```tsx
export default function FeaturePage() {
  const { hostelId, isReady, hasHostel } = useHostelScope();

  useEffect(() => {
    if (!isReady || !hostelId) return;
    loadData(hostelId);
  }, [isReady, hostelId]);

  if (!isReady) return <LoadingSpinner />;
  if (!hasHostel) return <NoHostelLinked />;

  return <FeatureView />;
}
```

---

## 4. Database Schema & Key Relationships

### Core Hierarchy
```
Hostel (1) ───< Floors (N) ───< Rooms (N) ───< Beds (N)
   │
   ├───< Tenants (N)
   ├───< Invoices (N) ───< Payments (N)
   ├───< Maintenance Tasks (N)
   └───< AI Call Logs (N)
```

### Important Relational Note: `beds` and `tenants`
There is a dual relationship between `beds` and `tenants`:
1. `beds.tenant_id`: Specifies which tenant is currently assigned to a bed.
2. `tenants.assigned_bed_id`: Specifies which bed was allocated to the tenant.

When using Supabase `.select()` with embedded resources, PostgREST requires specifying the foreign key to avoid ambiguity:
```ts
// In rooms / inventory queries:
.select('*, beds(*, tenant:tenants!beds_tenant_id_fkey(*)), floor:floors(*)')
```

---

## 5. Security & Access Control (RLS)

Every table has Row-Level Security enabled. The core security principles enforced in `supabase/migrations/` are:
1. **Hostel Owner Access**: Owners can read and modify all data where `hostel_id` matches any hostel where `owner_id = auth.uid()`.
2. **Profile Isolation**: Users can only update their own profile records.
3. **Storage Security**: KYC document uploads are restricted to the authenticated user's folder (`/kyc-documents/{user_id}/*`).

---

## 6. How to Add New Features

### Adding a New Dashboard Page
1. Create `app/app/[feature-name]/page.tsx`.
2. Use `useHostelScope()` to scope queries to `hostelId`.
3. Add the route and Lucide icon to `NAV_ITEMS` in [components/app-shell.tsx](file:///c:/Users/Admin/OneDrive/Desktop/project/components/app-shell.tsx).
4. Run `npm run typecheck` to verify no typing or compilation conflicts.

### Adding New Database Entities
1. Write a new SQL migration in `supabase/migrations/<timestamp>_<description>.sql`.
2. Add the corresponding TypeScript interface in [lib/types.ts](file:///c:/Users/Admin/OneDrive/Desktop/project/lib/types.ts).
3. Ensure RLS policies are attached to the new table.

---

## 7. Production Readiness Checklist

- [x] TypeScript compiler passes cleanly (`tsc --noEmit` exit code 0).
- [x] Next.js production build completes cleanly (`next build` generates 13/13 static pages).
- [x] Responsive layout tested for desktop, tablet, and mobile breakpoints.
- [x] Zero hardcoded secrets (all configuration is read via environment variables).
- [x] Color-coded visual gradings (overdue, clear, vacant, maintenance) are applied consistently.
- [x] Multi-hostel context switcher seamlessly updates UI across all views without logout.
- [x] Super Admin Command Center deployed with multi-hostel revenue, transaction ledgers, and subdomain routing.

---

## 8. Super Admin Command Center & Subdomain Architecture

HostelHub features a dedicated platform administration portal (`/admin/*`) running on an isolated subdomain (`admin.hostelhub.app` / `admin.localhost:3000`) while connecting directly to the same unified PostgreSQL database:

```
                  ┌──────────────────────────────────────────────┐
                  │                 Next.js Edge                 │
                  │                middleware.ts                 │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
            Host: admin.*│                                │Host: default / localhost
                         ▼                                ▼
              ┌──────────────────────┐        ┌──────────────────────┐
              │  Super Admin Portal  │        │Hostel Manager Portal │
              │      app/admin/*     │        │       app/app/*      │
              │   (Global Oversight) │        │ (Single Property Ops)│
              └──────────┬───────────┘        └──────────┬───────────┘
                         │                               │
                         └───────────────┬───────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │      PostgreSQL (Supabase)    │
                         │    Live Shared Persistence    │
                         └───────────────────────────────┘
```

### Key Modules:
- **`app/admin/dashboard`**: Executive KPI matrix (Platform Revenue, Global Occupancy, Active Network, Live Payment Feed).
- **`app/admin/hostels`**: Property CRUD, structural inspection, capacity, and city filters.
- **`app/admin/payments`**: System-wide payment ledger with CSV export and cross-hostel manual payment recording.
- **`app/admin/revenue`**: Collection leaderboard, overdue receivables aging, and dynamic commission model calculator.
- **`app/admin/tenants`**: Unified resident roster, KYC proof status, and automated voice reminder controls.
- **`app/admin/users`**: Platform profile directory, privilege assignments (`super_admin`, `hostel_owner`, `caretaker`, `tenant`).
- **`app/admin/operations`**: Autonomous AI phone call logs, cross-hostel maintenance tickets, and platform broadcast broadcaster.
- **`app/admin/settings`**: Subdomain DNS documentation, middleware configuration, and platform fee rates.

