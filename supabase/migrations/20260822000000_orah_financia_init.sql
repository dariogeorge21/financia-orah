-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260822000000_orah_financia_init.sql
-- Apply via: Supabase Dashboard > SQL Editor, or supabase db push
-- ============================================================

-- ============================================================
-- 1. PERSONAL COMMITMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.personal_commitments (
  id            TEXT PRIMARY KEY,             -- PCOM-XXXX
  person_name   TEXT NOT NULL,
  mobile_number TEXT,
  promised      NUMERIC(12,2) NOT NULL CHECK (promised > 0),
  received      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL CHECK (status IN ('Pending','Partially Received','Fully Received','Cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.personal_commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read personal_commitments"  ON public.personal_commitments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert personal_commitments" ON public.personal_commitments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update personal_commitments" ON public.personal_commitments FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete personal_commitments" ON public.personal_commitments FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 2. FINANCE CALLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_calls (
  id            TEXT PRIMARY KEY,             -- FC-XXXX
  person_name   TEXT NOT NULL,
  mobile_number TEXT,
  caller_name   TEXT,                         -- Volunteer / Member who made the call
  promised      NUMERIC(12,2) NOT NULL CHECK (promised > 0),
  received      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL CHECK (status IN ('Pending','Partially Received','Fully Received','Cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read finance_calls"  ON public.finance_calls FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert finance_calls" ON public.finance_calls FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update finance_calls" ON public.finance_calls FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete finance_calls" ON public.finance_calls FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. INCOME TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.income (
  id            TEXT PRIMARY KEY,             -- INC-XXXX
  date          DATE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('Registration','Donation','Personal Commitment','Finance Call','Commitment','Church','Coupon','Sponsor','Other')),
  contributor   TEXT NOT NULL,
  mobile_number TEXT,
  description   TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  money_type    TEXT NOT NULL CHECK (money_type IN ('Cash','UPI')),
  notes         TEXT,
  reference_id  TEXT,                         -- PCOM-XXXX or FC-XXXX
  commitment_id TEXT,                         -- alias for backwards compatibility
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read income"  ON public.income FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert income" ON public.income FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update income" ON public.income FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete income" ON public.income FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id             TEXT PRIMARY KEY,            -- EXP-XXXX
  category       TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  money_type     TEXT NOT NULL CHECK (money_type IN ('Cash','UPI')),
  paid_by        TEXT NOT NULL,               -- Person or entity that paid
  mobile_number  TEXT,
  payment_source TEXT NOT NULL CHECK (payment_source IN ('Personal','Event','Personal Money','Event Money')),
  has_receipt    BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_link   TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'Approved' CHECK (status IN ('Pending','Approved','Rejected')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read expenses"  ON public.expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update expenses" ON public.expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete expenses" ON public.expenses FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 5. BUDGET TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget (
  id             SERIAL PRIMARY KEY,
  category       TEXT NOT NULL UNIQUE,
  description    TEXT,
  planned        NUMERIC(12,2) NOT NULL CHECK (planned >= 0),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read budget"  ON public.budget FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert budget" ON public.budget FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update budget" ON public.budget FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete budget" ON public.budget FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. REIMBURSEMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reimbursements (
  id              TEXT PRIMARY KEY,           -- REIM-XXX
  date            DATE NOT NULL,
  person          TEXT NOT NULL,
  mobile_number   TEXT,
  expense_id      TEXT NOT NULL REFERENCES public.expenses(id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL CHECK (status IN ('Pending','Paid')),
  money_type_paid TEXT CHECK (money_type_paid IN ('Cash','UPI')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read reimbursements"  ON public.reimbursements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert reimbursements" ON public.reimbursements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update reimbursements" ON public.reimbursements FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete reimbursements" ON public.reimbursements FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA: PERSONAL COMMITMENTS
-- ============================================================
INSERT INTO public.personal_commitments (id, person_name, mobile_number, promised, received, status, notes) VALUES
  ('PCOM-0001', 'Rahul Thomas', '9876543210', 10000, 10000, 'Fully Received', 'Paid via UPI INC-0004'),
  ('PCOM-0002', 'Priya Menon',  '9876543211',  5000,  2000, 'Partially Received', 'Paid 2000 cash INC-0007'),
  ('PCOM-0003', 'Amit Shah',    '9876543212',  5000,  5000, 'Fully Received', 'Paid via UPI INC-0010'),
  ('PCOM-0004', 'Sarah V',      '9876543213',  3000,  3000, 'Fully Received', 'Paid cash INC-0016'),
  ('PCOM-0005', 'John Doe',     '9876543214', 10000,  5000, 'Partially Received', 'Paid UPI INC-0013'),
  ('PCOM-0006', 'Neha Singh',   '9876543215', 15000,     0, 'Pending', 'Promised by 25th Aug'),
  ('PCOM-0007', 'Alex M',       '9876543216', 10000,     0, 'Pending', 'Follow up on Monday'),
  ('PCOM-0008', 'Manoj K',      '9876543217',  5000,     0, 'Pending', 'Will transfer to bank'),
  ('PCOM-0009', 'Thomas P',     '9876543218', 20000,     0, 'Pending', 'Major sponsor commitment'),
  ('PCOM-0010', 'Sneha Roy',    '9876543219',  2000,     0, 'Pending', NULL),
  ('PCOM-0011', 'George V',     '9876543220',  5000,     0, 'Pending', NULL),
  ('PCOM-0012', 'Vikram S',     '9876543221',  3000,     0, 'Pending', NULL),
  ('PCOM-0013', 'Anjali D',     '9876543222',  2000,     0, 'Pending', NULL),
  ('PCOM-0014', 'David C',      '9876543223',  5000,     0, 'Cancelled', 'Unable to attend'),
  ('PCOM-0015', 'Tina L',       '9876543224',  5000,     0, 'Pending', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: FINANCE CALLS
-- ============================================================
INSERT INTO public.finance_calls (id, person_name, mobile_number, caller_name, promised, received, status, notes) VALUES
  ('FC-0001', 'Mathew Abraham', '9845012345', 'George Joseph', 15000, 10000, 'Partially Received', 'Direct bank transfer promised'),
  ('FC-0002', 'Dr. Reena Kurian', '9845023456', 'Priya Menon',  25000, 25000, 'Fully Received', 'Alumni contribution'),
  ('FC-0003', 'Antony Varghese', '9845034567', 'Rahul Thomas', 10000,     0, 'Pending', 'Will pay during campus visit'),
  ('FC-0004', 'Liza Mathew',     '9845045678', 'Sarah V',       8000,  8000, 'Fully Received', 'Transferred via UPI'),
  ('FC-0005', 'Philip Koshy',    '9845056789', 'Amit Shah',    20000,     0, 'Pending', 'Follow up next week'),
  ('FC-0006', 'Susan George',    '9845067890', 'John Doe',      5000,  2500, 'Partially Received', 'First installment received'),
  ('FC-0007', 'K. V. Zachariah', '9845078901', 'George Joseph', 30000,     0, 'Pending', 'Confirmed for Day 1 opening')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: INCOME
-- ============================================================
INSERT INTO public.income (id, date, type, contributor, mobile_number, description, amount, money_type, notes, reference_id, commitment_id) VALUES
  ('INC-0001', '2026-08-01', 'Registration',       'Multiple Students',   '9000000001', 'Early bird tickets',              5000, 'Cash', 'Desk A',                       NULL, NULL),
  ('INC-0002', '2026-08-02', 'Sponsor',            'TechCorp Inc.',       '9000000002', 'Title Sponsorship',              50000, 'UPI',  'Verified',                     NULL, NULL),
  ('INC-0003', '2026-08-03', 'Church',             'St. Peter''s Parish', '9000000003', 'Community fund',                 25000, 'UPI',  'Direct transfer to Event UPI', NULL, NULL),
  ('INC-0004', '2026-08-04', 'Personal Commitment','Rahul Thomas',        '9876543210', 'Payment against PCOM-0001',       10000, 'UPI',  'Fully Paid',                   'PCOM-0001', 'PCOM-0001'),
  ('INC-0005', '2026-08-05', 'Donation',           'Anonymous',           '9000000005', 'Cash drop box',                   2000, 'Cash', 'Counted by Committee',          NULL, NULL),
  ('INC-0006', '2026-08-06', 'Coupon',             'Food Stalls',         '9000000006', 'Booklets 1-10',                   5000, 'Cash', 'Day 1 sales',                  NULL, NULL),
  ('INC-0007', '2026-08-07', 'Personal Commitment','Priya Menon',         '9876543211', 'Payment against PCOM-0002',        2000, 'Cash', 'Partial Payment',              'PCOM-0002', 'PCOM-0002'),
  ('INC-0008', '2026-08-08', 'Sponsor',            'Fresh Bakes',         '9000000008', 'Banner Ad',                      15000, 'UPI',  NULL,                           NULL, NULL),
  ('INC-0009', '2026-08-09', 'Registration',       'Group Booking',       '9000000009', '5 members',                       2500, 'UPI',  NULL,                           NULL, NULL),
  ('INC-0010', '2026-08-09', 'Personal Commitment','Amit Shah',           '9876543212', 'Payment against PCOM-0003',        5000, 'UPI',  'Fully Paid',                   'PCOM-0003', 'PCOM-0003'),
  ('INC-0011', '2026-08-10', 'Church',             'Grace Assembly',      '9000000011', 'Offering share',                 10000, 'Cash', 'Received by Treasurer',        NULL, NULL),
  ('INC-0012', '2026-08-11', 'Registration',       'Walk-ins',            '9000000012', 'Day 1 passes',                    8000, 'Cash', 'Desk B',                       NULL, NULL),
  ('INC-0013', '2026-08-12', 'Personal Commitment','John Doe',            '9876543214', 'Payment against PCOM-0005',        5000, 'UPI',  'Partial',                      'PCOM-0005', 'PCOM-0005'),
  ('INC-0014', '2026-08-13', 'Sponsor',            'Print Magic',         '9000000014', 'Stall fee',                      12000, 'UPI',  NULL,                           NULL, NULL),
  ('INC-0015', '2026-08-14', 'Donation',           'Ravi Kumar',          '9000000015', 'Personal gift',                  15000, 'UPI',  NULL,                           NULL, NULL),
  ('INC-0016', '2026-08-15', 'Personal Commitment','Sarah V',             '9876543213', 'Payment against PCOM-0004',        3000, 'Cash', 'Fully Paid',                   'PCOM-0004', 'PCOM-0004'),
  ('INC-0017', '2026-08-16', 'Registration',       'Online portal',       '9000000017', 'Web registrations',              10000, 'UPI',  'Settlement batch 1',           NULL, NULL),
  ('INC-0018', '2026-08-17', 'Coupon',             'Game Stalls',         '9000000018', 'Coupon sales',                    6000, 'Cash', NULL,                           NULL, NULL),
  ('INC-0019', '2026-08-18', 'Other',              'Scrap Dealer',        '9000000019', 'Old materials sold',              1000, 'Cash', NULL,                           NULL, NULL),
  ('INC-0020', '2026-08-19', 'Registration',       'Online portal',       '9000000020', 'Web registrations',               3000, 'UPI',  'Settlement batch 2',           NULL, NULL),
  ('INC-0021', '2026-08-20', 'Finance Call',       'Dr. Reena Kurian',    '9845023456', 'Payment against FC-0002',        25000, 'UPI',  'Alumni donation',              'FC-0002',   'FC-0002'),
  ('INC-0022', '2026-08-21', 'Finance Call',       'Liza Mathew',         '9845045678', 'Payment against FC-0004',         8000, 'UPI',  'Call drive donation',          'FC-0004',   'FC-0004'),
  ('INC-0023', '2026-08-21', 'Finance Call',       'Mathew Abraham',      '9845012345', 'Payment against FC-0001',        10000, 'UPI',  'Partial transfer',             'FC-0001',   'FC-0001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: EXPENSES
-- ============================================================
INSERT INTO public.expenses (id, category, description, amount, money_type, paid_by, mobile_number, payment_source, status, has_receipt, receipt_link, notes) VALUES
  ('EXP-0001', 'Venue',         'Hall Advance',          20000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, 'Auditorium Booking'),
  ('EXP-0002', 'Food',          'Catering Advance',      25000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, 'Caterers day 1 & 2'),
  ('EXP-0003', 'Transport',     'Parking Fee',              40, 'Cash', 'George Joseph', '9876500002', 'Personal', 'Approved', FALSE, NULL, NULL),
  ('EXP-0004', 'Stationery',    'Pens and Tape',           150, 'Cash', 'George Joseph', '9876500002', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0005', 'Miscellaneous', 'Tea for volunteers',      100, 'Cash', 'Volunteer Desk','9876500003', 'Event',    'Approved', FALSE, NULL, NULL),
  ('EXP-0006', 'Printing',      'Main Banners',           4500, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0007', 'Equipment',     'Mic Rental',             3000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0008', 'Marketing',     'FB Ads',                 2000, 'UPI',  'Priya Menon',   '9876543211', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0009', 'Accommodation', 'Guest Hotel',           10000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0010', 'Transport',     'Generator Fuel',          500, 'Cash', 'George Joseph', '9876500002', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0011', 'Security',      'Guards Advance',         4000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0012', 'Decoration',    'Stage Flowers',          3000, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0013', 'Miscellaneous', 'Garbage Bags',            200, 'Cash', 'Amit Shah',     '9876543212', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0014', 'Food',          'Water Bottles',          1500, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0015', 'Media',         'Photo/Video Adv.',       5000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0016', 'Stationery',    'ID Badges',               800, 'Cash', 'Rahul Thomas',  '9876543210', 'Personal', 'Pending',  TRUE,  NULL, NULL),
  ('EXP-0017', 'Printing',      'Flyers',                 1200, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0018', 'Transport',     'Cab for Guest',           750, 'UPI',  'Priya Menon',   '9876543211', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0019', 'Equipment',     'Projector',              2500, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0020', 'Miscellaneous', 'Zip Ties & Tape',         300, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', FALSE, NULL, NULL),
  ('EXP-0021', 'Food',          'Snacks',                  600, 'Cash', 'Amit Shah',     '9876543212', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0022', 'Accommodation', 'Extra room',             2000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0023', 'Transport',     'Van hire',               1500, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0024', 'Printing',      'Certificates',            900, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0025', 'Decoration',    'Balloons/Ribbons',        400, 'Cash', 'Neha Singh',    '9876543215', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0026', 'Media',         'Batteries',               250, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', FALSE, NULL, NULL),
  ('EXP-0027', 'Marketing',     'Posters distrib.',        500, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0028', 'Stationery',    'Files/Folders',           650, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0029', 'Food',          'Breakfast Day 1',        3000, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0030', 'Venue',         'Cleaning crew',          1500, 'Cash', 'Sarah V',       '9876543213', 'Personal', 'Pending',  TRUE,  NULL, NULL),
  ('EXP-0031', 'Equipment',     'Extension cords',         400, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0032', 'Security',      'Walkie-talkies',         1200, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0033', 'Transport',     'Toll charges',            180, 'Cash', 'Amit Shah',     '9876543212', 'Personal', 'Approved', FALSE, NULL, NULL),
  ('EXP-0034', 'Accommodation', 'Room Service',            850, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Rejected', TRUE,  NULL, NULL),
  ('EXP-0035', 'Decoration',    'Red carpet',             2000, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0036', 'Printing',      'Tickets',                1500, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0037', 'Miscellaneous', 'First Aid Kit',           350, 'Cash', 'Priya Menon',   '9876543211', 'Personal', 'Approved', TRUE,  NULL, NULL),
  ('EXP-0038', 'Food',          'Dinner Staff',           2200, 'Cash', 'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0039', 'Equipment',     'Chairs Rental',          4000, 'UPI',  'Treasurer',     '9876500001', 'Event',    'Approved', TRUE,  NULL, NULL),
  ('EXP-0040', 'Transport',     'Drop-off cabs',           800, 'UPI',  'John Doe',      '9876543214', 'Personal', 'Pending',  TRUE,  NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: BUDGET
-- ============================================================
INSERT INTO public.budget (category, planned, description) VALUES
  ('Food',          80000, 'Meals, snacks and water for 2 days'),
  ('Venue',         50000, 'Auditorium and hall rentals'),
  ('Transport',     35000, 'Guest pickups, volunteer logistics'),
  ('Accommodation', 30000, 'Guest speaker and team stays'),
  ('Printing',      20000, 'Banners, flyers, badges, tickets'),
  ('Decoration',    15000, 'Stage, entrance and lighting'),
  ('Equipment',     30000, 'Sound, projector, mics and chairs'),
  ('Media',         15000, 'Photography and live streaming'),
  ('Marketing',     10000, 'Social media ads and promo'),
  ('Stationery',     5000, 'Pens, pads, files, folders'),
  ('Security',      10000, 'Guards and communication gear'),
  ('Miscellaneous', 20000, 'Contingency and immediate needs')
ON CONFLICT (category) DO NOTHING;

-- ============================================================
-- SEED DATA: REIMBURSEMENTS
-- ============================================================
INSERT INTO public.reimbursements (id, date, person, mobile_number, expense_id, amount, status, money_type_paid, notes) VALUES
  ('REIM-001', '2026-08-10', 'George Joseph', '9876500002', 'EXP-0003',   40, 'Paid',    'Cash', 'Settled on Day 1'),
  ('REIM-002', '2026-08-10', 'George Joseph', '9876500002', 'EXP-0004',  150, 'Paid',    'Cash', 'Settled on Day 1'),
  ('REIM-003', '2026-08-12', 'Priya Menon',   '9876543211', 'EXP-0008', 2000, 'Paid',    'UPI',  'UPI Transfer to Priya'),
  ('REIM-004', '2026-08-14', 'Amit Shah',     '9876543212', 'EXP-0013',  200, 'Pending', NULL,   'Pending approval'),
  ('REIM-005', '2026-08-15', 'Rahul Thomas',  '9876543210', 'EXP-0016',  800, 'Pending', NULL,   'Awaiting bill verification'),
  ('REIM-006', '2026-08-16', 'Priya Menon',   '9876543211', 'EXP-0018',  750, 'Pending', NULL,   'Cab receipt attached'),
  ('REIM-007', '2026-08-18', 'Neha Singh',    '9876543215', 'EXP-0025',  400, 'Paid',    'Cash', 'Cash reimbursed'),
  ('REIM-008', '2026-08-19', 'Priya Menon',   '9876543211', 'EXP-0037',  350, 'Pending', NULL,   'First aid kit bill submitted')
ON CONFLICT (id) DO NOTHING;
