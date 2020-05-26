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

exports.close = function closeConnection(dbHandle) {
	process.stdout.write("Closing DB connection...");

	dbHandle.end(err => {
		if(err) {
			console.log("***********Error Closing DB connection*********");
			console.error(err);

			console.log("Issue destroy....");
			flikrDS.destroy();
			console.log("destroyed!!");
			return;
		}
		process.stdout.write("DB Connection closed!\n");
	});
};