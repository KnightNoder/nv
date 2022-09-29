const express = require('express');
const cors = require('cors');
const app = express();
const middleware = require('./middlewares/index');
const errorHandler = require('./middlewares/errorHandler');
app.use(cors({credentials: true, origin: true}));
app.use(express.json({limit: '50mb',extended: true}));
app.use(express.urlencoded({limit: '50mb',extended: true}));
app.use(middleware);
app.use(express.static('public'));

app.use('/auth', require('./controller/auth/index'));
app.use('/referral', require('./controller/referral/index'));

module.exports = app;