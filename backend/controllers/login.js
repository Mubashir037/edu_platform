const bcrypt=require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma=require('../config/prisma')
const login=async(req,res,next)=>{
    try{
        const {email,password}=req.body;
        const user=await prisma.user.findUnique({
            where:{
                email:email
            }
        });
        if(!user){
            return res.status(401).json({
                message:"invalid email or pass"
            });
        }
        const match=await bcrypt.compare(password,user.passwordHash);
        if(!match){
            return res.status(401).json({
                message:"wrong password"
            });
        }
        const token=jwt.sign(
            {id:user.id,role:user.role},process.env.JWT_SECRET,
            {
                expiresIn:"1d"
            }
        );
         res.json({
      message: "Login successful",
      token
    });

        

    }
    catch(err){
        next(err);
    }
}
module.exports=login;