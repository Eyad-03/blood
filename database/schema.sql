-- =====================================================================
--  BloodLink — relational database schema
--  Target: MySQL 8.0+ / MariaDB 10.5+ (InnoDB, utf8mb4)
--
--  Derived from the front-end in html/ + js/, which currently keeps its
--  data in localStorage. Each table notes the page(s) it replaces.
--
--  Modules
--    1. Lookups ........ cities, blood_types, blood_compatibility,
--                        event_types, ad_plans, ad_departments, ad_categories
--    2. Accounts ....... users, donor_profiles, requester_profiles,
--                        organizations, organization_documents
--    3. Blood flow ..... blood_requests, donations,
--                        donation_verifications, blood_inventory
--    4. Venues ......... halls, hall_event_types, hall_features,
--                        hall_bookings, hall_booking_documents,
--                        hall_booking_status_history
--    5. Ads ............ advertisements
--    6. Money .......... payments (hall bookings + ad plans)
--    7. Support ........ reports, report_attachments, admin_activity_log
--    8. Views
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW  IF EXISTS v_donor_search, v_low_stock, v_advertisement_status;
DROP TABLE IF EXISTS
  admin_activity_log, report_attachments, reports,
  payments, advertisements,
  hall_booking_status_history, hall_booking_documents, hall_bookings,
  hall_features, hall_event_types, halls,
  blood_inventory, donation_verifications, donations, blood_requests,
  organization_documents, organizations,
  requester_profiles, donor_profiles, users,
  ad_categories, ad_departments, ad_plans, event_types,
  blood_compatibility, blood_types, cities;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. LOOKUP TABLES
-- =====================================================================

