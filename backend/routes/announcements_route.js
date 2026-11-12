const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const { bulkNotificationSchema } = require('../schemas/notificationschema');
const {
  create_notification, get_my_notifications, mark_as_read, get_unread_count, create_bulk_notification
} = require('../controllers/notifications');

router.post('/', auth, role('ADMIN'), create_notification);
router.post('/bulk', auth, role('ADMIN'), validate(bulkNotificationSchema), create_bulk_notification);
router.get('/', auth, get_my_notifications);
router.get('/unread-count', auth, get_unread_count);
router.patch('/:id/read', auth, mark_as_read);

module.exports = router;
