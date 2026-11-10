# Aqsa Education Platform — implementation and remaining work

Reviewed: 5 October 2026.

This document describes the code currently in this repository and the project decisions made so far. “Implemented” means the code exists; it does not mean every endpoint has passed a real database test or is ready for production. The live Supabase database was not inspected for this documentation review.

## 1. What we are building

The project has two parts:

- A public school website: about us, school history, general information, public announcements, a photo gallery, and visitor queries/contact.
- A private portal for ADMIN, TEACHER, STUDENT, and PARENT accounts: school records, attendance, marks, results, academic sessions, and private notifications.

The repository currently contains the backend. No frontend application is present in the tracked source reviewed here.

## 2. Technology and structure

| Item | Current choice |
| --- | --- |
| Server | Node.js, Express 5, CommonJS (`require`) |
| Database access | Prisma 6, PostgreSQL; Supabase is the intended database host |
| Validation | Zod schemas and some explicit controller checks |
| Authentication | bcrypt password hashes and JWT login tokens |
| Live notifications | Socket.IO 4 |
| Entry point | `backend/app.js`, port 5000 |
| Dependencies | Root `package.json` and `package-lock.json` |
| Controllers | `backend/controllers/` |
| Routes | `backend/routes/` |
| Middleware | `backend/middleware/` |
| Request schemas | `backend/schemas/` |
| Database schema | `backend/prisma/schema.prisma` |
| Existing tests | `backend/tests/student_progression.test.js` |

Normal request flow:

```text
Request → route → authentication → role check → validation → controller → Prisma → database
```

Public announcement reads do not require login. Notification input validation currently happens inside its controller.

## 3. Database models

There are currently 12 Prisma models:

| Model | Purpose |
| --- | --- |
| User | Login identity, password hash, role, active status |
| Teacher | Teacher profile connected to one User |
| Parent | Parent profile connected to one User; can have multiple children |
| Student | Student profile, parent, current class, roll number and dates |
| Class | Class name and assigned class teacher |
| Subject | Subject belonging to a class, with an assigned subject teacher |
| academicsession | Academic year with start/end dates, active flag and closure time |
| Enrollment | Student's class membership in a particular academic session |
| Attendance | Daily attendance linked to an enrollment; retains legacy studentId |
| Grade | One exam mark for one enrollment and subject |
| Announcement | Public website notice, draft/published state and author |
| Notification | Private message, sender, recipient, read state and creation time |

Important ID distinctions:

- `User.id` identifies a login account. Notification sender/recipient IDs use this ID.
- `Teacher.id`, `Student.id`, and `Parent.id` identify profiles, not login accounts.
- `Enrollment.id` identifies a student in a specific class and year. Attendance and results use it so different years can be separated.
- `Class.teacherId` is the class teacher. `Subject.teacherId` is the teacher allowed to enter that subject's marks. One teacher can teach multiple subjects.

Database uniqueness includes user email, student roll number, one enrollment per student/session, one grade per enrollment/subject/exam, and one attendance record per enrollment/date.

Compatibility fields still exist: `Teacher.subject` is a text field, `Student.classId` stores the current class, `Subject.teacherId` is nullable, and `Attendance.enroll_id` is nullable. New request validation can be stricter than these older database fields.

## 4. Implemented features

### Accounts and access

- Registration creates a User and hashes the password.
- Login verifies the password and issues a JWT lasting one day.
- HTTP authentication checks the JWT and looks up the current user's role and active state.
- Role middleware restricts protected routes.
- Inactive users cannot log in or use protected HTTP endpoints with previously issued tokens.

Registration is not yet safe for public deployment: its public endpoint accepts an ADMIN role. Restrict account provisioning before publishing the application. Registration alone also does not create a Teacher, Parent, or Student profile; the profile controllers do that.

### School records

Teachers, parents, students, classes, and subjects have create, list, get-one, update, and delete routes. Teacher/parent/student creation creates a User and the related profile. Foreign-key checks and delete restrictions protect related records in applicable controllers/database relations.

Students need an existing class and parent. Subjects need an existing class and teacher assignment. Normal withdrawal should use the progression endpoint rather than deleting school history.

### Sessions and enrollments

- Sessions support create, list, lookup by name, and update.
- Dates must be in the correct order. Closed sessions cannot be edited or reopened through the existing update controller.
- Enrollment connects a student, class, and session; duplicate student/session membership is restricted.
- Enrollment routes include create, list, get-one, update class, and delete with controller restrictions.
- Finalized enrollments are protected from ordinary edits/deletion.