-- Governorates used by register.html, hall.html, admin.html
CREATE TABLE cities (
  id    SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The 8 ABO/Rh groups used on every form
CREATE TABLE blood_types (
  code  VARCHAR(3) PRIMARY KEY            -- 'A+', 'O-', ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Who can give to whom (donorSearch.js "show compatible donors" toggle)
CREATE TABLE blood_compatibility (
  donor_type      VARCHAR(3) NOT NULL,
  recipient_type  VARCHAR(3) NOT NULL,
  PRIMARY KEY (donor_type, recipient_type),
  CONSTRAINT fk_compat_donor     FOREIGN KEY (donor_type)     REFERENCES blood_types(code),
  CONSTRAINT fk_compat_recipient FOREIGN KEY (recipient_type) REFERENCES blood_types(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conference / Initiative / Workshop / Training (hall.html)
CREATE TABLE event_types (
  id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Basic / Featured / Premium advertising plans (ads-data.js PLANS)
CREATE TABLE ad_plans (
  code           VARCHAR(20) PRIMARY KEY,
  name           VARCHAR(40) NOT NULL,
  duration_days  SMALLINT UNSIGNED NOT NULL,
  price_jod      DECIMAL(8,2) NOT NULL,
  perks          JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orthopedics, Cardiology, ... (ads-data.js DEPARTMENTS)
CREATE TABLE ad_departments (
  id    TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Free consultation day, Health screening, ... (ads-data.js CATEGORIES)
CREATE TABLE ad_categories (
  id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(60) NOT NULL UNIQUE,
  color  CHAR(7)     NULL,
  icon   VARCHAR(30) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. ACCOUNTS
-- =====================================================================

-- One login per person/organization (register.html, login.html, profile.html)
CREATE TABLE users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role           ENUM('donor','requester','hospital','admin') NOT NULL,
  full_name      VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  phone          VARCHAR(20)  NULL,
  password_hash  VARCHAR(255) NOT NULL,           -- bcrypt/argon2, never plain text
  city_id        SMALLINT UNSIGNED NULL,
  location_text  VARCHAR(120) NULL,               -- "University Street, Irbid"
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,   -- hospital users stay FALSE until approved
  consent_at     DATETIME NULL,                   -- terms checkbox on register.html
  last_login_at  DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:1 with users(role='donor') — donate.html, profile.html, donorSearch.html
CREATE TABLE donor_profiles (
  user_id               INT UNSIGNED PRIMARY KEY,
  blood_type            VARCHAR(3) NOT NULL,
  area                  VARCHAR(80)  NULL,          -- neighbourhood shown in search
  latitude              DECIMAL(9,6) NULL,
  longitude             DECIMAL(9,6) NULL,
  location_mode         ENUM('approximate','precise') NOT NULL DEFAULT 'approximate',
  is_available          BOOLEAN NOT NULL DEFAULT FALSE,
  availability_window   ENUM('today','tomorrow','week','contact') NULL,
  preferred_contact     ENUM('phone','sms','email') NOT NULL DEFAULT 'phone',
  notes                 VARCHAR(350) NULL,
  share_location_consent BOOLEAN NOT NULL DEFAULT FALSE,
  last_donation_date    DATE NULL,                  -- denormalised from donations
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_donor_user  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_donor_blood FOREIGN KEY (blood_type) REFERENCES blood_types(code),
  INDEX idx_donor_search (blood_type, is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:1 with users(role='requester') — "I need blood" branch of register.html
CREATE TABLE requester_profiles (
  user_id              INT UNSIGNED PRIMARY KEY,
  required_blood_type  VARCHAR(3) NULL,            -- NULL = "Not sure"
  request_city_id      SMALLINT UNSIGNED NULL,
  CONSTRAINT fk_req_user  FOREIGN KEY (user_id)             REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_req_blood FOREIGN KEY (required_blood_type) REFERENCES blood_types(code),
  CONSTRAINT fk_req_city  FOREIGN KEY (request_city_id)     REFERENCES cities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hospitals / blood centers / medical centers awaiting or holding approval
-- (register.html hospital branch, admin.html "Account verification")
CREATE TABLE organizations (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL UNIQUE,      -- 'ORG-1042'
  owner_user_id     INT UNSIGNED NOT NULL UNIQUE,      -- the hospital login
  name              VARCHAR(120) NOT NULL,
  org_type          ENUM('Hospital','Blood donation center','Medical center') NOT NULL,
  city_id           SMALLINT UNSIGNED NOT NULL,
  address           VARCHAR(160) NULL,
  license_number    VARCHAR(40)  NULL UNIQUE,          -- MOH license
  email             VARCHAR(120) NOT NULL,
  phone             VARCHAR(20)  NULL,
  contact_person    VARCHAR(80)  NULL,
  status            ENUM('Pending','Active','Rejected') NOT NULL DEFAULT 'Pending',
  rejection_reason  VARCHAR(500) NULL,
  registered_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at        DATETIME NULL,
  decided_by        INT UNSIGNED NULL,                 -- admin user
  CONSTRAINT fk_org_owner   FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_org_city    FOREIGN KEY (city_id)       REFERENCES cities(id),
  CONSTRAINT fk_org_decider FOREIGN KEY (decided_by)    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_org_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- License / registration certificate / representative ID (admin.js DOCS)
CREATE TABLE organization_documents (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id  INT UNSIGNED NOT NULL,
  doc_type         ENUM('moh_license','registration_certificate','representative_id') NOT NULL,
  file_name        VARCHAR(160) NOT NULL,
  file_path        VARCHAR(255) NOT NULL,
  file_size_bytes  INT UNSIGNED NULL,
  is_checked       BOOLEAN NOT NULL DEFAULT FALSE,    -- admin ticked it off
  uploaded_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orgdoc_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_orgdoc_type (organization_id, doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. BLOOD REQUESTS, DONATIONS, INVENTORY
-- =====================================================================

-- A requester asks a specific donor for blood.
-- bloodRequests.html (requester's outbox) and donorRequests.html (donor's inbox)
-- are two views of this one table.
CREATE TABLE blood_requests (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL UNIQUE,      -- 'BR-2026-0184'
  requester_id      INT UNSIGNED NOT NULL,
  donor_id          INT UNSIGNED NOT NULL,
  hospital_id       INT UNSIGNED NULL,                 -- where the donation happens
  hospital_name     VARCHAR(120) NULL,                 -- free text if hospital not on platform
  blood_type        VARCHAR(3)   NOT NULL,             -- type the patient needs
  units             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  priority          ENUM('Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  message           VARCHAR(500) NULL,
  location_text     VARCHAR(120) NULL,
  status            ENUM('Pending','Accepted','Declined','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at      DATETIME NULL,
  completed_at      DATETIME NULL,
  CONSTRAINT fk_br_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_br_donor     FOREIGN KEY (donor_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_br_hospital  FOREIGN KEY (hospital_id)  REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_br_blood     FOREIGN KEY (blood_type)   REFERENCES blood_types(code),
  CONSTRAINT chk_br_units    CHECK (units BETWEEN 1 AND 20),
  CONSTRAINT chk_br_parties  CHECK (requester_id <> donor_id),
  INDEX idx_br_donor_status     (donor_id, status),
  INDEX idx_br_requester_status (requester_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Each actual donation by a donor (profile.html donation counter / "blood bag")
CREATE TABLE donations (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  donor_id          INT UNSIGNED NOT NULL,
  blood_request_id  INT UNSIGNED NULL,                 -- if it fulfilled a request
  organization_id   INT UNSIGNED NULL,                 -- where it was given
  units             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  donated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source            ENUM('self_reported','hospital_verified') NOT NULL DEFAULT 'self_reported',
  CONSTRAINT fk_don_donor   FOREIGN KEY (donor_id)         REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_don_request FOREIGN KEY (blood_request_id) REFERENCES blood_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_don_org     FOREIGN KEY (organization_id)  REFERENCES organizations(id) ON DELETE SET NULL,
  INDEX idx_don_donor_date (donor_id, donated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hospital confirms a donor→recipient transfer (hospital.html "Donation verification")
CREATE TABLE donation_verifications (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL UNIQUE,      -- 'DV-2026-006'
  organization_id   INT UNSIGNED NOT NULL,
  donation_id       INT UNSIGNED NULL UNIQUE,          -- link once matched to a donor account
  donor_user_id     INT UNSIGNED NULL,
  donor_name        VARCHAR(80)  NOT NULL,             -- as typed on the form
  recipient_name    VARCHAR(80)  NOT NULL,             -- "Patient #2841"
  blood_type        VARCHAR(3)   NOT NULL,
  units             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  donation_date     DATE NOT NULL,
  status            ENUM('Pending verification','Verified') NOT NULL DEFAULT 'Pending verification',
  notes             VARCHAR(300) NULL,
  verified_by       INT UNSIGNED NULL,
  verified_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dv_org      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_dv_donation FOREIGN KEY (donation_id)     REFERENCES donations(id) ON DELETE SET NULL,
  CONSTRAINT fk_dv_donor    FOREIGN KEY (donor_user_id)   REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_dv_blood    FOREIGN KEY (blood_type)      REFERENCES blood_types(code),
  CONSTRAINT fk_dv_verifier FOREIGN KEY (verified_by)     REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_dv_units   CHECK (units BETWEEN 1 AND 20),
  INDEX idx_dv_org_date (organization_id, donation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Units on hand per hospital per blood type (hospital.html "Inventory")
CREATE TABLE blood_inventory (
  organization_id  INT UNSIGNED NOT NULL,
  blood_type       VARCHAR(3)   NOT NULL,
  units            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  min_target       SMALLINT UNSIGNED NOT NULL DEFAULT 15,   -- "Minimum target: 15 units"
  critical_level   SMALLINT UNSIGNED NOT NULL DEFAULT 8,    -- below this = critical
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, blood_type),
  CONSTRAINT fk_inv_org   FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_blood FOREIGN KEY (blood_type)      REFERENCES blood_types(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. VENUES & HALL BOOKINGS
-- =====================================================================

-- hall.js `halls`
CREATE TABLE halls (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  city_id       SMALLINT UNSIGNED NOT NULL,            -- governorate
  entity_type   ENUM('University','Community center','Private institution','Government institution') NOT NULL,
  location_text VARCHAR(120) NULL,
  capacity      SMALLINT UNSIGNED NOT NULL,
  price_jod     DECIMAL(8,2) NOT NULL,
  rating        DECIMAL(2,1) NULL,
  tag           VARCHAR(40)  NULL,                     -- "Popular choice"
  image_url     VARCHAR(255) NULL,
  description   VARCHAR(500) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hall_city    FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT chk_hall_rating CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  INDEX idx_hall_filter (city_id, capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- M:N — which event types a hall supports
CREATE TABLE hall_event_types (
  hall_id        INT UNSIGNED NOT NULL,
  event_type_id  TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (hall_id, event_type_id),
  CONSTRAINT fk_het_hall  FOREIGN KEY (hall_id)       REFERENCES halls(id) ON DELETE CASCADE,
  CONSTRAINT fk_het_event FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:N — "Wi-Fi", "Parking", "Sound system", ...
CREATE TABLE hall_features (
  hall_id  INT UNSIGNED NOT NULL,
  feature  VARCHAR(60) NOT NULL,
  PRIMARY KEY (hall_id, feature),
  CONSTRAINT fk_hf_hall FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hall.html booking form → hallRequests.html / hospital "Hall bookings" / admin "Hall bookings"
-- Workflow: Pending approval → Approved → Paid → Completed  (or Rejected)
CREATE TABLE hall_bookings (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(20)  NOT NULL UNIQUE,     -- 'HB-2026-418230'
  hall_id            INT UNSIGNED NOT NULL,
  requested_by       INT UNSIGNED NOT NULL,            -- user who submitted
  organization_id    INT UNSIGNED NULL,                -- set when a registered hospital books
  organization_name  VARCHAR(120) NOT NULL,            -- initiative name as typed
  contact_name       VARCHAR(80)  NOT NULL,
  contact_email      VARCHAR(120) NOT NULL,
  contact_phone      VARCHAR(20)  NOT NULL,
  event_type_id      TINYINT UNSIGNED NOT NULL,
  event_date         DATE NOT NULL,
  event_time         VARCHAR(30)  NOT NULL,            -- 'Morning' | 'Evening' | 'All day' | '09:00 – 15:00'
  attendees          SMALLINT UNSIGNED NOT NULL,
  fee_jod            DECIMAL(8,2) NOT NULL,            -- hall price snapshot at booking time
  description        VARCHAR(1000) NOT NULL,
  status             ENUM('Pending approval','Approved','Paid','Completed','Rejected') NOT NULL DEFAULT 'Pending approval',
  admin_note         VARCHAR(500) NULL,
  reviewed_by        INT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hb_hall     FOREIGN KEY (hall_id)         REFERENCES halls(id),
  CONSTRAINT fk_hb_user     FOREIGN KEY (requested_by)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hb_org      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_hb_event    FOREIGN KEY (event_type_id)   REFERENCES event_types(id),
  CONSTRAINT fk_hb_reviewer FOREIGN KEY (reviewed_by)     REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_hb_attendees CHECK (attendees >= 1),
  INDEX idx_hb_status (status),
  INDEX idx_hb_hall_date (hall_id, event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The three required uploads on the booking form
CREATE TABLE hall_booking_documents (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT UNSIGNED NOT NULL,
  doc_type     ENUM('official_letter','event_plan','organization_proof') NOT NULL,
  file_name    VARCHAR(160) NOT NULL,
  file_path    VARCHAR(255) NOT NULL,
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hbd_booking FOREIGN KEY (booking_id) REFERENCES hall_bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_hbd_type (booking_id, doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Timeline shown in "Booking journey" (admin.js pushes to r.history)
CREATE TABLE hall_booking_status_history (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT UNSIGNED NOT NULL,
  status      ENUM('Pending approval','Approved','Paid','Completed','Rejected') NOT NULL,
  note        VARCHAR(500) NULL,
  changed_by  INT UNSIGNED NULL,
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hbh_booking FOREIGN KEY (booking_id) REFERENCES hall_bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_hbh_user    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_hbh_booking (booking_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. HOSPITAL ADVERTISEMENTS (ads.html, hospital.html "Ads")
-- =====================================================================
CREATE TABLE advertisements (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL UNIQUE,      -- 'AD-2026-002'
  organization_id   INT UNSIGNED NOT NULL,
  title             VARCHAR(120) NOT NULL,
  department_id     TINYINT UNSIGNED NOT NULL,
  category_id       TINYINT UNSIGNED NOT NULL,
  badge             VARCHAR(20)  NULL,                 -- 'Free', '50% off'
  description       VARCHAR(1000) NOT NULL,
  event_date        DATE NULL,
  start_time        TIME NULL,
  end_time          TIME NULL,
  location_text     VARCHAR(120) NULL,
  phone             VARCHAR(20)  NULL,
  booking_required  BOOLEAN NOT NULL DEFAULT FALSE,
  plan_code         VARCHAR(20)  NOT NULL,
  start_date        DATE NOT NULL,                     -- visibility window
  end_date          DATE NOT NULL,                     -- start_date + plan days - 1
  fee_jod           DECIMAL(8,2) NOT NULL,
  vat_jod           DECIMAL(8,2) NOT NULL,             -- 16% Jordan GST
  total_jod         DECIMAL(8,2) NOT NULL,
  views             INT UNSIGNED NOT NULL DEFAULT 0,
  is_cancelled      BOOLEAN NOT NULL DEFAULT FALSE,    -- "Stopped"
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ad_org   FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ad_dept  FOREIGN KEY (department_id)   REFERENCES ad_departments(id),
  CONSTRAINT fk_ad_cat   FOREIGN KEY (category_id)     REFERENCES ad_categories(id),
  CONSTRAINT fk_ad_plan  FOREIGN KEY (plan_code)       REFERENCES ad_plans(code),
  CONSTRAINT chk_ad_window CHECK (end_date >= start_date),
  CONSTRAINT chk_ad_times  CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time),
  INDEX idx_ad_window (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. PAYMENTS — for a hall booking OR an ad plan (exactly one)
-- =====================================================================
CREATE TABLE payments (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hall_booking_id   INT UNSIGNED NULL UNIQUE,
  advertisement_id  INT UNSIGNED NULL UNIQUE,
  paid_by           INT UNSIGNED NOT NULL,
  method            ENUM('Bank card','E-wallet') NOT NULL,
  amount_jod        DECIMAL(10,2) NOT NULL,
  receipt_number    VARCHAR(30) NOT NULL UNIQUE,
  paid_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_booking FOREIGN KEY (hall_booking_id)  REFERENCES hall_bookings(id),
  CONSTRAINT fk_pay_ad      FOREIGN KEY (advertisement_id) REFERENCES advertisements(id),
  CONSTRAINT fk_pay_user    FOREIGN KEY (paid_by)          REFERENCES users(id),
  CONSTRAINT chk_pay_target CHECK ((hall_booking_id IS NULL) <> (advertisement_id IS NULL)),
  CONSTRAINT chk_pay_amount CHECK (amount_jod > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7. SUPPORT: REPORTS & ADMIN LOG (report.html, admin.html)
-- =====================================================================
CREATE TABLE reports (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20)  NOT NULL UNIQUE,        -- 'RP-3109'
  reporter_id     INT UNSIGNED NULL,                   -- NULL for guests
  reporter_name   VARCHAR(60)  NOT NULL,
  reporter_email  VARCHAR(80)  NOT NULL,
  reporter_role   ENUM('Donor','Hospital','Organization','Other') NOT NULL,
  category        ENUM('Technical issue','Donor complaint','Inappropriate content',
                       'Booking issue','Hospital issue','Data correction') NOT NULL,
  related_to      VARCHAR(80)  NULL,                   -- "Zaha Cultural Center"
  title           VARCHAR(90)  NOT NULL,
  body            VARCHAR(1000) NOT NULL,
  priority        ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status          ENUM('New','In review','Resolved') NOT NULL DEFAULT 'New',
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  admin_response  VARCHAR(1000) NULL,
  handled_by      INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME NULL,
  CONSTRAINT fk_rep_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_rep_handler  FOREIGN KEY (handled_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_rep_status (status, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_attachments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id    INT UNSIGNED NOT NULL,
  file_name    VARCHAR(160) NOT NULL,
  file_path    VARCHAR(255) NOT NULL,
  mime_type    VARCHAR(80)  NULL,
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ra_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Recent admin activity" feed
CREATE TABLE admin_activity_log (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id     INT UNSIGNED NULL,
  action       VARCHAR(40)  NOT NULL,                  -- 'activate_org', 'reject_booking', ...
  entity_type  ENUM('organization','hall_booking','report','advertisement','user') NOT NULL,
  entity_id    INT UNSIGNED NOT NULL,
  description  VARCHAR(255) NOT NULL,                  -- "Activated Jerash Family Hospital"
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 8. VIEWS
-- =====================================================================

-- Ad status is computed, not stored (ads-data.js status())
CREATE VIEW v_advertisement_status AS
SELECT a.*,
       CASE
         WHEN a.is_cancelled            THEN 'Stopped'
         WHEN a.start_date > CURDATE()  THEN 'Scheduled'
         WHEN a.end_date   < CURDATE()  THEN 'Expired'
         ELSE 'Active'
       END AS status
FROM advertisements a;

-- Low-stock alerts on the hospital dashboard
CREATE VIEW v_low_stock AS
SELECT i.organization_id, o.name AS organization_name, i.blood_type, i.units, i.min_target,
       CASE WHEN i.units < i.critical_level THEN 'critical' ELSE 'low' END AS level
FROM blood_inventory i
JOIN organizations o ON o.id = i.organization_id
WHERE i.units < i.min_target;

-- What donorSearch.html / hospital "Donor directory" list
CREATE VIEW v_donor_search AS
SELECT u.id AS donor_id, u.full_name, u.email, u.phone,
       c.name AS city, d.area, d.blood_type, d.is_available,
       d.latitude, d.longitude, d.location_mode, d.last_donation_date
FROM users u
JOIN donor_profiles d ON d.user_id = u.id
LEFT JOIN cities c    ON c.id = u.city_id
WHERE u.is_active AND u.role = 'donor';

-- =====================================================================
-- SEED DATA FOR LOOKUP TABLES
-- =====================================================================
INSERT INTO cities (name) VALUES
 ('Irbid'),('Amman'),('Zarqa'),('Aqaba'),('Salt'),('Madaba'),('Jerash'),
 ('Ajloun'),('Mafraq'),('Karak'),('Tafilah'),('Ma''an'),('Other');

INSERT INTO blood_types (code) VALUES
 ('A+'),('A-'),('B+'),('B-'),('AB+'),('AB-'),('O+'),('O-');

INSERT INTO blood_compatibility (donor_type, recipient_type) VALUES
 ('O-','O-'),('O-','O+'),('O-','A-'),('O-','A+'),('O-','B-'),('O-','B+'),('O-','AB-'),('O-','AB+'),
 ('O+','O+'),('O+','A+'),('O+','B+'),('O+','AB+'),
 ('A-','A-'),('A-','A+'),('A-','AB-'),('A-','AB+'),
 ('A+','A+'),('A+','AB+'),
 ('B-','B-'),('B-','B+'),('B-','AB-'),('B-','AB+'),
 ('B+','B+'),('B+','AB+'),
 ('AB-','AB-'),('AB-','AB+'),
 ('AB+','AB+');

INSERT INTO event_types (name) VALUES ('Conference'),('Initiative'),('Workshop'),('Training');

INSERT INTO ad_plans (code, name, duration_days, price_jod, perks) VALUES
 ('basic',   'Basic',    7, 25.00, JSON_ARRAY('Listed on the public ads page','Standard placement','7 days of visibility')),
 ('featured','Featured',14, 50.00, JSON_ARRAY('Highlighted card with badge','Priority placement','14 days of visibility')),
 ('premium', 'Premium', 30, 90.00, JSON_ARRAY('Top banner spot on the ads page','Featured badge + priority','30 days of visibility'));

INSERT INTO ad_departments (name) VALUES
 ('Orthopedics'),('Cardiology'),('Pediatrics'),('Internal medicine'),('Dermatology'),
 ('Ophthalmology'),('Dental'),('Obstetrics & gynecology'),('Neurology'),('Blood bank'),('General / multiple');

INSERT INTO ad_categories (name, color, icon) VALUES
 ('Free consultation day','#13895f','stethoscope'),
 ('Health screening',     '#3a72c9','pulse'),
 ('Discounted service',   '#bd7c12','tag'),
 ('Awareness campaign',   '#7a4cc2','megaphone'),
 ('Blood donation drive', '#d41d3d','drop'),
 ('New service / clinic', '#0f7f8f','spark');
