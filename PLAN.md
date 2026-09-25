# MASTER DEVELOPMENT PROMPT

## Selfie Attendance & Workforce Verification System

Act as a **Senior Full-Stack Software Engineer, Supabase Architect, Database Engineer, Security Engineer, and UI/UX Designer**.

Your task is to design and implement a complete production-ready **Selfie Attendance and Workforce Verification System**.

Do not immediately generate random components or pages.

First understand the business requirements, define the architecture, database relationships, authentication model, security policies, attendance workflow, storage strategy, and application structure.

Follow modern software engineering best practices while keeping the project **simple, maintainable, scalable, and beginner-friendly**.

Do not unnecessarily overengineer the application.

---

# 1. PROJECT OVERVIEW

The organization currently records employee attendance by requiring employees to:

1. Take a selfie.
2. Send the selfie through Messenger.
3. Use the selfie as proof that they reported for work.

Although the process is simple, Messenger is not designed as an attendance management system.

As conversations accumulate:

- Attendance photos become difficult to find.
- Photos get mixed with unrelated conversations.
- Historical records are difficult to audit.
- Photos may be deleted or lost.
- Management cannot easily search attendance by employee or date.
- Time-in and time-out records are difficult to organize.
- Generating attendance reports is difficult.
- There is no structured attendance database.

The proposed application replaces Messenger with a centralized attendance system while preserving the convenience of selfie-based attendance.

---

# 2. SYSTEM OBJECTIVE

Build a system where employees can use their phone to:

- Sign in to their account.
- Clock in.
- Take a new selfie directly from the application.
- Submit attendance.
- Clock out later using another new selfie.
- View their attendance history.

Managers must be able to use a responsive web dashboard from:

- Phone
- Tablet
- Laptop
- Desktop

Managers must be able to:

- View today's attendance.
- View employee attendance.
- Search previous records.
- Review attendance selfies.
- Review time-in and time-out.
- Detect late employees.
- Detect missing clock-outs.
- Filter records.
- Generate reports.
- Review attendance history.
- Manage employees.
- Manage branches.
- Configure attendance settings.

The system must provide a:

- Structured
- Searchable
- Secure
- Auditable
- Reliable

attendance process.

---

# 3. REQUIRED TECHNOLOGY STACK

Use the following stack.

## Frontend

```text
React
Vite
JavaScript
Ant Design
React Router
Supabase JavaScript SDK
```

Use JavaScript unless a strong technical reason requires otherwise.

Do not migrate the project to Next.js.

Do not introduce a custom Node.js/Express backend unless there is a feature that genuinely cannot be handled properly using Supabase.

Supabase should function as the primary backend platform.

---

# 4. BACKEND

Use:

```text
Supabase
├── PostgreSQL
├── Supabase Authentication
├── Supabase Storage
├── Row Level Security
├── Database Functions
├── Database Triggers
├── Realtime when appropriate
└── Edge Functions only when necessary
```

Avoid unnecessary infrastructure.

---

# 5. DEVELOPMENT PHILOSOPHY

Follow these principles:

```text
Simple > complicated
Secure > convenient shortcuts
Reusable > duplicated
Database-driven > hard-coded
Server-authoritative > client-authoritative
Maintainable > clever
Readable > compressed
```

Do not install libraries when the feature can reasonably be implemented using:

- React
- Ant Design
- Browser APIs
- Supabase

Every dependency added must have a clear purpose.

---

# 6. USER ROLES

Initial roles:

```text
manager
staff
```

Design the architecture so additional roles can eventually be added.

Example future roles:

```text
admin
super_admin
supervisor
hr
```

Do not implement unnecessary roles during the initial version unless required by the architecture.

---

# 7. STAFF CAPABILITIES

Staff users should only access employee-related functions.

Staff can:

- Log in.
- Log out.
- View their profile.
- See their assigned branch.
- Clock in.
- Clock out.
- Capture attendance selfies.
- Review today's attendance status.
- Review their own attendance history.
- View previous attendance selfies if permitted.
- View attendance status such as present, late, incomplete, or absent.
- Change their password.
- Manage basic account settings.

Staff must NOT:

- Access another employee's attendance.
- Access manager dashboards.
- Modify official attendance timestamps.
- Modify attendance records after submission.
- Delete attendance records.
- Change their assigned branch.
- Upload arbitrary attendance images.
- Modify attendance selfies.

These restrictions must be enforced through Supabase RLS and not merely hidden in the frontend.

---

# 8. MANAGER CAPABILITIES

Managers can:

## Dashboard

See:

```text
Total employees
Present today
Late today
Not yet clocked in
Currently working
Completed shifts
Missing clock-out
Absent employees
Attendance completion percentage
```

Include useful dashboard cards and visual summaries.

Avoid unnecessary decorative charts.

Charts must answer actual management questions.

---

# 9. EMPLOYEE MANAGEMENT

Managers should be able to:

- View employees.
- Search employees.
- Filter by status.
- Filter by branch.
- View employee profiles.
- Add employee accounts.
- Assign employees to branches.
- Activate employees.
- Suspend employees.
- Deactivate employees.
- View employee attendance history.
- View employee attendance statistics.

Do not permanently delete employees when historical attendance records exist.

Use account statuses such as:

```text
active
suspended
inactive
```

---

# 10. BRANCH MANAGEMENT

Managers should be able to create and manage branches.

Example:

```text
Solano Branch
Bayombong Branch
```

Branch information may include:

```text
id
name
code
address
timezone
latitude
longitude
geofence_radius
is_active
created_at
updated_at
```

Geolocation should be designed as an optional verification feature.

Do not make GPS mandatory for the MVP unless configured by management.

---

