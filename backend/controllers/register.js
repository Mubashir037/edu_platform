const bcrypt=require("bcrypt");
const prisma = require('../config/prisma');
const register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name, email, passwordHash, role
            }
        });
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });




    }
    catch (err) {
        next(err);
    }
}
module.exports=register;