The chosen school cycle is one academic year. There is no semester model.

### Attendance

- A class teacher marks attendance using `enroll_id`, date, and PRESENT/ABSENT status.
- Dates are normalized to UTC midnight and checked against the session dates.
- Duplicate attendance for the same enrollment/day is rejected.
- The class teacher can correct an attendance record's status.
- Admins can view attendance; teachers, students and parents are limited by the controller's class/ownership checks.
- The summary reports present, absent, total recorded days, and percentage.

```text
Attendance percentage = present / (present + absent) × 100
```

No records produces 0%. This measures recorded attendance only; there is no school calendar that treats unmarked days as absences.

### Marks and results

- Subject teachers enter and update marks for their assigned subjects.
- Exams are MID1, MID2, and FINAL, each scored out of 100.
- The result endpoint groups marks by subject and calculates a combined result for an enrollment.
- Missing exams or no required subjects produce a PENDING result.
- Combined results are accessible to admins, the assigned class teacher, the student, and the linked parent, subject to ownership checks.

```text
Subject percentage = MID1 × 0.25 + MID2 × 0.25 + FINAL × 0.50
Overall percentage = sum of completed subject percentages / number of required subjects
```

All subjects have equal weight in the overall result. The complete overall result is returned only when all required exams are present.

| Percentage | Letter grade |
| --- | --- |
| 80 or higher | A1 |
| 70 to below 80 | A |
| 60 to below 70 | B |
| 50 to below 60 | C |
| 40 to below 50 | D |
| Below 40 | Fail |

Threshold decisions use the unrounded percentage. Displayed percentages are rounded to two decimals. `overallStatus` is PASSED only if every subject passes; an average letter grade alone does not decide promotion. For example, a high average with one subject below 40 still has FAILED status.

### Student progression

- Withdrawal deactivates the account and marks enrollment WITHDRAWN while retaining history.
- Admin selects the source session/class and destination session/class for bulk promotion.
- Promotion requires all three exams in every required subject and at least 40% in each subject.
- Passing students receive a next-session enrollment; the source enrollment becomes COMPLETED.
- Complete failing results become COMPLETED without automatic promotion. Their next enrollment is an admin decision.
- Incomplete results remain ACTIVE and are reported as pending.
- Final-class graduation marks eligible enrollments GRADUATED without creating a next enrollment; graduate accounts remain active.
- Closing a session requires resolving all ACTIVE enrollments. Closure does not automatically activate the next session.

Processing is an admin action, not a scheduled job. Read [student-progression.md](student-progression.md) for request examples, retries and limitations. Separate database calls are used; there is no transaction. The in-memory lock only covers progression requests in one server process.

### Public announcements

- Admins create, edit, publish/unpublish and delete announcements.
- New announcements default to drafts.
- Public list and get-one endpoints return published notices only.
- A private student issue belongs in notifications, not a public announcement.

An admin-only draft listing/get-one workflow still needs adding for an admin editing screen: the current GET endpoints hide drafts even from admins.

### Private notifications and sockets

- Admin creates a message for a specific User ID.
- The controller validates the recipient and message, saves the notification, then emits `notification:new` to `user:<recipientId>`.
- Users can list their own notifications and mark only their own records as read.
- Socket connection middleware verifies the JWT and active account.
- The server derives room membership from the verified identity, not a browser-supplied recipient ID.
- Connections are disconnected when their JWT expires.
- Express and Socket.IO share one HTTP server. `app.set('io', io)` makes it available to controllers through `req.app.get('io')`.

```text
Recipient logs in → socket connects with token → server verifies → joins private room
Admin POST → save notification → emit event to room → connected frontend displays it
Offline recipient → later GET their saved notifications
```

The frontend must send the token through Socket.IO's `auth.token` option and listen for `notification:new`. Fetch saved notifications on initial load and reconnect; deduplicate by notification ID. Live delivery is not a substitute for database history.

Currently notifications are manual, one recipient per request. Low-attendance alerts, failed-result alerts, bulk parent notifications, unread counts and read-state socket synchronization are not implemented. To notify a student and parent, use their separate User IDs and separate notification records.

Account activity is checked at connection time; withdrawing a user does not immediately disconnect an existing socket. Notification creation rejects inactive recipients, but immediate connection revocation remains an improvement to implement.

## 5. API reference

Base URL locally: `http://localhost:5000`. Protected HTTP requests use `Authorization: Bearer <token>`.