# 11. ATTENDANCE WORKFLOW

The attendance workflow is one of the most important parts of the system.

## CLOCK-IN FLOW

Employee:

```text
Login
   ↓
Attendance page
   ↓
System checks today's status
   ↓
Employee selects Clock In
   ↓
Camera opens
   ↓
Employee captures new selfie
   ↓
Preview selfie
   ↓
Retake OR Continue
   ↓
System validates request
   ↓
Create attendance record
   ↓
Upload attendance photo
   ↓
Save official timestamp
   ↓
Display successful clock-in
```

---

# 12. CLOCK-OUT FLOW

```text
Employee opens attendance page
   ↓
System detects active attendance
   ↓
Employee selects Clock Out
   ↓
Camera opens
   ↓
Capture new selfie
   ↓
Preview
   ↓
Retake OR Continue
   ↓
Upload photo
   ↓
Record official clock-out timestamp
   ↓
Calculate work duration
   ↓
Complete attendance record
```

---

# 13. CAMERA REQUIREMENT

Attendance selfies must be captured directly from the application.

DO NOT provide:

```text
Upload Image
Choose File
Select From Gallery
```

for attendance evidence.

Use the browser camera API where supported:

```javascript
navigator.mediaDevices.getUserMedia()
```

Capture the camera frame using:

```text
video element
      ↓
canvas
      ↓
image Blob
```

The resulting Blob can then be uploaded to Supabase Storage.

This prevents the normal application workflow from selecting existing gallery images.

However, understand that a standard web application cannot provide absolute hardware-level guarantees against sophisticated device manipulation.

The application should therefore provide strong practical verification while avoiding claims that gallery reuse is technologically impossible under every circumstance.

---

# 14. CAMERA UI

Create a mobile-friendly camera experience.

Include:

- Large camera preview.
- Face positioning guide.
- Front camera by default.
- Capture button.
- Retake button.
- Continue button.
- Loading state.
- Camera permission handling.
- Camera unavailable handling.
- Clear error messages.

Prefer:

```javascript
facingMode: "user"
```

for selfie capture.

Do not make the user interact directly with an HTML file picker.

---

# 15. ATTENDANCE PHOTO WATERMARK

Attendance photos should display a visible watermark containing information such as:

```text
Employee Name
Transaction Type
Date
Time
Branch
```

Example:

```text
TRISTAN JUSTINE YUZON
CLOCK IN
September 25, 2026 • 9:03 AM
Solano Branch
```

The watermark may be rendered on the image using Canvas before uploading.

However:

## CRITICAL SECURITY RULE

The watermark itself must NOT be considered the authoritative attendance record.

The database remains the source of truth.

This prevents someone from trusting manipulated image text.

The database must separately store:

```text
employee
transaction
official timestamp
branch
attendance record
storage path
verification information
```

---

# 16. OFFICIAL TIME

Never trust:

```javascript
new Date()
```

from the employee's device as the official attendance timestamp.

Users can manipulate device clocks.

Official clock-in and clock-out timestamps must be generated by PostgreSQL/Supabase using server/database time.

Use something equivalent to:

```sql
now()
```

The client may display local time for user experience, but official records must use server-side timestamps.

---

# 17. TIMEZONE

Store timestamps in PostgreSQL using:

```text
timestamptz
```

Store values consistently.

Display timestamps according to the organization's timezone.

Default configuration may use:

```text
Asia/Manila
```

but timezone handling should be centralized and configurable instead of scattered throughout components.

---

# 18. ATTENDANCE STATES

Attendance records may have states such as:

```text
present
late
completed
incomplete
absent
excused
```

Avoid manually storing values that can safely be calculated dynamically unless storing them provides clear auditing benefits.

For example:

Late status can be calculated against the employee's scheduled start time.

---

# 19. WORK SCHEDULES

Design basic employee schedule support.

Example:

```text
Monday
09:00 AM
06:00 PM
```

Schedule data could contain:

```text
employee_id
day_of_week
scheduled_start
scheduled_end
grace_period_minutes
is_working_day
```

Allow the system to determine:

```text
On Time
Late
No Schedule
```

Do not overbuild full workforce scheduling during the MVP.

---

# 20. ATTENDANCE RECORD

A single work session should preferably be represented by one attendance record.

Example:

```text
attendance_records
------------------------------------------------
id
employee_id
branch_id
attendance_date

clock_in_at
clock_in_photo_path

clock_out_at
clock_out_photo_path

clock_in_latitude
clock_in_longitude

clock_out_latitude
clock_out_longitude

status

scheduled_start
scheduled_end

late_minutes
worked_minutes

notes

created_at
updated_at
```

Do NOT create unrelated duplicate clock-in and clock-out records unless there is a strong database reason.

One attendance record representing one employee work session makes reporting easier.

---

# 21. DATABASE DESIGN

Design a relational PostgreSQL schema.

Recommended core entities:

```text
profiles
branches
employee_branches
work_schedules
attendance_records
attendance_events
audit_logs
app_settings
```

Use UUID primary keys.

Use proper:

- Foreign keys
- Unique constraints
- Indexes
- Check constraints
- Cascading rules

Do not rely exclusively on frontend validation.

---

# 22. PROFILES TABLE

Supabase Auth owns authentication accounts.

Create a `profiles` table linked to:

```text
auth.users.id
```

Example fields:

```text
profiles
-------------------------------
id uuid PK → auth.users.id

first_name text
middle_name text
last_name text

employee_number text

role text
status text

phone text
avatar_path text

created_at timestamptz
updated_at timestamptz
```

Recommended constraints:

```text
role:
manager
staff

status:
active
suspended
inactive
```

Use a trigger or controlled registration flow for creating profiles.

---

