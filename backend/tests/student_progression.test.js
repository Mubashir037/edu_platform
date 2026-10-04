const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(file, prisma, extra = {}) {
    const context = { module: { exports: {} }, console: { error() {} }, process,
        require(name) {
            if (name === '../config/prisma') return prisma;
            if (extra[name]) return extra[name];
            return require(path.resolve(__dirname, '../controllers', name));
        }
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
    return context.module.exports;
}
async function call(fn, body = {}, id = 1, user = { id: 99, role: 'ADMIN' }) {
    const res = { code: 200, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
    await fn({ body, params: { id: String(id) }, user, headers: { authorization: 'Bearer test' } }, res, err => { if (err) throw err; });
    return res;
}
function setup() {
    const sessions = [
        { id: 1, startDate: new Date('2026-04-01'), enddate: new Date('2027-03-31'), closedAt: null, isactive: true },
        { id: 2, startDate: new Date('2027-04-01'), enddate: new Date('2028-03-31'), closedAt: null, isactive: false }
    ];
    const subjects = [{ id: 1 }, { id: 2 }];
    const rows = [];
    const students = [];
    const users = [];
    function add(id, marks, status = 'ACTIVE') {
        users.push({ id: id + 100, isActive: true });
        students.push({ id, userId: id + 100, classId: 1 });
        const grades = [];
        for (let subject = 1; subject <= marks.length; subject++) {
            for (const examType of ['MID1', 'MID2', 'FINAL']) {
                if (marks[subject - 1] !== null) grades.push({ subjectId: subject, examType, marks: marks[subject - 1] });
            }
        }
        rows.push({ id, studentId: id, classId: 1, sessionId: 1, status, grades });
    }
    function matches(row, where) {
        return Object.entries(where).every(([key, value]) => typeof value === 'object' ? row[key] !== value.not : row[key] === value);
    }
    function expand(row) {
        if (!row) return null;
        const student = students.find(s => s.id === row.studentId);
        return { ...row, student: { ...student, user: users.find(u => u.id === student.userId) }, session: sessions.find(s => s.id === row.sessionId) };
    }
    const p = {
        academicsession: {
            findUnique: async ({ where }) => sessions.find(s => s.id === where.id),
            update: async ({ where, data }) => Object.assign(sessions.find(s => s.id === where.id), data)
        },
        class: { findUnique: async ({ where }) => [1, 2].includes(where.id) ? { id: where.id } : null },
        subject: { findMany: async () => subjects },
        enrollment: {
            findUnique: async ({ where }) => expand(rows.find(r => r.id === where.id)),
            findFirst: async ({ where }) => expand(rows.find(r => matches(r, where))),
            findMany: async ({ where }) => rows.filter(r => matches(r, where)).map(expand),
            count: async ({ where }) => rows.filter(r => matches(r, where)).length,
            create: async ({ data }) => {
                if (rows.some(r => r.studentId === data.studentId && r.sessionId === data.sessionId)) throw { code: 'P2002' };
                const row = { id: rows.length + 1000, status: 'ACTIVE', grades: [], ...data };
                rows.push(row); return row;
            },
            update: async ({ where, data }) => Object.assign(rows.find(r => r.id === where.id), data)
        },
        student: { update: async ({ where, data }) => Object.assign(students.find(s => s.id === where.id), data) },
        user: {
            findUnique: async ({ where }) => users.find(u => u.id === where.id),
            update: async ({ where, data }) => Object.assign(users.find(u => u.id === where.id), data)
        }
    };
    return { p, add, rows, students, users, sessions, subjects, c: load('controllers/student_progression.js', p) };
}
const body = { sessionId: 1, classId: 1, nextSessionId: 2, nextClassId: 2 };

test('promotion needs every subject passed; zero is entered; missing exams stay pending; retry is idempotent', async () => {
    const f = setup();
    f.add(1, [40, 80]);
    f.add(2, [100, 39]);
    f.add(3, [80, null]);
    f.add(4, [80, 80], 'WITHDRAWN');
    f.add(5, [0, 0]);
    const r = await call(f.c.promote_students, body);
    assert.equal(r.data.report.promoted.length, 1);
    assert.equal(r.data.report.failed.length, 2);
    assert.equal(r.data.report.pending[0], 3);
    assert.equal(r.data.report.skipped[0].enrollmentId, 4);
    assert.equal(f.rows[0].classId, 1);
    assert.equal(f.rows[0].status, 'COMPLETED');
    assert.equal(f.students[0].classId, 2);
    const length = f.rows.length;
    await call(f.c.promote_students, body);
    assert.equal(f.rows.length, length);
    assert.equal((await call(f.c.close_session)).code, 409);
});

test('failure after target creation is reported and retry finishes without a duplicate', async () => {
    const f = setup(); f.add(1, [80, 80]);
    const update = f.p.student.update;
    f.p.student.update = async () => { throw new Error('temporary failure'); };
    const r = await call(f.c.promote_students, body);
    assert.equal(r.data.report.errors.length, 1);
    assert.equal(f.rows.length, 2);
    assert.equal(f.rows[0].status, 'ACTIVE');
    f.p.student.update = update;
    await call(f.c.promote_students, body);
    assert.equal(f.rows.length, 2);
    assert.equal(f.rows[0].status, 'COMPLETED');
});

test('withdrawal preserves records and disables login and existing JWT access', async () => {
    const f = setup(); f.add(1, [80, 80]);
    assert.equal((await call(f.c.withdraw_student)).code, 200);
    assert.equal(f.rows[0].status, 'WITHDRAWN');
    assert.equal(f.rows[0].grades.length, 6);
    assert.equal(f.users[0].isActive, false);
    assert.equal((await call(f.c.withdraw_student)).code, 200);
    const auth = load('middleware/auth.js', f.p, { jsonwebtoken: { verify: () => ({ id: 101, role: 'STUDENT' }) } });
    assert.equal((await call(auth)).code, 403);
    let signed = false;
    const login = load('controllers/login.js', { user: { findUnique: async () => f.users[0] } }, {
        bcrypt: { compare: async () => true }, jsonwebtoken: { sign: () => { signed = true; } }
    });
    assert.equal((await call(login, { email: 'test@example.com', password: 'pass' })).code, 403);
    assert.equal(signed, false);
});

test('graduation is explicit, and closure refuses unfinished enrollments', async () => {
    const f = setup(); f.add(1, [80, 80]);
    assert.equal((await call(f.c.close_session)).code, 409);
    const r = await call(f.c.graduate_students, { sessionId: 1, classId: 1 });
    assert.equal(r.data.report.graduated[0], 1);
    assert.equal(f.rows.length, 1);
    assert.equal((await call(f.c.close_session)).code, 200);
    assert.equal(f.sessions[0].isactive, false);
    assert.ok(f.sessions[0].closedAt);
    assert.equal((await call(f.c.promote_students, body)).code, 409);
});

test('admin only; invalid targets and conflicting target enrollments are rejected', async () => {
    const f = setup(); f.add(1, [80, 80]);
    assert.equal((await call(f.c.promote_students, body, 1, { role: 'TEACHER' })).code, 403);
    assert.equal((await call(f.c.promote_students, { ...body, nextSessionId: 1 })).code, 400);
    assert.equal((await call(f.c.promote_students, { ...body, nextClassId: 1 })).code, 400);
    f.rows.push({ id: 500, studentId: 1, sessionId: 2, classId: 1, status: 'ACTIVE', grades: [] });
    assert.equal((await call(f.c.promote_students, body)).data.report.skipped.length, 1);
    assert.equal((await call(f.c.withdraw_student)).code, 409);
    assert.equal(f.rows[0].status, 'ACTIVE');
});

test('no required subjects means pending, not automatic promotion', async () => {
    const f = setup(); f.add(1, []); f.subjects.length = 0;
    assert.equal((await call(f.c.promote_students, body)).data.report.pending[0], 1);
    assert.equal(f.rows.length, 1);
});

test('attendance, grades and enrollment corrections reject finalized enrollments', async () => {
    const f = setup(); f.add(1, [80, 80], 'COMPLETED');
    f.p.teacher = { findUnique: async () => ({id: 3}) };
    const grade = load('controllers/grades.js', f.p);
    let r = await call(grade.assign_grade, {enrollmentId:1,subjectId:1,examType:'MID1',marks:80}, 1, {id:3,role:'TEACHER'});
    assert.equal(r.code,409);
    const attendance = load('controllers/attendance.js', f.p);
    r = await call(attendance.markattandance, {enroll_id:1,date:'2026-09-30',status:'PRESENT'}, 1, {id:3,role:'TEACHER'});
    assert.equal(r.code,409);
    const enrollment = load('controllers/enrollment.js', f.p);
    assert.equal((await call(enrollment.update,{classId:2})).code,409);
    assert.equal((await call(enrollment.delete_enrollment)).code,409);
});