| Path | Methods | Access and purpose |
| --- | --- | --- |
| `/api/auth/register` | POST | Currently public account creation; must restrict roles |
| `/api/auth/login` | POST | Public login |
| `/api/teachers` | POST, GET | Admin create/list |
| `/api/teachers/:id` | GET, PATCH, DELETE | Admin profile operations |
| `/api/parents` | POST, GET | Admin create/list |
| `/api/parents/:id` | GET, PATCH, DELETE | Admin profile operations |
| `/api/students` | POST, GET | Admin create/list |
| `/api/students/:id` | GET, PATCH, DELETE | Admin profile operations |
| `/api/classes` | POST, GET | Admin create/list |
| `/api/classes/:id` | GET, PUT, DELETE | Admin class operations; update uses PUT |
| `/api/subjects` | POST, GET | Admin create/list |
| `/api/subjects/:id` | GET, PATCH, DELETE | Admin subject operations |
| `/api/sessions` | POST, GET | Admin create/list |
| `/api/sessions/search?name=...` | GET | Admin lookup by session name |
| `/api/sessions/:id` | PATCH | Admin update |
| `/api/enrollments` | POST, GET | Admin create/list |
| `/api/enrollments/:id` | GET, PATCH, DELETE | Admin; PATCH changes class only |
| `/api/attendance` | POST | Class teacher marks attendance |
| `/api/attendance/enrollment/:id` | GET | Attendance summary; ownership checks |
| `/api/attendance/:id` | PATCH | Class teacher corrects record status |
| `/api/grades` | POST | Assigned subject teacher enters marks |
| `/api/grades/:id` | PATCH | Assigned subject teacher updates marks only |
| `/api/results/enrollment/:id` | GET | Subject and overall result; ownership checks |
| `/api/progression/enrollments/:id/withdraw` | PATCH | Admin withdrawal |
| `/api/progression/promote` | POST | Admin bulk class promotion |
| `/api/progression/graduate` | POST | Admin final-class graduation |
| `/api/progression/sessions/:id/close` | PATCH | Admin session closure |
| `/api/announcements` | POST | Admin create |
| `/api/announcements` | GET | Public published list |
| `/api/announcements/:id` | GET | Public published notice |
| `/api/announcements/:id` | PATCH, DELETE | Admin update/delete |
| `/api/notifications` | POST | Admin send |
| `/api/notifications` | GET | Logged-in user's own messages |
| `/api/notifications/:id/read` | PATCH | Recipient marks their message read |

Current field names matter: attendance uses `enroll_id`; grades use `enrollmentId`; sessions use `enddate` and `isactive`.

## 6. Running locally and database status

Install dependencies from the project root:

```powershell
npm install
```

Provide `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` in `backend/.env`. Optional `FRONTEND_URL` configures socket browser CORS; its default is `http://localhost:5173`. Keep credentials out of Git and documentation. HTTP Express CORS currently allows all origins and should be configured for deployment separately.

Start from the backend directory so its `.env` is loaded:

```powershell
cd backend
node app.js
```

The root npm start/dev scripts currently target `app.js`, but the real entry point is `backend/app.js`. Fix the scripts and environment-loading path before relying on `npm start` from the root.

From `backend`, check the schema and migration status:

```powershell
npx prisma validate
npx prisma migrate status
```

Only the initial migration and two September session/enrollment migrations are present in the reviewed migration folder. Later model changes are in `schema.prisma`; this review does not establish whether they were applied to Supabase through other means. Reconcile schema, migration history and actual development database before proceeding. A successful `prisma validate` does not prove the database matches.

Once the development migration history is understood, create the required migration and generate the client:

```powershell
npx prisma migrate dev --name complete_portal_models
npx prisma generate
```

Review generated SQL and existing data first, especially grade changes, new required fields and unique constraints. Do not accept a database reset blindly. Production uses reviewed committed migrations and `prisma migrate deploy`, not `migrate dev`.

## 7. What has been tested

| Evidence | What it establishes |
| --- | --- |
| User reported earlier Thunder Client testing complete | Earlier endpoints were manually exercised; exact cases/responses were not recorded |
| Prisma validation after Notification addition passed | Schema definitions and relations were valid at that point |
| Existing progression test suite | Mocked tests for progression logic; not proof of real database behavior |
| Notification controller checks in prior work | Mocked admin checks, validation, sender identity, private listing and read protection |
| Socket smoke test in prior work | Real local Socket.IO transport with mocked user lookup: invalid JWT rejection, room membership and event receipt |

