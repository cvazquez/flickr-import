const   mysql   = require('mysql'),
        cred    = require('../../../config/mysql').cred,
        connection = mysql.createConnection({
            host        : cred.host,
            user        : cred.user,
            password    : cred.password,
            database    : cred.database,
            insecureAuth	: false,
			supportBigNumbers	: cred.supportBigNumbers,
			bigNumberStrings	: cred.bigNumberStrings
        });

connection.connect();
exports.connection = connection;