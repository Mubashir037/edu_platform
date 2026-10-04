const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { withdraw_student, promote_students, graduate_students, close_session } = require('../controllers/student_progression');

router.patch('/enrollments/:id/withdraw', auth, role('ADMIN'), withdraw_student);
router.post('/promote', auth, role('ADMIN'), promote_students);
router.post('/graduate', auth, role('ADMIN'), graduate_students);
router.patch('/sessions/:id/close', auth, role('ADMIN'), close_session);

module.exports = router;