The notification/socket checks were one-off scripts, not a committed reusable test suite. They did not write to the database. Full end-to-end testing of all recent work is still pending. This documentation task did not rerun tests.

Run the existing progression suite from the project root:

```powershell
node --test backend/tests/student_progression.test.js
```

`npm test` is currently a placeholder that exits with an error.

## 8. Remaining work, in recommended order

### First: finish and verify the current backend

1. Reconcile and apply database migrations, regenerate Prisma Client, and verify server startup.
2. Restrict public registration so visitors cannot create privileged accounts.
3. Mount the existing not-found and error-handler middleware after routes; review their responses before deployment.
4. Fix start/dev/test scripts so another developer can run the project reliably.
5. Test the latest grades, results, progression, announcements and notifications against a development database.
6. Add reusable notification/socket tests and broader access-control tests.
7. Add admin draft announcement reads and the portal lookup APIs described below.

### Then: complete portal integration

- Add a current-user/profile endpoint so each role can discover its own profile.
- Provide teachers with their assigned subjects/classes and permitted enrollment/student lists. Current general CRUD lists are admin-only.
- Provide students with their own enrollment/session history and parents with their children's enrollments, so they can select a result or attendance year without knowing IDs manually.
- Build frontend login, role-based pages, attendance/marks entry, results, progression controls, announcements and notification bell.
- Connect the frontend socket client; handle login/logout, expiry, connection errors and reconnect fetching.
- Add immediate socket disconnection when an account is deactivated.
- Decide whether alerts are admin-triggered or automatic. Define the low-attendance threshold, reporting period, recipients and duplicate prevention before implementing automation.

### Then: public school website

- Build home/about/history/general school information pages. Static content does not need database CRUD unless admins must edit it.
- Display published announcements using the existing public GET APIs.
- Add gallery storage/upload, image metadata, admin management and public listing. Photos should be stored in file/object storage; the database stores metadata/URLs.
- Add public contact/query submission and an admin view/reply/status workflow. Clarify whether “remarks” means private feedback or public testimonials before modeling it.

### Before production

- Preserve historical curriculum and teacher assignments per academic year. Current results use the class's current subject list, so changing it can change historical results.
- Strengthen consistency for multi-step writes and concurrent progression/marks updates. Existing retry handling and one-process locks are not full database concurrency protection.
- Add pagination for growing lists, including notifications.
- Define password reset/change and account recovery behavior.
- Restrict deployment CORS, validate environment settings, add rate limits and consistent error logging.
- Review dependency audit findings. The Socket.IO installation reported 8 vulnerabilities across the dependency tree; assess them rather than applying forced breaking upgrades blindly.
- Configure hosting, HTTPS, database backups and production migration steps.
- If deploying multiple Node processes, plan shared socket-room delivery and shared progression coordination; current setup assumes one process.

These are different scopes: portal feature completion, public-site work, and production hardening. A precise completion percentage would be misleading until the final scope is agreed.

## 9. End-to-end testing checklist

Use a development database and keep the IDs returned by requests; never assume ID 1 exists.

- [ ] Create/login an admin using the chosen protected provisioning method.
- [ ] Create teacher → class → parent → student → subject with correct teacher assignment.
- [ ] Create academic session and enrollment using real IDs.
- [ ] Log in as the class teacher; mark and correct attendance, check totals and percentage.
- [ ] Reject duplicate attendance, wrong teacher, invalid dates and finalized-enrollment edits.
- [ ] Enter MID1/MID2/FINAL for every subject using the assigned subject teacher.
- [ ] Verify weighted results, missing-mark PENDING, exact 40/50/60/70/80 boundaries and failed subject despite passing average.
- [ ] Verify students/parents cannot read unrelated students' attendance or results.
- [ ] Promote passing students, report incomplete results, handle failing students, retry safely, graduate final class, then close session.
- [ ] Withdraw a student and verify HTTP login/token blocking; separately test socket revocation once implemented.
- [ ] Create draft announcement, confirm public invisibility, publish, edit, unpublish and delete.
- [ ] Send private notification; confirm only the recipient receives it and only they can mark it read.
- [ ] Test an offline recipient, reconnect/history fetching, multiple tabs and expired/invalid socket tokens.
- [ ] Test invalid IDs, missing fields, duplicate records, forbidden deletes and database errors.

## 10. Suggested next work session

Start with migration verification and restricting registration, then test private notifications with two different logged-in users. Record request bodies, response codes and failures. After that, add the portal lookup endpoints before building the notification UI or gallery.
