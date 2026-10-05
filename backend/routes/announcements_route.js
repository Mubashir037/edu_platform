const express=require('express')
const router=express.Router();
const auth=require('../middleware/auth')
const valid=require('../middleware/validate')
const role=require('../middleware/role')
const { create_announcement, delete_announcement, update_announcement }=require('../controllers/public_announcements')
const announcementSchema = require('../schemas/announcementschema');

router.post('/', auth, role('ADMIN'), valid(announcementSchema), create_announcement);
router.patch('/:id', auth, role('ADMIN'), valid(announcementSchema.partial()), update_announcement);
router.delete('/:id', auth, role('ADMIN'), delete_announcement);

module.exports = router;