# 23. BRANCHES TABLE

```text
branches
-------------------------------
id uuid
name text
code text
address text

latitude numeric
longitude numeric
geofence_radius integer

timezone text

is_active boolean

created_at timestamptz
updated_at timestamptz
```

---

# 24. EMPLOYEE BRANCH ASSIGNMENT

Avoid directly embedding too much assignment information into profiles.

Create:

```text
employee_branches
-------------------------------
id uuid
employee_id uuid
branch_id uuid
is_primary boolean
assigned_at timestamptz
```

For the initial version, an employee may primarily belong to one branch.

Design it so multiple branch assignments can eventually be supported.

---

# 25. WORK SCHEDULES

Example:

```text
work_schedules
-------------------------------
id uuid
employee_id uuid
branch_id uuid

day_of_week smallint

scheduled_start time
scheduled_end time

grace_period_minutes integer

is_working_day boolean

created_at timestamptz
updated_at timestamptz
```

Validate:

```text
day_of_week = 0-6
```

---

# 26. ATTENDANCE RECORDS

Recommended design:

```text
attendance_records
--------------------------------
id uuid

employee_id uuid
branch_id uuid

attendance_date date

clock_in_at timestamptz
clock_in_photo_path text

clock_out_at timestamptz
clock_out_photo_path text

clock_in_latitude numeric
clock_in_longitude numeric

clock_out_latitude numeric
clock_out_longitude numeric

scheduled_start timestamptz
scheduled_end timestamptz

late_minutes integer
worked_minutes integer

status text

notes text

created_at timestamptz
updated_at timestamptz
```

Create appropriate indexes such as:

```text
employee_id
branch_id
attendance_date
clock_in_at
status
```

Consider a uniqueness constraint preventing accidental duplicate attendance sessions for the same employee/date when business rules require only one shift per day.

If multiple shifts per day could eventually exist, design the constraint appropriately rather than permanently blocking the capability.

---

# 27. ATTENDANCE EVENT HISTORY

For stronger auditing, create:

```text
attendance_events
-------------------------------
id uuid
attendance_id uuid
employee_id uuid

event_type text

metadata jsonb

created_at timestamptz
```

Possible events:

```text
clock_in
clock_out
manager_adjustment
status_change
attendance_note_added
```

This creates a chronological history of important attendance activity.

---

# 28. AUDIT LOG

Create:

```text
audit_logs
-------------------------------
id uuid

actor_user_id uuid

action text
resource_type text
resource_id uuid

old_values jsonb
new_values jsonb

metadata jsonb

created_at timestamptz
```

Audit important manager actions such as:

```text
employee_created
employee_suspended
employee_activated
branch_created
attendance_modified
attendance_note_added
settings_updated
```

Employees should not be able to modify audit logs.

---

# 29. SUPABASE STORAGE

Create private storage buckets.

Example:

```text
attendance-selfies
profile-images
```

Attendance selfies must NOT be stored in a publicly accessible bucket.

Do not save public permanent URLs inside the database.

Save:

```text
storage object path
```

Example:

```text
employeeId/2026/09/25/attendanceId/clock-in.jpg
```

or:

```text
branchId/employeeId/yyyy/mm/dd/attendanceId/clock-in.jpg
```

Managers should access images using controlled authenticated access or signed URLs.

---

# 30. STORAGE SECURITY

Create Storage policies.

Staff should only be able to create attendance images associated with themselves.

Staff should not be able to:

- Browse other employee folders.
- Delete submitted attendance evidence.
- Replace submitted attendance photos.
- Modify historical attendance evidence.

Managers may access images according to their management permissions.

Never depend on hidden UI buttons for security.

---

# 31. ROW LEVEL SECURITY

Enable RLS on every user-sensitive table.

Examples:

## Profiles

Staff:

```text
SELECT own profile
UPDATE limited own fields
```

Managers:

```text
SELECT managed employees
```

## Attendance

Staff:

```text
SELECT own attendance
INSERT through approved attendance flow
```

Staff must NOT directly update:

```text
clock_in_at
clock_out_at
employee_id
branch_id
late_minutes
status
```

Manager modification must also be controlled.

---

# 32. DATABASE FUNCTIONS / RPC

Attendance actions should preferably be performed through secure PostgreSQL functions or carefully controlled Edge Functions instead of arbitrary client inserts.

Example:

```text
clock_in()
clock_out()
```

Benefits:

- Server-authoritative timestamp
- Duplicate prevention
- Employee verification
- Branch validation
- Schedule lookup
- Late calculation
- Business rule enforcement

Example conceptual operation:

```text
Authenticated User
        ↓
clock_in RPC
        ↓
Verify account is active
        ↓
Verify employee branch
        ↓
Verify no active attendance
        ↓
Get server timestamp
        ↓
Load schedule
        ↓
Calculate late minutes
        ↓
Create attendance
        ↓
Return attendance ID
```

Do not allow the client to submit:

```text
employee_id = someone else
official clock_in timestamp
status = present
late_minutes
```

These values should be derived securely.

---

# 33. SELFIE UPLOAD TRANSACTION

Design the workflow carefully because attendance creation and photo upload involve separate systems.

Recommended approach:

```text
1. Prepare/capture selfie.
2. Request authorized attendance transaction.
3. Generate attendance record or temporary transaction.
4. Upload image to expected storage path.
5. Confirm transaction.
6. Mark attendance evidence as complete.
```

Account for situations where:

- Database insert succeeds but upload fails.
- Upload succeeds but final database update fails.
- Internet disconnects.
- User closes the application.

Do not silently create broken attendance records.

Provide recovery logic.

---

# 34. LOCATION VERIFICATION

Design GPS as an optional verification mechanism.

