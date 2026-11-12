const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { sendMail } = require("../config/mailer");

const TOKEN_MINUTES = 15;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Always gives the same answer, so nobody can learn which emails are registered.
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const genericReply = { msg: "If that email is registered, a reset link has been sent" };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
            return res.status(200).json(genericReply);
        }

        const token = crypto.randomBytes(32).toString("hex");

        // Only the newest link should work.
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hashToken(token),
                expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000)
            }
        });

        const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        // Not awaited, so response time does not reveal whether the email exists.
        sendMail({
            to: user.email,
            subject: "Reset your password",
            text: `We received a request to reset your password.\n\nOpen this link within ${TOKEN_MINUTES} minutes:\n${link}\n\nIf you did not ask for this, ignore this email.`
        }).catch((e) => console.error("Reset email failed:", e.message));

        return res.status(200).json(genericReply);
    }
    catch (err) {
        next(err);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        const record = await prisma.passwordResetToken.findUnique({
            where: { tokenHash: hashToken(token) },
            include: { user: true }
        });

        if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
            return res.status(400).json({ msg: "Reset link is invalid or has expired" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
            prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } })
        ]);

        return res.status(200).json({ msg: "Password reset. You can log in now" });
    }
    catch (err) {
        next(err);
    }
};

module.exports = { forgotPassword, resetPassword };