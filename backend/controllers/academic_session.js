const prisma = require('../config/prisma');
const session_schema = require('../schemas/academicsessionschema')


//create session
const create_session = async (req, res, next) => {
    try {
        const { name, startDate, enddate, isactive } = req.body;

        if (enddate <= startDate) {
            return res.status(400).json({ msg: "End date must be after start date" });
        }

        const existing = await prisma.academicsession.findUnique({
            where: {
                name: name
            }
        });

        if (existing) {
            return res.status(409).json({
                msg: "Session already exists"
            });

        }
        await prisma.academicsession.create({
            data: {
                name, startDate, enddate, isactive
            }
        })
        res.status(200).json({
            msg: "created session"
        });
    }
    catch (err) {
        next(err)
    }
}
//get one
const get_one = async (req, res, next) => {
    try {
        const { name } = req.query;
        if (typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({ msg: "Session name is required" });
        }
        const ss = await prisma.academicsession.findUnique({
            where: {
                name: name
            }
        })
        if (!ss) {
            return res.status(404).json({
                msg: "not found session"
            });
        }
        res.status(200).json({ msg: "got session", ss });


    }
    catch (err) {
        next(err)
    }
}
//get all
const get_all = async (req, res, next) => {
    try {
        const all_sessions = await prisma.academicsession.findMany();

        res.status(200).json({
            msg: "got sessions", all_sessions
        })

    }
    catch (err) {
        next(err)
    }
}
//update 
const update = async (req, res, next) => {
    try {
        const { name, startDate, enddate, isactive } = req.body;
       const id = Number(req.params.id);

if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ msg: "Invalid session ID" });
}
        const existing = await prisma.academicsession.findUnique({
            where: {
                id: id
            }
        });

        if (!existing) {
            return res.status(404).json({
                msg: "Session not found"
            });

        }
        if (existing.closedAt) {
            return res.status(409).json({ msg: "A closed session cannot be edited or reopened" });
        }
        let data = {};
        if (name !== undefined) data.name = name;
        if (startDate !== undefined) data.startDate = startDate;
        if (enddate !== undefined) data.enddate = enddate;
        if (isactive !== undefined) data.isactive = isactive;
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ msg: "Provide at least one field to update" });
        }

        let finalStartDate = existing.startDate;
        let finalEndDate = existing.enddate;
        if (startDate !== undefined) finalStartDate = startDate;
        if (enddate !== undefined) finalEndDate = enddate;
        if (finalEndDate <= finalStartDate) {
            return res.status(400).json({ msg: "End date must be after start date" });
        }
        await prisma.academicsession.update({
            where:{
                id:id
            },data
        })
        res.status(200).json({
            msg:"updated"
        })





    }
    catch (err) {
        next(err)
    }
}

module.exports = { create_session, get_one, get_all, update };
