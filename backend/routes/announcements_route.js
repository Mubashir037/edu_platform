

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const validate = require('../middleware/validate');
const announcementSchema = require('../schemas/announcementschema');
const {
  create_announcement, delete_announcement, update_announcement,
  get_all, get_one, admin_get_all, admin_get_one
} = require('../controllers/public_announcements');

router.get('/', get_all);                                   // public
router.get('/admin/all', auth, role('ADMIN'), admin_get_all);
router.get('/admin/:id', auth, role('ADMIN'), admin_get_one);
router.get('/:id', get_one);                                // public
router.post('/', auth, role('ADMIN'), validate(announcementSchema), create_announcement);
router.patch('/:id', auth, role('ADMIN'), validate(announcementSchema.partial()), update_announcement);
router.delete('/:id', auth, role('ADMIN'), delete_announcement);

module.exports = router;