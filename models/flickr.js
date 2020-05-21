exports.flickrModel = class flickrModel {
	constructor(ds) {
		this.ds = ds;
	}

	getAlbumInfo(albumbIds) {
		return new Promise((resolve, reject) => {
		this.ds.query(`	SELECT id, title, description
						FROM flickrsets
						WHERE id IN (${albumbIds})`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			}
		)})
	}

	getCollections() {
		return new Promise((resolve, reject) => {
			this.ds.query(`
				SELECT id
				FROM flickrcollections;`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			})
		})
	}

	getCredentials() {
		return new Promise((resolve, reject) => {
			this.ds.query(`	SELECT name, value
							FROM adminsettings
							WHERE	name IN ('flickrAPIKey', 'flikrAPISecret', 'flickrUserId')
									AND deletedAt IS NULL`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			})
		})
	}
}