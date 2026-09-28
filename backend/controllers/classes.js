const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require('../config/prisma');

const createclass = async (req, res, next) => {
    try {
        const { name, teacherId } = req.body;

        const newclass = await prisma.class.create({
            data: {
                name,
                teacherId
            }
        });

        res.status(201).json({
            message: "class created",
            class: newclass
        });
    }
    catch (err) {
        next(err);
    }
};

const getallclasses = async (req, res, next) => {
    try {
        const classes = await prisma.class.findMany();

        return res.status(200).json({
            msg: classes
        });
    }
    catch (err) {
        next(err);
    }
};

const getoneclass = async (req, res, next) => {
    try {
        const { id } = req.params;

        const getclass = await prisma.class.findUnique({
            where: {
                id: Number(id)
            }
        });

        if (!getclass) {
            return res.status(404).json({
                msg: "class not found"
            });
        }

        res.status(200).json({
            msg: getclass
        });
    }
    catch (err) {
        next(err);
    }
};

const updateclass = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, teacherId } = req.body;

        const to_update = await prisma.class.findUnique({
            where: {
                id: Number(id)
            }
        });

        if (!to_update) {
            return res.status(404).json({
                msg: "class not found"
            });
        }

        const updatedClass = await prisma.class.update({
            where: {
                id: Number(id)
            },
            data: {
                name,
                teacherId
            }
        });

        res.status(200).json({
            msg: "class updated",
            class: updatedClass
        });
    }
    catch (err) {
        next(err);
    }
};

const deleteclass = async (req, res, next) => {
    try {
        const { id } = req.params;

        const to_delete = await prisma.class.findUnique({
            where: {
                id: Number(id)
            }
        });

        if (!to_delete) {
            return res.status(404).json({
                msg: "not found"
            });
        }

        await prisma.class.delete({
            where: {
                id: Number(id)
            }
        });

        res.status(200).json({
            msg: "deleted"
        });
    }
    catch (err) {
        next(err);
    }
};

module.exports = {
    createclass,
    getallclasses,
    getoneclass,
    updateclass,
    deleteclass
};