If enabled:

```javascript
navigator.geolocation.getCurrentPosition()
```

Attendance can record:

```text
latitude
longitude
accuracy
```

Possible verification:

```text
Inside branch geofence
Outside branch geofence
Location unavailable
```

Calculate distance between user and branch.

Do NOT treat GPS as perfectly tamper-proof.

Location should be additional evidence rather than the only authentication factor.

Allow managers to enable or disable location verification.

---

# 35. ATTENDANCE SELFIE SCREEN

Design primarily for mobile usage.

Suggested page:

```text
Good morning, Tristan

Solano Branch

Today's Attendance

Status
NOT CLOCKED IN

Scheduled
9:00 AM – 6:00 PM

[ CLOCK IN ]
```

After clock-in:

```text
Status
WORKING

Clocked In
9:03 AM

Late
3 minutes

[ CLOCK OUT ]
```

After completion:

```text
Status
COMPLETED

Time In
9:03 AM

Time Out
6:04 PM

Worked
9h 01m
```

Keep this screen extremely simple.

The employee's primary action must be obvious.

---

# 36. STAFF PAGES

Recommended routes:

```text
/app
/app/attendance
/app/history
/app/profile
/app/settings
```

The attendance page can also serve as the staff homepage.

Avoid unnecessary navigation options.

---

# 37. MANAGER ROUTES

Recommended:

```text
/manager
/manager/attendance
/manager/employees
/manager/employees/:id
/manager/branches
/manager/reports
/manager/audit
/manager/settings
```

Use nested layouts where appropriate.

---

# 38. MANAGER ATTENDANCE PAGE

Provide a professional data table.

Columns might include:

```text
Employee
Branch
Schedule
Time In
Time Out
Late
Worked Hours
Status
Evidence
Actions
```

Filters:

```text
Date
Date Range
Employee
Branch
Status
Late / On Time
Missing Clock Out
```

Search:

```text
Employee name
Employee number
```

Actions:

```text
View Details
View Selfies
Add Note
```

Avoid destructive editing unless properly authorized.

---

# 39. ATTENDANCE DETAIL

When management opens attendance details, show:

```text
Employee
Employee Number
Branch
Date
Schedule
Clock In
Clock Out
Duration
Late Minutes
Attendance Status
```

Evidence section:

```text
CLOCK IN SELFIE
image

CLOCK OUT SELFIE
image
```

Optional:

```text
Clock-in location
Clock-out location
```

Also show event history/audit trail.

---

# 40. EMPLOYEE ATTENDANCE HISTORY

Employees should be able to see their own history.

Example:

```text
September 25
Present
9:03 AM – 6:04 PM

September 24
Present
8:58 AM – 6:01 PM

September 23
Late
9:17 AM – 6:03 PM
```

Allow:

```text
Month filter
Status filter
```

Keep mobile design simple.

---

# 41. REPORTS

Managers should eventually generate:

```text
Daily Attendance Report
Weekly Attendance Report
Monthly Attendance Report
Employee Attendance Report
Late Attendance Report
Missing Clock-Out Report
Branch Attendance Report
```

Initial report export format:

```text
CSV
```

PDF can be added if needed.

Reports should include meaningful columns and totals.

---

# 42. DASHBOARD

Manager dashboard should contain useful operational information.

Example cards:

```text
25
Employees

21
Present

3
Late

4
Not Clocked In

2
Missing Clock Out
```

Sections may include:

```text
Today's Attendance

Recent Attendance

Employees Requiring Attention
```

Do not overload the dashboard.

---

# 43. NOTIFICATIONS

Design the code so notifications can eventually support:

```text
Missing clock-in
Missing clock-out
Late employee
Attendance successfully recorded
Employee suspended
```

Do not build an unnecessarily complicated notification microservice.

For MVP, use:

```text
Ant Design messages
notifications
dashboard alerts
```

---

# 44. AUTHENTICATION

Use Supabase Auth.

Initial authentication:

```text
Email + Password
```

Implement:

```text
Login
Logout
Forgot Password
Reset Password
Session restoration
Protected routes
Role-based route guards
Suspended account handling
```

Do not create a custom password system.

Never store passwords inside custom tables.

---

# 45. ACCOUNT CREATION

Managers should create or invite staff accounts.

Do not expose a public employee registration page unless explicitly required.

This prevents unauthorized people from creating staff accounts.

Possible flow:

```text
Manager
   ↓
Add Employee
   ↓
Name
Email
Employee Number
Branch
Role
Schedule
   ↓
Create/Invite Account
```

Use a secure server-side/Edge Function mechanism where Supabase service-role privileges are needed.

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to the React frontend.

---

# 46. ENVIRONMENT VARIABLES

Frontend may contain:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never expose privileged backend keys.

Create:

```text
.env
.env.example
```

Never commit actual secrets.

---

# 47. FRONTEND ARCHITECTURE

Keep the frontend structure clean and understandable.

Preferred structure:

```text
src/
│
├── assets/
│
├── components/
│   ├── common/
│   ├── attendance/
│   ├── auth/
│   ├── employees/
│   └── layout/
│
├── constants/
│   ├── attendance.js
│   ├── roles.js
│   ├── routes.js
│   └── status.js
│
├── hooks/
│   ├── useAuth.js
│   ├── useCamera.js
│   ├── useAttendance.js
│   └── usePermissions.js
│
├── layouts/
│   ├── StaffLayout.jsx
│   └── ManagerLayout.jsx
│
├── pages/
│   ├── auth/
│   ├── staff/
│   ├── manager/
│   └── errors/
│
├── services/
│   ├── supabase.js
│   ├── auth.service.js
│   ├── attendance.service.js
│   ├── employee.service.js
│   ├── branch.service.js
│   ├── storage.service.js
│   └── report.service.js
│
├── utils/
│   ├── date.js
│   ├── image.js
│   ├── location.js
│   ├── permissions.js
│   └── validation.js
│
├── App.jsx
└── main.jsx
```

