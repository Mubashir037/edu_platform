const jwt=require("jsonwebtoken");

const auth=(req,res,next)=>{
    const token=req.headers.authorization?.split(" ")[1];
    if(!token){
        return res.status(401).json({
            message:"unauthorizaed"
        })
    }
    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        req.user=decoded;
        next();
    }
    catch(err){
        res.status(403).json({
            message:"invalid token && token issue"
        })
    }
}
module.exports=auth;