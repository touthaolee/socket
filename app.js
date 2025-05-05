// app.js
// This file is the entry point for Passenger
require('dotenv').config();
const server = require('./server-side/server-main');

module.exports = server;