Do not create folders simply for architectural appearance.

If only one file exists for a concept, keep the structure reasonable.

---

# 48. SERVICE LAYER

Components should not contain huge Supabase queries.

Separate data access into service files.

Example:

```javascript
attendanceService.getTodayAttendance()
attendanceService.clockIn()
attendanceService.clockOut()
attendanceService.getHistory()
```

Components should focus on:

```text
Rendering
Interaction
State
```

Services should focus on:

```text
Database
Storage
Supabase RPC
```

---

# 49. CUSTOM HOOKS

Use hooks only where they provide actual reusable behavior.

Examples:

```text
useAuth
useAttendance
useCamera
```

Do not convert every function into a custom hook.

---

# 50. ANT DESIGN

Use Ant Design professionally.

Use components such as:

```text
Layout
Menu
Card
Table
Form
Input
Select
DatePicker
Modal
Drawer
Tag
Badge
Statistic
Avatar
Descriptions
Tabs
Skeleton
Spin
Result
Alert
Empty
Dropdown
Button
Upload only for non-attendance use cases
```

Do NOT use Ant Design Upload for attendance selfies.

Attendance must use the camera workflow.

---

# 51. UI/UX DESIGN DIRECTION

The application should look like a real workforce management product.

Design characteristics:

```text
Professional
Minimal
Clean
Modern
Readable
Mobile friendly
Accessible
Consistent
Trustworthy
```

Avoid:

- Excessive gradients.
- Random bright colors.
- Huge rounded cards everywhere.
- Glassmorphism.
- Unnecessary animations.
- Excessive shadows.
- Giant hero sections inside dashboards.
- Decorative charts.
- Emoji-heavy UI.

This is operational software, not a marketing landing page.

---

# 52. COLOR SYSTEM

Use a restrained professional palette.

Example conceptual semantic colors:

```text
Primary → brand action
Success → present/completed
Warning → late
Error → missing/problem
Neutral → inactive/general information
```

Use Ant Design theme tokens instead of manually scattering colors throughout CSS.

Status colors must stay consistent throughout the application.

---

# 53. RESPONSIVE DESIGN

The staff interface is **mobile-first**.

The manager interface must support:

```text
Mobile
Tablet
Laptop
Desktop
```

Manager sidebar:

```text
Desktop → permanent sider
Mobile → drawer navigation
```

Tables should have appropriate horizontal scrolling or responsive alternatives on small screens.

---

# 54. LOADING STATES

Every asynchronous operation must provide feedback.

Use:

```text
Skeleton
Spin
Button loading
Table loading
```

Do not allow users to repeatedly click attendance buttons while transactions are processing.

---

# 55. EMPTY STATES

Create meaningful empty states.

Example:

```text
No attendance records found for this date.
```

Not:

```text
No Data
```

when additional context can improve usability.

---

# 56. ERROR HANDLING

Handle:

```text
No internet
Supabase unavailable
Camera permission denied
Camera not available
Location permission denied
Selfie upload failed
Attendance creation failed
Session expired
Account suspended
Duplicate clock-in
Clock-out without clock-in
Invalid branch
Storage failure
```

Provide human-readable messages.

Do not expose internal database errors directly to users.

---

# 57. NETWORK FAILURE

Attendance is critical.

Do not falsely tell the employee:

```text
Attendance recorded successfully
```

until the backend confirms it.

If the internet fails:

```text
Attendance could not be submitted.
Your attendance has NOT been recorded.
Please reconnect and try again.
```

Avoid silently storing official attendance locally unless a carefully designed offline synchronization system exists.

Offline attendance synchronization should be considered a future feature because it introduces timestamp and tampering concerns.

---

# 58. DUPLICATE PROTECTION

Prevent:

```text
double clock-in
double clock-out
rapid repeated submission
multiple attendance records accidentally created
```

Protection must exist at:

```text
UI level
AND
database level
```

Database constraints/functions remain the final authority.

---

# 59. SECURITY REQUIREMENTS

Implement defense in depth.

Never assume that because the frontend hides something, the user cannot access it.

Protect against:

```text
Changing employee_id manually
Changing branch_id
Changing official timestamp
Accessing another user's selfie
Deleting attendance evidence
Updating completed attendance
Calling manager endpoints as staff
Manipulating URLs
Direct Supabase requests
```

Use:

```text
Authentication
RLS
Database constraints
RPC functions
Storage policies
Role validation
Audit logs
```

---

# 60. DATA PRIVACY

Attendance selfies are sensitive employee records.

Follow privacy-by-design principles.

Implement:

- Private image storage.
- Role-restricted access.
- Minimum necessary data collection.
- Auditability.
- Account access controls.
- Defined retention capability.
- Controlled report access.

Do not expose attendance images publicly.

Design the system so a future retention policy can automatically archive or delete old images according to company policy and applicable requirements.

---

# 61. MANAGER ATTENDANCE CORRECTIONS

Do not silently allow managers to overwrite official attendance data.

If attendance correction becomes available, require:

```text
Reason
Manager identity
Original value
New value
Timestamp
```

Store the modification in the audit log.

Example:

```text
Original:
Clock In = 9:31 AM

Corrected:
Clock In = 9:05 AM

Reason:
System connectivity issue

Changed By:
Manager

Changed At:
...
```

Historical accountability is important.

---

# 62. SEARCH

Implement useful search.

Managers should be able to search:

```text
Employee name
Employee number
```

