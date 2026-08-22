const role=(...allowedroles)=>{
    return (req,res,next)=>{
        if(!req.user || !allowedroles.includes(req.user.role)){
            return res.status(403).json({
                message:"Acess denied"
            });
        }
        next();
    };
};
module.exports=role;