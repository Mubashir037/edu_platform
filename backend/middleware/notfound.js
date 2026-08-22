const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `route not found`,
        error: "Route not found"
    });
};
module.exports = notFoundHandler;