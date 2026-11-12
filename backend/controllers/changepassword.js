const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

const changePassword = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user || !user.isActive) {
            return res.status(401).json({ msg: "Account not available" });
        }

        const match = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!match) {
            return res.status(400).json({ msg: "Old password is incorrect" });
        }

        if (oldPassword === newPassword) {
            return res.status(400).json({ msg: "New password must be different from the old one" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash }
        });

        return res.status(200).json({ msg: "Password changed" });
    }
    catch (err) {
        next(err);
    }
};

module.exports = { changePassword };