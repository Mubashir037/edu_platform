const validate=(schema)=>(req,res,next)=>{
    const result=schema.safeParse(req.body);
    if (!result.success) {
  console.log(result.error.errors); // add this line
  return res.status(400).json({ message: "Validation failed", errors: result.error.issues });
}
    req.body=result.data;
    next();
}
module.exports=validate;