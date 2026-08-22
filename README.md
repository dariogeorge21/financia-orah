# Orah Financia

> **Orah Financia** is the premium financial management dashboard and command center for **Orah – Campus Meet 2026**, an event organized by **Jesus Youth Pala Missionaries**.

Designed with rich visual aesthetics, a clean dark/light mode system, and smooth interactions, this application provides event coordinators, treasurers, and volunteers with real-time financial tracking, budget control, and auditing.

---

## 🚀 Key Modules & Features

### 📊 1. Command Center (Dashboard)
- **Net Position Summary**: Real-time KPI cards showcasing current physical **Cash Available**, **UPI/Digital Balance**, and overall **Total Funds Received**.
- **Visual Analytics**: Interactive bar charts and pie charts powered by `Recharts` showing breakdowns of income by category/type and expenses by ministry.
- **Recent Stream**: Quick-glance list of the latest income and expense transactions.

### 🤝 2. Personal Commitments (`PCOM`)
- Tracks financial pledges made by individuals.
- Monitors promised amount vs. actual received amount.
- Displays statuses: `Pending`, `Partially Received`, `Fully Received`, or `Cancelled`.

### 📞 3. Finance Calls (`FC`)
- Dedicated workflow for telephone fundraising campaigns.
- Logs caller name (volunteer), target contact details, promised pledges, and received contributions.

### 💰 4. Income Tracker
- Categorized income logs: *Registrations, Donations, Personal Commitments, Finance Calls, Coupons, Church offerings, Sponsors, and others*.
- Payment method logging (`Cash` or `UPI`).
- Automated database relationship mapping to update the respective commitment or call records when a transaction is added.

### 💸 5. Expense Management
- Robust tracking of expenses by category (e.g., Food, Logistics, Venue, Sound) and ministry teams.
- Flags payments as paid from `Personal` or `Event` funds.
- Supports attachment of receipt links/proofs, and status verification controls (`Pending`, `Approved`, `Rejected`).

### 🎯 6. Budget Controller
- Pre-plan budget limits for each event category.
- Real-time comparison of planned budgets vs. actual accumulated expenses.
- Colored progress indicators warning when categories approach or exceed their limits.

### 🔄 7. Reimbursement Manager (`REIM`)
- Tracks personal money spent by team members for event requirements.
- Simplifies payouts, monitoring whether claims are `Pending` or `Paid`.

---

## 🛠 Tech Stack

- **Frontend**: [Next.js 16 (App Router)](https://nextjs.org/) & [React 19](https://react.dev/)
- **Database & Authentication**: [Supabase](https://supabase.com/) (PostgreSQL with Row-Level Security policies)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [next-themes](https://github.com/pacocoursey/next-themes) (System-aware Dark Mode)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) & [Base UI](https://base-ui.com/)
- **Visualizations**: [Recharts](https://recharts.org/)
- **Icons**: [Hugeicons React](https://hugeicons.com/)

---

## 📂 Project Structure

```
├── app/                  # Next.js App Router (Layouts, Pages, APIs)
│   ├── (app)/            # Authenticated App Routes (Dashboard, Income, Expenses, etc.)
│   ├── login/            # Sign-in route
│   └── globals.css       # Global styles & Tailwind CSS v4 setup
├── components/           # Reusable UI & Layout Components
│   ├── ui/               # shadcn/ui base elements (Button, Card, Dialog, etc.)
│   └── finance/          # Application-specific UI components (KpiCard, Sidebar, etc.)
├── features/             # Feature-specific state, actions, APIs, and forms
│   ├── budget/
│   ├── commitments/
│   ├── expenses/
│   ├── finance-calls/
│   ├── income/
│   ├── personal-commitments/
│   └── reimbursements/
├── lib/                  # Helper utilities, calculations, database clients
├── public/               # Static assets (logos, manifest, PWA icons)
└── supabase/             # Database initialization and SQL migrations
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- Node.js (v18.x or later)
- NPM or PNPM
- A Supabase project instance

### 2. Environment Variables
Create a `.env` file (or `.env.local`) in the root directory and populate it with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Migration
Apply the PostgreSQL schema to your Supabase project. You can paste the contents of [20260822000000_orah_financia_init.sql](file:///d:/VS%20CODE/jy-pala-missionaries/orah-financia/supabase/migrations/20260822000000_orah_financia_init.sql) into the **SQL Editor** on the Supabase Dashboard, or run:
```bash
npx supabase db push
```

### 4. Installation & Start
Install dependencies and run the development server:
```bash
# Install packages
npm install

# Run the next.js development server
npm run dev
```

Visit `http://localhost:3000` to access the application.

---

## 🔒 Security (RLS)
Security is implemented directly inside PostgreSQL using **Row-Level Security (RLS)**. Only authenticated users with a valid Supabase Auth session can read, insert, update, or delete records from any table:
- `personal_commitments`
- `finance_calls`
- `income`
- `expenses`
- `budget`
- `reimbursements`
