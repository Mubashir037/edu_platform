const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { create_notification, get_my_notifications, mark_as_read } = require('../controllers/notifications');

router.post('/', auth, role('ADMIN'), create_notification);
router.get('/', auth, get_my_notifications);
router.patch('/:id/read', auth, mark_as_read);

module.exports = router;
