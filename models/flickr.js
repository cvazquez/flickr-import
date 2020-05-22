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

	saveAlbum(id, flickrCollectionId, title, description) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT INTO flickrsets
							SET id 					= ?,
								flickrCollectionId	= ?,
								title				= ?,
								description			= ?,
								createdAt			= now()`,
							[id, flickrCollectionId, title, description],
							(err, rows) => {
								if(err) reject(err);

								resolve(rows);
							})
		}).catch((err) => {
			let reason = err;

			if(err.errno === 1062) {
				reason = "Photo Albums already exist in DB";
			}

			return({failed: true,
					reason: reason});
		});
	}

	savePhotos(values) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT INTO flickrsetphotos
							(id, flickrSetId, orderId, title, squareURL, squareWidth, squareHeight, mediumURL, mediumWidth, mediumHeight, largeURL, largeWidth, largeHeight, takenAt)
							VALUES ?;`,
							[values],
					(err, rows) => {
						if(err) reject(err);

						resolve(rows)
					})
		}).catch((err) => {
			let reason = err;

			if(err.errno === 1062) {
				reason = "Photos already exist in DB";
			}

			return({failed: true,
					reason: reason});
		});
	}

	savePhotoURLS() {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT IGNORE INTO flickrsetphotourls (flickrSetPhotoId, name, isActive, createdAt)
							SELECT id, CreateTitleURL(title), 1, now()
							FROM flickrsetphotos
							WHERE deletedAt IS NULL
							ORDER BY id;`,
				(err, rows) => {
					if(err) reject(err);

					resolve(rows);
				})
		}).catch((err) => {
			return({failed: true,
					reason: err});
		});
	}
}