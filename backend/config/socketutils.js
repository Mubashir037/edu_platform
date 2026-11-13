// Closes every open socket (all tabs) of one user.
const disconnectUser = (io, userId) => {
    if (!io) return;
    io.in('user:' + userId).disconnectSockets(true);
};

module.exports = { disconnectUser };