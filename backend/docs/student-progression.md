# Student progression

Run the Prisma migration and regenerate the client before restarting the server:

```powershell
cd backend
npx prisma migrate dev --name student_progression
npx prisma generate
```

No migration or database changes were applied by the implementation task. Existing users default to active; existing enrollments default to ACTIVE. Review historical enrollments before using bulk processing.

All endpoints require an ADMIN Bearer token. Base path: `/api/progression`.

## Withdraw one student

`PATCH /enrollments/:id/withdraw`

No body needed. The ID is an enrollment ID. Marks, attendance and the account are retained. Login and previously issued tokens are blocked. Withdrawal records the current time. Another active enrollment blocks withdrawal so a historical request cannot disable an otherwise enrolled student. Repeating withdrawal can finish an interrupted attempt.

## Promote one class in bulk

`POST /promote`

```json
{
  "sessionId": 1,
  "classId": 2,
  "nextSessionId": 2,
  "nextClassId": 3
}
```

Use real database IDs. The admin is responsible for selecting the appropriate next class. The next session must start after the source session ends and must not be closed. Every required subject must have MID1, MID2 and FINAL entered, each out of 100. Weights are 25%, 25%, 50%; the unrounded subject percentage must be at least 40 in EVERY subject.

- Passing students get a new enrollment; the original enrollment becomes COMPLETED. Student.classId is updated for compatibility with older code.
- Students with a complete but failing result become COMPLETED without promotion. The admin can decide their next enrollment separately.
- Incomplete results stay ACTIVE and appear in pending.
- Withdrawn, completed, graduated or inactive accounts are skipped.
- A conflicting next-session enrollment is skipped and reported.
- Processing errors are reported per enrollment. Review the report; HTTP 200 does not mean every student was promoted. Retry the same request to finish interrupted students; a matching next enrollment is reused.

Finalized enrollments cannot be edited/deleted through normal enrollment CRUD. Their marks and attendance cannot be changed. Verify results before bulk finalization; no reopen workflow is included.

## Graduate the final class

`POST /graduate`

```json
{ "sessionId": 1, "classId": 10 }
```

Explicit admin action for the actual final class; IDs do not determine class order. The same pass rule applies. Passing students become GRADUATED without a new enrollment. Graduate logins remain active to view results.

## Close the old session

`PATCH /sessions/:id/close`

Closure refuses while any enrollment remains ACTIVE. Resolve pending/error/skipped active enrollments first. Closure sets isactive=false and closedAt, but does not automatically activate the next session. The new session can be activated using the existing session PATCH API. Closed sessions cannot be edited or reopened through that API.

## Implementation limits

The implementation uses separate Prisma calls, as requested, and has retry handling rather than a database transaction. Successful writes remain saved if a later write fails. The in-memory progression lock protects overlapping progression requests only within one server process; it does not protect against other controllers, multiple servers or concurrent grade edits. Use one admin workflow at a time and finalize only once grade entry has stopped. Database-level locking/transactions should be considered before production deployment.

Required subjects and teacher assignments currently come from the class's current subject list, not a yearly curriculum snapshot. Changing that list can affect historical calculations; yearly subject snapshots remain separate work.

Tests use a mocked database:

```powershell
node --test backend/tests/student_progression.test.js
```