Use appropriate database filtering.

Do not load thousands of records and filter everything exclusively inside the browser.

---

# 63. PAGINATION

Manager tables should use proper pagination.

Examples:

```text
Attendance
Employees
Audit logs
```

Do not retrieve the entire database for every page load.

---

# 64. PERFORMANCE

Optimize sensibly.

Use:

```text
Database indexes
Pagination
Image compression
Lazy image loading
Query filtering
Reusable requests
```

Do not prematurely introduce:

```text
Redis
Kafka
Microservices
GraphQL
Kubernetes
Docker-only architecture
```

for this application.

---

# 65. IMAGE OPTIMIZATION

Attendance photos do not need DSLR-level resolution.

Before upload:

- Resize oversized images.
- Compress image.
- Preserve enough facial detail for verification.
- Keep watermark readable.

Example target range:

```text
720p–1080p equivalent
```

Avoid uploading unnecessarily huge images from modern phone cameras.

---

# 66. IMAGE FILE NAMING

Do not rely on human-readable employee names as unique file identifiers.

Prefer:

```text
UUIDs
attendance IDs
user IDs
```

Example:

```text
attendance/
user_uuid/
2026/
09/
25/
attendance_uuid-clock-in.jpg
```

---

# 67. ACCESSIBILITY

Follow basic accessibility best practices:

- Proper labels.
- Keyboard navigation.
- Adequate contrast.
- Clear focus states.
- Semantic buttons.
- Accessible error messages.
- Do not communicate statuses exclusively through color.

Example:

Do not show only a yellow indicator.

Show:

```text
Late
```

plus the visual status.

---

# 68. PWA SUPPORT

Because staff primarily use phones, prepare the React/Vite app to eventually operate as a Progressive Web App.

Possible capabilities:

```text
Install to Home Screen
App-like display
Application icon
Splash behavior
Cached static assets
```

However, do not implement unsafe offline attendance submission as part of basic PWA caching.

---

# 69. OPTIONAL FUTURE MOBILE WRAPPER

The initial system should remain:

```text
React + Vite
```

If stronger mobile hardware integration is eventually needed, the existing frontend could later be wrapped using something such as Capacitor.

Do not introduce this during the MVP unless specifically requested.

---

# 70. MVP FEATURES

Prioritize these first.

## Authentication

- Login
- Logout
- Password reset
- Protected routes
- Role authorization

## Staff

- Today's attendance
- Camera selfie capture
- Clock in
- Clock out
- Attendance history
- Profile

## Manager

- Dashboard
- Attendance records
- Attendance details
- Employee management
- Branch management
- Employee attendance history
- Basic reports

## Security

- RLS
- Storage policies
- Private selfies
- Server-authoritative timestamps
- Role validation

---

# 71. PHASE 2 FEATURES

After MVP is stable:

```text
GPS verification
Geofencing
Advanced schedules
CSV/PDF reports
Attendance corrections
Audit-log interface
Notifications
Absence management
Leave integration
PWA install support
```

---

# 72. FUTURE POSSIBILITIES

Design architecture so these could eventually be introduced without rewriting the entire system:

```text
Multiple managers
Multiple branches
Supervisor roles
Leave requests
Shift scheduling
Overtime requests
Break monitoring
Payroll export
Holiday calendars
QR verification
Device verification
Face matching
Push notifications
Offline attendance with secure synchronization
```

Do NOT implement them unless requested.

---

# 73. ATTENDANCE BUSINESS RULES

Implement clear business rules.

Example:

### Clock In

Allowed when:

```text
Authenticated
Account active
Assigned to branch
No active attendance session
Camera photo captured
```

### Clock Out

Allowed when:

```text
Authenticated
Account active
Active attendance session exists
Clock-out photo captured
```

### Late

Calculate:

```text
clock_in_at
>
scheduled_start + grace_period
```

### Missing Clock Out

Possible when:

```text
clock_in exists
AND
clock_out is null
AND
expected shift has already ended
```

Never rely exclusively on frontend logic for these rules.

---

# 74. EXAMPLE APPLICATION FLOW

```text
Employee opens system
        ↓
Supabase restores session
        ↓
System loads profile
        ↓
Role detected
        ↓
Staff Dashboard
        ↓
Today's Attendance
        ↓
CLOCK IN
        ↓
Camera Permission
        ↓
Selfie
        ↓
Preview
        ↓
Submit
        ↓
Secure Backend Transaction
        ↓
Database Time
        ↓
Image Storage
        ↓
Attendance Recorded
        ↓
Success Screen
```

Manager:

```text
Manager Login
       ↓
Manager Dashboard
       ↓
Today's Attendance
       ↓
Select Employee
       ↓
Attendance Details
       ↓
Clock-In Selfie
Clock-Out Selfie
Times
Schedule
Late Status
Audit History
```

---

# 75. DATABASE MIGRATIONS

Do not manually create random tables only through the Supabase UI.

Maintain SQL migration files where practical.

Example:

```text
supabase/
└── migrations/
```

Migrations should contain:

```text
Tables
Indexes
Constraints
RLS
Policies
Functions
Triggers
```

This makes database changes reproducible.

---

# 76. DATABASE NAMING

Use consistent naming conventions.

Database:

```text
snake_case
```

Examples:

```text
attendance_records
clock_in_at
employee_id
```

React:

```text
camelCase
PascalCase components
```

Examples:

```text
AttendancePage.jsx
attendanceService.js
getTodayAttendance()
```

---

# 77. DATABASE CONSTRAINTS

Use meaningful constraints.

Examples:

```text
late_minutes >= 0
worked_minutes >= 0
geofence_radius >= 0
```

Validate role/status values.

Use foreign key behavior deliberately.

