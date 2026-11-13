const express=require("express");
const router=express.Router();
const register=require("../controllers/register");
const validate=require('../middleware/validate');
const auth=require('../middleware/auth')
const role=require('../middleware/role')
const { registerSchema } = require('../schemas/authschema');

router.post("/register", auth, role("ADMIN"), validate(registerSchema), register);
module.exports=router;