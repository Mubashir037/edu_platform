const express=require("express");
const router=express.Router();
const login=require('../controllers/login')
const middleware=require('../middleware/validate');
const { loginSchema}=require('../schemas/authschema')
router.post('/login',middleware(loginSchema),login)
module.exports=router;