Do not allow accidental cascading deletion of attendance history when an employee becomes inactive.

---

# 78. TESTING

At minimum test critical scenarios.

Authentication:

```text
Valid login
Invalid login
Suspended user
Unauthorized manager route
```

Attendance:

```text
Successful clock-in
Duplicate clock-in
Successful clock-out
Clock-out without clock-in
Upload failure
Camera denial
Network failure
Late calculation
```

Security:

```text
Staff requesting another user's attendance
Staff requesting another user's selfie
Staff attempting to modify timestamp
Staff attempting manager action
```

---

# 79. CODE QUALITY

Follow these requirements:

- Clear variable names.
- Small focused functions.
- Avoid massive React components.
- Avoid repeated Supabase queries.
- Centralize constants.
- Centralize route configuration.
- Centralize date formatting.
- Reuse status components.
- Remove dead code.
- Remove placeholder imports.
- Avoid `any` style loose thinking even when using JavaScript.
- Document complicated security logic.

Do not add comments explaining obvious code.

Comments should explain **why**, not repeat **what** the code already says.

---

# 80. DO NOT DO THESE

Do NOT:

```text
Create a fake backend
Store attendance only in localStorage
Store passwords manually
Use public attendance image URLs
Expose service role keys
Trust client timestamps
Trust client-supplied roles
Trust client employee IDs
Allow arbitrary image uploads for attendance
Store base64 images directly inside PostgreSQL
Disable RLS just because policies are difficult
Hard-code branch names
Hard-code employee IDs
Put all logic in App.jsx
Put all Supabase calls directly inside components
Build microservices
Add Docker as a requirement
Add Redux without clear need
Create unnecessary global state
```

---

# 81. USER EXPERIENCE PRIORITY

An employee should ideally complete attendance in approximately:

```text
Open app
↓
Clock In
↓
Take selfie
↓
Submit
```

Do not force unnecessary forms during every attendance transaction.

Employee information should already be known from the authenticated account.

---

# 82. MOBILE CAMERA EXPERIENCE

The camera page should look approximately like:

```text
┌─────────────────────────────┐
│        CLOCK IN             │
│                             │
│   Position your face        │
│   inside the frame.         │
│                             │
│     ┌───────────────┐       │
│     │               │       │
│     │ CAMERA VIEW   │       │
│     │               │       │
│     └───────────────┘       │
│                             │
│            ●                │
│                             │
│        Take Photo           │
└─────────────────────────────┘
```

Preview:

```text
┌─────────────────────────────┐
│      REVIEW PHOTO           │
│                             │
│        [ SELFIE ]           │
│                             │
│ Tristan Justine Yuzon       │
│ CLOCK IN                    │
│ Sep 25, 2026 • 9:03 AM      │
│ Solano Branch               │
│                             │
│ [ Retake ]     [ Submit ]   │
└─────────────────────────────┘
```

---

# 83. MANAGER DASHBOARD EXPERIENCE

Desktop concept:

```text
┌────────────┬─────────────────────────────────┐
│            │ Dashboard                       │
│ Dashboard  │                                 │
│ Attendance │ [25] [21] [3] [4] [2]         │
│ Employees  │ Staff Present Late Missing...  │
│ Branches   │                                 │
│ Reports    │ Today's Attendance              │
│ Audit Logs │                                 │
│ Settings   │ Employee | In | Out | Status   │
│            │ --------------------------------│
│            │ Tristan  |9:03| --  | Working  │
│            │ John     |8:54|6:02 | Complete │
└────────────┴─────────────────────────────────┘
```

Mobile manager interface should switch to drawer navigation.

---

# 84. ATTENDANCE IMAGE VIEWER

Managers should be able to inspect photos without navigating away from context.

Use:

```text
Ant Design Image
Preview
Modal
Drawer
```

Display relevant metadata alongside the image.

Do not expose raw storage paths to the user interface unnecessarily.

---

# 85. CONFIGURATION

Create an application settings mechanism for values such as:

```text
organization_name
default_timezone
default_grace_period
require_location
enable_geofence
attendance_photo_quality
```

Do not hard-code operational policies inside multiple frontend files.

---

# 86. MANAGER SETTINGS

Possible sections:

```text
Organization
Attendance
Location Verification
Schedules
Security
Data Retention
```

Implement only settings supported by actual backend functionality.

Do not create fake switches.

---

# 87. DATA RETENTION

Plan for future configurable retention.

Possible policy:

```text
Attendance metadata → retain according to business/legal requirements
Attendance photos → configurable retention
Audit logs → long-term administrative record
```

Do not automatically delete historical data without defined policy.

---

# 88. INITIAL IMPLEMENTATION ORDER

Implement the project incrementally.

## Milestone 1 — Foundation

Create:

```text
React/Vite structure
Ant Design theme
Supabase client
React Router
Layouts
Environment setup
```

---

## Milestone 2 — Database

Create:

```text
profiles
branches
employee_branches
work_schedules
attendance_records
attendance_events
audit_logs
app_settings
```

Add:

```text
constraints
indexes
triggers
RLS
```

---

## Milestone 3 — Authentication

Implement:

```text
login
logout
session restoration
protected routes
role guards
password reset
```

---

## Milestone 4 — Manager Foundation

Implement:

```text
manager layout
dashboard
employee management
branch management
```

---

## Milestone 5 — Attendance Engine

Implement secure:

```text
clock_in
clock_out
attendance validation
schedule checks
late calculation
duplicate prevention
```

---

## Milestone 6 — Camera

Implement:

```text
camera permissions
front camera
capture
canvas
image compression
watermark
preview
retake
```

---

## Milestone 7 — Storage

Implement:

