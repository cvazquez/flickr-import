 class model {
	constructor(ds) {
		this.ds = ds;
	}

	// Accepts a query and optional arguments, and runs the query, returned in a promise
	getQueryResults(name, query, queryParams) {
		return new Promise((resolve, reject) => {
			this.ds.query(query, queryParams,
			(err, rows) => {
				if (err) {
					console.log("********* " + name + "() error ***********");
					console.log(err);

					reject({
						failed	: true,
						message	: (err.errno === 1062 ? `Duplicate Value Submitted. Check if value already exists.` : null)
					})
				}

				resolve(rows);
			})
		}).catch(err => {
			console.log("********* Promise Error: " + name + "(" + queryParams + ") *********");
			console.log(err);

			return err;
		})
	}
}

module.exports = model;