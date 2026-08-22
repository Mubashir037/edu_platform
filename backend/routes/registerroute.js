const express=require("express");
const router=express.Router();
const register=require("../controllers/register");
const validate=require('../middleware/validate');
const schema=require('../schemas/authschema');

router.post("/register", validate(schema),register);
module.exports=router;