```text
private bucket
secure paths
upload
retrieval
signed access
storage policies
```

---

## Milestone 8 — Staff Attendance UI

Implement:

```text
today status
clock in
clock out
success state
attendance history
```

---

## Milestone 9 — Manager Attendance

Implement:

```text
attendance table
filters
search
attendance details
selfie preview
employee attendance history
```

---

## Milestone 10 — Reports

Implement:

```text
daily
monthly
employee
late
missing clock-out

CSV export
```

---

## Milestone 11 — Auditing

Implement:

```text
attendance event history
manager action logs
audit viewer
```

---

## Milestone 12 — Quality

Test:

```text
responsive UI
permissions
RLS
camera errors
network failures
database edge cases
storage failures
```

---

# 89. FIRST VERSION DATABASE RELATIONSHIP

Conceptually:

```text
auth.users
    │
    │ 1:1
    ▼
profiles
    │
    ├───────────────┐
    │               │
    ▼               ▼
employee_branches   work_schedules
    │
    ▼
branches

profiles
    │
    │ 1:N
    ▼
attendance_records
    │
    ├─────────────► branches
    │
    ▼
attendance_events

profiles
    │
    ▼
audit_logs
```

---

# 90. SECURITY PRIORITY ORDER

Security should be implemented in this order:

```text
1. Authentication
2. RLS
3. Storage policies
4. Database constraints
5. Secure RPC functions
6. Role guards
7. UI permissions
```

UI permissions are the final convenience layer—not the primary security mechanism.

---

# 91. DEFINITION OF SUCCESS

The project is successful when this scenario works reliably:

```text
Employee logs in.

Employee taps Clock In.

The application opens the phone camera.

Employee takes a new selfie.

The application previews and watermarks the photo.

Employee confirms.

The server creates an attendance record using the official server time.

The selfie is stored privately.

The employee sees successful clock-in.

The manager opens the dashboard.

The manager immediately sees that employee as present.

The manager opens the attendance entry.

The manager can see:

Employee
Branch
Official Time In
Schedule
Late status
Attendance selfie

At the end of the shift, the employee repeats the process for Clock Out.

The manager can later retrieve that exact attendance record days, weeks, or months later.
```

This must replace the current Messenger-based workflow.

---

# 92. IMPORTANT ARCHITECTURAL DECISIONS

Use the following architecture unless a specific technical limitation requires adjustment:

```text
React + Vite
      │
      ├── Supabase Auth
      │
      ├── PostgreSQL
      │
      ├── RLS
      │
      ├── Storage
      │
      └── RPC / Edge Functions
```

Do NOT create:

```text
React
   ↓
Express
   ↓
Supabase
```

without a real requirement.

Supabase already provides the majority of backend capabilities needed.

---

# 93. HOW YOU SHOULD WORK AS THE AI DEVELOPMENT AGENT

Before implementing each milestone:

1. Inspect the existing project.
2. Understand existing code.
3. Identify files that need modification.
4. Avoid destroying working features.
5. Reuse existing patterns where reasonable.
6. Explain important architecture decisions.
7. Implement the milestone completely.
8. Check imports.
9. Check lint/build errors.
10. Review security implications.
11. Remove unused code.
12. Verify mobile responsiveness.

Do not continuously rewrite the entire project.

Build incrementally.

---

# 94. WHEN REQUIREMENTS ARE AMBIGUOUS

Do not stop development for minor decisions.

Make a sensible professional assumption based on:

```text
Security
Maintainability
Usability
Simplicity
Database integrity
```

Document meaningful assumptions.

Only request clarification when proceeding incorrectly could fundamentally change the system architecture or business rules.

---

# 95. OUTPUT EXPECTATIONS

When implementing a milestone, provide:

```text
1. What was implemented
2. Architecture decisions
3. Files created
4. Files modified
5. Database changes
6. Security changes
7. Important testing instructions
8. Remaining work
```

When providing code:

- Provide complete code where practical.
- Never use vague placeholders such as:

```text
// implement logic here
// your existing code
// etc.
```

unless explicitly explaining pseudocode.

Generated code must be coherent with the existing project.

---

# 96. FINAL SYSTEM GOAL

The finished system should transform this:

```text
Employee
↓
Take Selfie
↓
Messenger
↓
Photos mixed inside chats
↓
Difficult attendance audit
```

into:

```text
Employee
↓
Authenticated Account
↓
Clock In
↓
Live Camera Selfie
↓
Secure Attendance Transaction
↓
Supabase Database + Private Storage
↓
Searchable Attendance History
↓
Manager Dashboard
↓
Reports + Audit Trail
```

The key value of this application is not merely taking selfies.

The actual value is creating a **reliable digital chain of attendance evidence** connecting:

```text
WHO
Employee identity

WHAT
Clock In / Clock Out

WHEN
Server-authoritative timestamp

WHERE
Assigned branch / optional location verification

EVIDENCE
Newly captured attendance selfie

RECORD
Structured PostgreSQL attendance entry

AUDITABILITY
Historical records and audit trail
```

Every major architectural decision should support this objective.

---

# 97. STARTING INSTRUCTION

Begin by reviewing the current React + Vite + Ant Design + Supabase project structure.

Do not immediately build every feature.

Start with:

```text
MILESTONE 1 — PROJECT FOUNDATION AND ARCHITECTURE
```

Inspect the existing codebase first.

Then provide the proposed final project structure, identify existing files that should remain or change, establish the Supabase client architecture, authentication foundation, routing architecture, Ant Design theme structure, layouts, services, hooks, utilities, and constants.

After establishing the foundation, proceed milestone-by-milestone.

Keep the implementation production-oriented while remaining understandable to a junior developer maintaining the project later.